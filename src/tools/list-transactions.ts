import { eq, and, desc, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { transactions } from "../db/schema.js";
import type { ListTransactionsInput } from "./definitions.js";

export async function listTransactions(
  db: PostgresJsDatabase,
  input: ListTransactionsInput
) {
  const conditions = [];

  if (input.provider) {
    conditions.push(eq(transactions.provider, input.provider));
  }
  if (input.status) {
    conditions.push(eq(transactions.status, input.status));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const results = await db
    .select({
      id: transactions.id,
      provider: transactions.provider,
      type: transactions.type,
      status: transactions.status,
      amount: transactions.amount,
      currency: transactions.currency,
      customerName: transactions.customerName,
      description: transactions.description,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .where(where)
    .orderBy(desc(transactions.createdAt))
    .limit(input.limit)
    .offset(input.offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(where);

  return {
    transactions: results,
    total: count,
    limit: input.limit,
    offset: input.offset,
  };
}
