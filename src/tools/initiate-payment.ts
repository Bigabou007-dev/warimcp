import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { transactions, auditLog } from "../db/schema.js";
import { getProvider } from "../providers/registry.js";
import { getConfig } from "../config.js";
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

  const provider = getProvider(input.provider);
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
