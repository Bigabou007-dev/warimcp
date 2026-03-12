import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { payouts, auditLog } from "../db/schema.js";
import { getProvider } from "../providers/registry.js";
import type { InitiatePayoutInput } from "./definitions.js";

export async function initiatePayout(
  db: PostgresJsDatabase,
  input: InitiatePayoutInput
) {
  // Idempotency check
  const existing = await db
    .select()
    .from(payouts)
    .where(eq(payouts.idempotencyKey, input.idempotencyKey))
    .limit(1);

  if (existing.length > 0) {
    const po = existing[0];
    return {
      payoutId: po.id,
      provider: po.provider,
      status: po.status,
      amount: po.amount,
      currency: po.currency,
      idempotent: true,
    };
  }

  const provider = getProvider(input.provider);

  const [po] = await db
    .insert(payouts)
    .values({
      idempotencyKey: input.idempotencyKey,
      provider: provider.name,
      status: "pending",
      amount: input.amount,
      currency: input.currency,
      recipientPhone: input.recipientPhone,
      recipientName: input.recipientName,
      method: input.method,
      metadata: input.metadata,
    })
    .returning();

  try {
    const result = await provider.initiatePayout(input);

    await db
      .update(payouts)
      .set({
        providerReference: result.providerReference,
        status: result.status === "completed" ? "completed" : "pending",
      })
      .where(eq(payouts.id, po.id));

    await db.insert(auditLog).values({
      transactionId: null,
      action: "payout_initiated",
      details: { payoutId: po.id, providerReference: result.providerReference },
    });

    return {
      payoutId: po.id,
      provider: provider.name,
      providerReference: result.providerReference,
      status: result.status === "completed" ? "completed" : "pending",
      amount: input.amount,
      currency: input.currency,
      idempotent: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db
      .update(payouts)
      .set({ status: "failed", errorMessage: message })
      .where(eq(payouts.id, po.id));

    throw err;
  }
}
