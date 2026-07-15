import { eq, sql, and, gte } from "drizzle-orm";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { creditAccounts, creditLedger, transactions } from "../../db/schema.js";
import { getConfig } from "../../config.js";
import type { AuthenticatedRequest } from "./auth.js";

/**
 * Prepaid mobile-money credits — WariMCP's third billing door.
 *
 * An API key MAY have a credit account (created on first top-up). If it does,
 * every priced call decrements the XOF balance; if it doesn't, the key
 * behaves as before (subscription / uncharged). Top-ups are collected through
 * WariMCP itself via the operator's own PSP account — an African dev without
 * a card or crypto can pay for the API with Orange Money or Wave.
 *
 * Integrity model mirrors the rest of WariMCP:
 *  - Charges are a single conditional UPDATE (balance >= price) — atomic,
 *    no read-modify-write race.
 *  - The ledger is append-only; top-up rows carry the funding transaction id
 *    with a UNIQUE constraint, so replayed provider webhooks cannot
 *    double-credit.
 */

/** Route classes: GETs are reads, everything else is a write. */
export function priceForRequest(method: string): number {
  const cfg = getConfig();
  return method.toUpperCase() === "GET"
    ? cfg.BILLING_PRICE_READ_XOF
    : cfg.BILLING_PRICE_WRITE_XOF;
}

/**
 * Atomically charge an account. Returns the new balance, or null when the
 * account doesn't exist or has insufficient funds.
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

  // Append-only charge record (transactionId NULL for charges).
  await db.insert(creditLedger).values({
    accountId: account.id,
    deltaXof: -amountXof,
    reason,
  });

  return account.balanceXof;
}

/** Does this API key have a credit account at all? */
async function hasCreditAccount(
  db: PostgresJsDatabase,
  apiKeyId: string
): Promise<boolean> {
  const rows = await db
    .select({ id: creditAccounts.id })
    .from(creditAccounts)
    .where(eq(creditAccounts.apiKeyId, apiKeyId))
    .limit(1);
  return rows.length > 0;
}

/**
 * Per-call charging middleware. Runs AFTER auth. No-ops for:
 *  - x402-paid requests (no apiKeyId on the request)
 *  - keys without a credit account (subscription keys)
 *  - the /api/v1/billing/* endpoints themselves (topping up is never charged)
 */
export function createPrepaidChargeMiddleware(
  db: PostgresJsDatabase,
  deps: { charge?: typeof chargeCredits; hasAccount?: typeof hasCreditAccount } = {}
): RequestHandler {
  const charge = deps.charge ?? chargeCredits;
  const hasAccount = deps.hasAccount ?? hasCreditAccount;

  return async (req: Request, res: Response, next: NextFunction) => {
    const cfg = getConfig();
    const { apiKeyId } = req as AuthenticatedRequest;

    if (!cfg.BILLING_PREPAID_ENABLED || !apiKeyId) return next();
    if (req.path.startsWith("/api/v1/billing")) return next();
    if (!(await hasAccount(db, apiKeyId))) return next();

    const price = priceForRequest(req.method);
    const reason = `charge:${req.method.toUpperCase()} ${req.path}`;
    const newBalance = await charge(db, apiKeyId, price, reason);

    if (newBalance === null) {
      res.status(402).json({
        error: "Insufficient credit",
        priceXof: price,
        topUp: "POST /api/v1/billing/topup",
      });
      return;
    }

    res.setHeader("X-Credit-Balance-XOF", String(newBalance));
    next();
  };
}

/**
 * Credit a completed top-up transaction. Idempotent: the ledger's UNIQUE
 * transaction_id makes a second call (replayed webhook) a no-op.
 * Called from the provider-webhook handler when a payment flips to completed.
 */
export async function creditTopupIfApplicable(
  db: PostgresJsDatabase,
  tx: { id: string; amount: number; metadata: unknown }
): Promise<boolean> {
  const meta = (tx.metadata ?? {}) as Record<string, unknown>;
  if (meta.warimcp_topup !== true || typeof meta.apiKeyId !== "string") {
    return false;
  }
  const apiKeyId = meta.apiKeyId;

  // Ensure the account exists (first top-up creates it).
  await db
    .insert(creditAccounts)
    .values({ apiKeyId })
    .onConflictDoNothing({ target: creditAccounts.apiKeyId });

  const [account] = await db
    .select()
    .from(creditAccounts)
    .where(eq(creditAccounts.apiKeyId, apiKeyId))
    .limit(1);
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

  console.error(`[billing] credited ${tx.amount} XOF to api key ${apiKeyId} (tx ${tx.id})`);
  return true;
}

/** GET /api/v1/billing/balance */
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

/** Guard: is a transaction row a WariMCP top-up? (used by webhook handler) */
export function isTopupTransaction(tx: { metadata: unknown } | undefined): boolean {
  if (!tx) return false;
  const meta = (tx.metadata ?? {}) as Record<string, unknown>;
  return meta.warimcp_topup === true;
}

// Re-export for the topup endpoint's idempotency lookups.
export { transactions };
