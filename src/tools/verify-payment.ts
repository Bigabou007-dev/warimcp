import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { transactions, auditLog } from "../db/schema.js";
import { getProvider } from "../providers/registry.js";

export async function verifyPayment(
  db: PostgresJsDatabase,
  transactionId: string
) {
  const [tx] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1);

  if (!tx) {
    throw new Error(`Transaction not found: ${transactionId}`);
  }

  // If already terminal, return cached status
  if (tx.status === "completed" || tx.status === "failed" || tx.status === "refunded") {
    return {
      transactionId: tx.id,
      provider: tx.provider,
      status: tx.status,
      amount: tx.amount,
      currency: tx.currency,
    };
  }

  // Poll provider for live status
  if (!tx.providerReference) {
    return {
      transactionId: tx.id,
      provider: tx.provider,
      status: tx.status,
      amount: tx.amount,
      currency: tx.currency,
    };
  }

  const provider = getProvider(tx.provider);
  const result = await provider.verifyPayment(tx.providerReference);

  // Update if status changed
  if (result.status !== tx.status) {
    await db
      .update(transactions)
      .set({
        status: result.status,
        updatedAt: new Date(),
        completedAt: result.status === "completed" ? new Date() : undefined,
      })
      .where(eq(transactions.id, tx.id));

    await db.insert(auditLog).values({
      transactionId: tx.id,
      action: "verified",
      actor: `provider:${tx.provider}`,
      details: { oldStatus: tx.status, newStatus: result.status },
    });
  }

  return {
    transactionId: tx.id,
    provider: tx.provider,
    status: result.status,
    amount: tx.amount,
    currency: tx.currency,
    paymentMethod: result.paymentMethod,
  };
}
