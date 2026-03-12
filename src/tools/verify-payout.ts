import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { payouts, auditLog } from "../db/schema.js";
import { getProvider } from "../providers/registry.js";

export async function verifyPayout(
  db: PostgresJsDatabase,
  payoutId: string
) {
  const [po] = await db
    .select()
    .from(payouts)
    .where(eq(payouts.id, payoutId))
    .limit(1);

  if (!po) {
    throw new Error(`Payout not found: ${payoutId}`);
  }

  if (po.status === "completed" || po.status === "failed") {
    return {
      payoutId: po.id,
      provider: po.provider,
      status: po.status,
      amount: po.amount,
      currency: po.currency,
    };
  }

  if (!po.providerReference) {
    return {
      payoutId: po.id,
      provider: po.provider,
      status: po.status,
      amount: po.amount,
      currency: po.currency,
    };
  }

  const provider = getProvider(po.provider);
  const result = await provider.verifyPayout(po.providerReference);

  if (result.status !== po.status) {
    await db
      .update(payouts)
      .set({
        status: result.status,
        completedAt: result.status === "completed" ? new Date() : undefined,
      })
      .where(eq(payouts.id, po.id));

    await db.insert(auditLog).values({
      action: "payout_verified",
      details: { payoutId: po.id, oldStatus: po.status, newStatus: result.status },
    });
  }

  return {
    payoutId: po.id,
    provider: po.provider,
    status: result.status,
    amount: po.amount,
    currency: po.currency,
  };
}
