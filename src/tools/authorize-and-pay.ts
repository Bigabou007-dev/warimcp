import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { verifyMandate, type PaymentMandate } from "../bridge/authorization.js";
import { initiatePayment } from "./initiate-payment.js";

// Module-level nonce store — replay-safe by construction (mandate.nonce doubles as
// idempotency key). Production moves this to a DB-backed unique-index on nonces.
const seenNonces = new Set<string>();

export interface AuthorizeAndPayInput {
  mandate: PaymentMandate;
  signature: string;
  agentPublicKeyPem: string;
  provider: string;
  customerPhone: string;
  customerEmail?: string;
  returnUrl: string;
  notifyUrl: string;
}

export type AuthorizeAndPayResult =
  | { authorized: true; payment: Awaited<ReturnType<typeof initiatePayment>> }
  | { authorized: false; reason: "bad_signature" | "expired" | "replayed"; payment?: undefined };

export async function handleAuthorizeAndPay(
  db: PostgresJsDatabase,
  input: AuthorizeAndPayInput
): Promise<AuthorizeAndPayResult> {
  const { mandate, signature, agentPublicKeyPem, provider, customerPhone, customerEmail, returnUrl, notifyUrl } = input;

  // Verify mandate — on failure return reason WITHOUT touching provider or DB.
  const verification = verifyMandate(mandate, signature, agentPublicKeyPem, {
    nowMs: Date.now(),
    seenNonces,
  });

  if (!verification.ok) {
    return { authorized: false, reason: verification.reason };
  }

  // Mark nonce as seen immediately — caller (this function) is responsible per authorization.ts contract.
  seenNonces.add(mandate.nonce);

  // Call initiate-payment with nonce as idempotency key (replay-safe by construction).
  const payment = await initiatePayment(db, {
    provider,
    amount: mandate.amount,
    currency: mandate.currency,
    idempotencyKey: mandate.nonce,
    description: `Mandate ${mandate.merchantRef}`,
    customerName: customerPhone, // phone used as name when no name in mandate
    customerEmail: customerEmail ?? "",
    customerPhone,
    returnUrl,
    notifyUrl,
    callbackUrl: "",
    metadata: { provider, mandateMerchantRef: mandate.merchantRef },
    fundsSource: "fiat",
  });

  return { authorized: true, payment };
}
