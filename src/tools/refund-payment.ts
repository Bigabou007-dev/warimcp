import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { transactions, auditLog } from "../db/schema.js";

export async function refundPayment(
  db: PostgresJsDatabase,
  transactionId: string,
  _amount?: number,
  reason?: string
) {
  const [tx] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1);

  if (!tx) {
    throw new Error(`Transaction not found: ${transactionId}`);
  }

  if (tx.status !== "completed") {
    throw new Error(`Cannot refund transaction with status: ${tx.status}. Must be "completed".`);
  }

  // For now, mark as refunded in our DB.
  // CinetPay refunds are manual (dashboard). Wave refunds need separate API call.
  await db
    .update(transactions)
    .set({
      status: "refunded",
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, tx.id));

  await db.insert(auditLog).values({
    transactionId: tx.id,
    action: "refunded",
    details: { reason: reason || "No reason provided" },
  });

  return {
    transactionId: tx.id,
    provider: tx.provider,
    status: "refunded",
    amount: tx.amount,
    currency: tx.currency,
    note:
      tx.provider === "cinetpay"
        ? "CinetPay refunds must be processed manually via the CinetPay dashboard"
        : "Refund recorded",
  };
}
