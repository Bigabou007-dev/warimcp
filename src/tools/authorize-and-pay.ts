import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { verifyMandate } from "../bridge/authorization.js";
import { getConfig } from "../config.js";
import { initiatePayment } from "./initiate-payment.js";
import type { AuthorizeAndPayInput } from "./definitions.js";

// Module-level nonce store — production moves this to a DB-backed unique index on nonces.
const seenNonces = new Set<string>();

export type AuthorizeAndPayResult =
  | { authorized: true; payment: Awaited<ReturnType<typeof initiatePayment>> }
  | {
      authorized: false;
      reason: "bad_signature" | "expired" | "replayed" | "no_trusted_keys_configured";
      payment?: undefined;
    };

/**
 * Parse WARIMCP_TRUSTED_AGENT_KEYS into individual PEM blocks.
 * Accepts comma- or newline-separated concatenations; literal \n escapes
 * (common in env files) are normalized first. Extracting BEGIN..END blocks
 * makes the separator irrelevant and ignores stray whitespace/commas.
 */
function parseTrustedKeys(raw: string): string[] {
  const normalized = raw.replace(/\\n/g, "\n");
  return normalized.match(/-----BEGIN PUBLIC KEY-----[\s\S]+?-----END PUBLIC KEY-----/g) ?? [];
}

export async function handleAuthorizeAndPay(
  db: PostgresJsDatabase,
  input: AuthorizeAndPayInput
): Promise<AuthorizeAndPayResult> {
  const { mandate, signature, provider, customerPhone, customerEmail, returnUrl, notifyUrl } = input;

  // Trust anchor: the verification key comes ONLY from the server-side allowlist —
  // never from caller input, or any caller could self-sign mandates. Fail closed
  // when no keys are configured.
  const trustedKeys = parseTrustedKeys(getConfig().WARIMCP_TRUSTED_AGENT_KEYS);
  if (trustedKeys.length === 0) {
    return { authorized: false, reason: "no_trusted_keys_configured" };
  }

  // Verify the mandate against each trusted key (accept if any verifies).
  // verifyMandate stays a pure single-key primitive; iteration lives here.
  // If a key matches the signature but fails expiry/replay, surface that
  // reason instead of the generic bad_signature.
  const nowMs = Date.now();
  let failureReason: "bad_signature" | "expired" | "replayed" = "bad_signature";
  let verified = false;
  for (const key of trustedKeys) {
    const v = verifyMandate(mandate, signature, key, { nowMs, seenNonces });
    if (v.ok) {
      verified = true;
      break;
    }
    if (v.reason !== "bad_signature") failureReason = v.reason;
  }

  if (!verified) {
    // On failure return the reason WITHOUT touching provider or DB.
    return { authorized: false, reason: failureReason };
  }

  // Call initiate-payment with nonce as idempotency key (replay-safe by construction).
  const payment = await initiatePayment(db, {
    provider,
    amount: mandate.amount,
    currency: mandate.currency,
    idempotencyKey: mandate.nonce,
    description: `Mandate ${mandate.merchantRef}`,
    // KNOWN GAP (spike): phone stands in for customer name. Production: the mandate
    // should carry customer identity — tracked for Track 4 product spec.
    customerName: customerPhone,
    customerEmail: customerEmail ?? "",
    customerPhone,
    returnUrl,
    notifyUrl,
    // Intentionally empty for the bridge path: the agent flow uses notifyUrl for
    // provider webhooks; a mandate carries no merchant callback URL.
    callbackUrl: "",
    metadata: { provider, mandateMerchantRef: mandate.merchantRef },
    fundsSource: "fiat",
  });

  // Mark the nonce as seen only AFTER the payment path succeeds — a provider/db
  // failure must NOT consume the nonce, or a legitimate retry of the same mandate
  // would be rejected as "replayed" forever. The race window this opens (two
  // concurrent same-nonce calls both passing verification) is closed by
  // idempotencyKey = mandate.nonce deduplication in the payment path.
  seenNonces.add(mandate.nonce);

  return { authorized: true, payment };
}
