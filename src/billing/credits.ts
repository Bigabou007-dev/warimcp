import { eq, sql, and, gte } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { creditAccounts, creditLedger } from "../db/schema.js";
import { getConfig } from "../config.js";

/**
 * Prepaid credit billing — domain logic (no HTTP/express here).
 *
 * An API key MAY have a credit account (created on first top-up). Balances
 * are XOF (no subunits). The ledger is append-only: top-ups carry the funding
 * transaction id under a UNIQUE constraint, so a replayed provider webhook
 * can never double-credit; per-call charges carry NULL.
 *
 * Consumed by:
 *  - server/middleware/prepaid.ts (per-call charging adapter)
 *  - server/http.ts (top-up + balance endpoints)
 *  - webhooks/handler.ts (crediting on completed payments)
 */

/**
 * Atomically charge an account: a single conditional UPDATE (balance >= price)
 * — no read-modify-write race, balances can never go negative. Returns the new
 * balance, or null when the account is missing or under-funded (callers that
 * already know the account exists can treat null as insufficient funds).
 */
export async function chargeCredits(
  db: PostgresJsDatabase,
  apiKeyId: string,
  amountXof: number,
  reason: string
): Promise<number | null> {
  if (amountXof <= 0) return 0;

  const [account] = await db
    .update(creditAccounts)
    .set({
      balanceXof: sql`${creditAccounts.balanceXof} - ${amountXof}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(creditAccounts.apiKeyId, apiKeyId),
        gte(creditAccounts.balanceXof, amountXof)
      )
    )
    .returning();

  if (!account) return null;

  await db.insert(creditLedger).values({
    accountId: account.id,
    deltaXof: -amountXof,
    reason,
  });

  return account.balanceXof;
}

/**
 * Credit a completed top-up transaction. Idempotent via the ledger's UNIQUE
 * transaction_id. Returns true only when credit was newly applied.
 */
export async function creditTopupIfApplicable(
  db: PostgresJsDatabase,
  tx: { id: string; amount: number; metadata: unknown }
): Promise<boolean> {
  const meta = (tx.metadata ?? {}) as Record<string, unknown>;
  if (meta.warimcp_topup !== true || typeof meta.apiKeyId !== "string") {
    return false;
  }

  // Upsert-and-return: creates the account on first top-up, returns the
  // existing row otherwise (single round-trip).
  const [account] = await db
    .insert(creditAccounts)
    .values({ apiKeyId: meta.apiKeyId })
    .onConflictDoUpdate({
      target: creditAccounts.apiKeyId,
      set: { updatedAt: new Date() },
    })
    .returning();
  if (!account) return false;

  // Idempotency gate: unique transaction_id in the ledger.
  const inserted = await db
    .insert(creditLedger)
    .values({
      accountId: account.id,
      deltaXof: tx.amount,
      reason: "topup",
      transactionId: tx.id,
    })
    .onConflictDoNothing({ target: creditLedger.transactionId })
    .returning();
  if (inserted.length === 0) return false; // already credited

  await db
    .update(creditAccounts)
    .set({
      balanceXof: sql`${creditAccounts.balanceXof} + ${tx.amount}`,
      totalToppedUpXof: sql`${creditAccounts.totalToppedUpXof} + ${tx.amount}`,
      updatedAt: new Date(),
    })
    .where(eq(creditAccounts.id, account.id));

  console.error(
    `[billing] credited ${tx.amount} XOF to api key ${meta.apiKeyId} (tx ${tx.id})`
  );
  return true;
}

/** Balance + pricing snapshot for GET /api/v1/billing/balance. */
export async function getBalance(db: PostgresJsDatabase, apiKeyId: string) {
  const [account] = await db
    .select()
    .from(creditAccounts)
    .where(eq(creditAccounts.apiKeyId, apiKeyId))
    .limit(1);
  const cfg = getConfig();
  return {
    prepaid: !!account,
    balanceXof: account?.balanceXof ?? 0,
    totalToppedUpXof: account?.totalToppedUpXof ?? 0,
    priceWriteXof: cfg.BILLING_PRICE_WRITE_XOF,
    priceReadXof: cfg.BILLING_PRICE_READ_XOF,
  };
}
