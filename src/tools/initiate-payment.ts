import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { transactions, auditLog } from "../db/schema.js";
import { getProvider } from "../providers/registry.js";
import { getConfig } from "../config.js";
import { HttpError } from "../utils/http-error.js";
import type { InitiatePaymentInput } from "./definitions.js";

/**
 * Resolve the ordered failover candidates after a failed initiation.
 * Pure: dedupes the configured chain, drops the provider that already failed,
 * and never routes real traffic to mock.
 */
export function resolveFailoverChain(requested: string, chainCsv: string): string[] {
  const seen = new Set<string>([requested.toLowerCase(), "mock"]);
  const out: string[] = [];
  for (const raw of chainCsv.split(",")) {
    const name = raw.trim().toLowerCase();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

/**
 * Only errors that PROVE the payment was never initiated are safe to fail
 * over from. 4xx = provider rejected the request outright. 5xx or a network
 * error means the payment MAY exist at the provider — retrying elsewhere
 * would risk a double charge, so the chain stops immediately.
 */
function isSafeToFailover(err: unknown): boolean {
  return err instanceof HttpError && err.status >= 400 && err.status < 500;
}

export async function initiatePayment(
  db: PostgresJsDatabase,
  input: InitiatePaymentInput
) {
  // Idempotency check
  const existing = await db
    .select()
    .from(transactions)
    .where(eq(transactions.idempotencyKey, input.idempotencyKey))
    .limit(1);

  if (existing.length > 0) {
    const tx = existing[0];
    return {
      transactionId: tx.id,
      provider: tx.provider,
      status: tx.status,
      paymentUrl: tx.paymentUrl,
      amount: tx.amount,
      currency: tx.currency,
      idempotent: true,
    };
  }

  const provider = getProvider(input.provider);
  const config = getConfig();
  const notifyUrlFor = (providerName: string) =>
    input.notifyUrl ||
    (config.WARIMCP_WEBHOOK_BASE_URL
      ? `${config.WARIMCP_WEBHOOK_BASE_URL}/api/v1/webhooks/${providerName}`
      : "");

  // Create transaction record
  const [tx] = await db
    .insert(transactions)
    .values({
      idempotencyKey: input.idempotencyKey,
      provider: provider.name,
      type: "payment",
      status: "pending",
      amount: input.amount,
      currency: input.currency,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      description: input.description,
      callbackUrl: input.callbackUrl,
      metadata: input.metadata,
    })
    .returning();

  /** Run one provider attempt; on success, persist + return the API result. */
  const attempt = async (
    p: ReturnType<typeof getProvider>,
    action: "initiated" | "initiated_fallback",
    extraDetails: Record<string, unknown> = {}
  ) => {
    const result = await p.initiatePayment({
      ...input,
      notifyUrl: notifyUrlFor(p.name),
    });

    await db
      .update(transactions)
      .set({
        provider: p.name,
        providerReference: result.providerReference,
        paymentUrl: result.paymentUrl,
        status: result.status === "completed" ? "completed" : "pending",
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, tx.id));

    await db.insert(auditLog).values({
      transactionId: tx.id,
      action,
      actor: `provider:${p.name}`,
      details: { providerReference: result.providerReference, ...extraDetails },
    });

    return {
      transactionId: tx.id,
      provider: p.name,
      providerReference: result.providerReference,
      status: result.status === "completed" ? "completed" : "pending",
      paymentUrl: result.paymentUrl,
      amount: input.amount,
      currency: input.currency,
      idempotent: false,
    };
  };

  try {
    return await attempt(provider, "initiated");
  } catch (err) {
    const originalMessage = err instanceof Error ? err.message : "Unknown error";
    let lastError: unknown = err;

    // Failover chain: only entered when the FIRST failure is provably
    // uninitiated (4xx). The chain also STOPS the moment any candidate fails
    // ambiguously (5xx/network) — that candidate may hold a live payment.
    if (isSafeToFailover(err) && provider.name !== "mock") {
      const chain = resolveFailoverChain(provider.name, config.WARIMCP_FAILOVER_CHAIN);
      for (const candidateName of chain) {
        let candidate;
        try {
          candidate = getProvider(candidateName);
        } catch {
          continue; // unknown name in config — skip
        }
        if (!candidate.isConfigured()) continue;

        console.error(
          `[payment] ${provider.name} failed safely (${originalMessage}) — failing over to ${candidateName}`
        );
        try {
          return await attempt(candidate, "initiated_fallback", {
            originalProvider: provider.name,
            originalError: originalMessage,
          });
        } catch (candidateErr) {
          lastError = candidateErr;
          await db.insert(auditLog).values({
            transactionId: tx.id,
            action: "failover_attempt_failed",
            actor: `provider:${candidateName}`,
            details: {
              error:
                candidateErr instanceof Error ? candidateErr.message : "Unknown error",
            },
          });
          if (!isSafeToFailover(candidateErr)) {
            // Ambiguous failure — the payment may exist at this candidate.
            // Do NOT try further providers.
            break;
          }
        }
      }
    }

    const finalMessage =
      lastError instanceof Error ? lastError.message : originalMessage;
    await db
      .update(transactions)
      .set({
        status: "failed",
        errorMessage: finalMessage,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, tx.id));

    throw lastError;
  }
}
