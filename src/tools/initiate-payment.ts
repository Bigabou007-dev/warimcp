import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { transactions, auditLog } from "../db/schema.js";
import { getProvider } from "../providers/registry.js";
import { getConfig } from "../config.js";
import { HttpError } from "../utils/http-error.js";
import type { InitiatePaymentInput } from "./definitions.js";

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

  const FALLBACK_PROVIDER = "fedapay";
  let provider = getProvider(input.provider);
  const config = getConfig();
  const notifyUrl =
    input.notifyUrl ||
    (config.WARIMCP_WEBHOOK_BASE_URL
      ? `${config.WARIMCP_WEBHOOK_BASE_URL}/api/v1/webhooks/${provider.name}`
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

  try {
    const result = await provider.initiatePayment({
      ...input,
      notifyUrl,
    });

    // Update with provider response
    await db
      .update(transactions)
      .set({
        providerReference: result.providerReference,
        paymentUrl: result.paymentUrl,
        status: result.status === "completed" ? "completed" : "pending",
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, tx.id));

    await db.insert(auditLog).values({
      transactionId: tx.id,
      action: "initiated",
      actor: `provider:${provider.name}`,
      details: { providerReference: result.providerReference },
    });

    return {
      transactionId: tx.id,
      provider: provider.name,
      providerReference: result.providerReference,
      status: result.status === "completed" ? "completed" : "pending",
      paymentUrl: result.paymentUrl,
      amount: input.amount,
      currency: input.currency,
      idempotent: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    // Only fall back on client errors (4xx) where we KNOW the payment was NOT initiated.
    // For server errors (5xx) or network errors, the payment may have been initiated
    // but the response lost — falling back would risk a double charge.
    const isSafeToFallback =
      err instanceof HttpError && err.status >= 400 && err.status < 500;

    if (isSafeToFallback && provider.name !== FALLBACK_PROVIDER && provider.name !== "mock") {
      try {
        const fallback = getProvider(FALLBACK_PROVIDER);
        if (fallback.isConfigured()) {
          console.error(
            `[payment] ${provider.name} failed (${message}), falling back to ${FALLBACK_PROVIDER}`
          );

          const fallbackNotifyUrl = config.WARIMCP_WEBHOOK_BASE_URL
            ? `${config.WARIMCP_WEBHOOK_BASE_URL}/api/v1/webhooks/${fallback.name}`
            : "";

          const result = await fallback.initiatePayment({
            ...input,
            notifyUrl: fallbackNotifyUrl,
          });

          // Update transaction with fallback provider
          await db
            .update(transactions)
            .set({
              provider: fallback.name,
              providerReference: result.providerReference,
              paymentUrl: result.paymentUrl,
              status: result.status === "completed" ? "completed" : "pending",
              updatedAt: new Date(),
            })
            .where(eq(transactions.id, tx.id));

          await db.insert(auditLog).values({
            transactionId: tx.id,
            action: "initiated_fallback",
            actor: `provider:${fallback.name}`,
            details: {
              providerReference: result.providerReference,
              originalProvider: provider.name,
              originalError: message,
            },
          });

          return {
            transactionId: tx.id,
            provider: fallback.name,
            providerReference: result.providerReference,
            status: result.status === "completed" ? "completed" : "pending",
            paymentUrl: result.paymentUrl,
            amount: input.amount,
            currency: input.currency,
            idempotent: false,
          };
        }
      } catch {
        // Fallback also failed — fall through to original error
      }
    }

    await db
      .update(transactions)
      .set({
        status: "failed",
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, tx.id));

    throw err;
  }
}
