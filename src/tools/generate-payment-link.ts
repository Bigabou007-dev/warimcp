import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { generateIdempotencyKey } from "../utils/idempotency.js";
import { initiatePayment } from "./initiate-payment.js";
import type { GeneratePaymentLinkInput } from "./definitions.js";

export async function generatePaymentLink(
  db: PostgresJsDatabase,
  input: GeneratePaymentLinkInput
) {
  const result = await initiatePayment(db, {
    provider: input.provider,
    amount: input.amount,
    currency: input.currency,
    idempotencyKey: generateIdempotencyKey(),
    description: input.description,
    customerName: "Payment Link",
    customerEmail: "",
    customerPhone: "",
    returnUrl: "",
    notifyUrl: "",
    callbackUrl: "",
    metadata: { ...input.metadata, type: "payment_link" },
    // I5 wallet discipline: propagate validated funds-source fields downstream
    fundsSource: input.fundsSource,
    agentWalletSignature: input.agentWalletSignature,
    walletProvider: input.walletProvider,
  });

  return {
    transactionId: result.transactionId,
    paymentUrl: result.paymentUrl,
    amount: input.amount,
    currency: input.currency,
    provider: result.provider,
  };
}
