import crypto from "node:crypto";
import { getConfig } from "../config.js";

/**
 * CinetPay webhook verification.
 * CinetPay signs webhooks with HMAC-SHA256 using the API key.
 * Falls back to site_id-only check when no API key or signature header is present.
 */
export function verifyCinetPayWebhook(
  body: Record<string, unknown>,
  rawBody?: string,
  signatureHeader?: string
): boolean {
  const config = getConfig();
  const siteId = body.cpm_site_id || body.site_id;

  // Site ID check (always required when available)
  const siteIdValid =
    !!siteId && !!config.CINETPAY_SITE_ID && String(siteId) === config.CINETPAY_SITE_ID;

  // If no API key configured or no signature header, fall back to site_id-only check
  if (!config.CINETPAY_API_KEY || !signatureHeader || !rawBody) {
    return siteIdValid;
  }

  // HMAC-SHA256 verification
  const expected = crypto
    .createHmac("sha256", config.CINETPAY_API_KEY)
    .update(rawBody)
    .digest("hex");

  let hmacValid: boolean;
  try {
    hmacValid = crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signatureHeader, "hex")
    );
  } catch {
    return false;
  }

  // Both checks must pass
  return hmacValid && siteIdValid;
}

export function parseCinetPayEvent(body: Record<string, unknown>) {
  const transactionId = String(body.cpm_trans_id || body.transaction_id || "");
  const status = String(body.cpm_trans_status || "");

  let normalizedStatus: string;
  if (status === "00") normalizedStatus = "completed";
  else if (status === "ACCEPTED") normalizedStatus = "completed";
  else if (status === "REFUSED" || status === "CANCELLED") normalizedStatus = "failed";
  else normalizedStatus = "pending";

  return {
    providerReference: transactionId,
    eventType: `payment.${normalizedStatus}`,
    status: normalizedStatus,
  };
}
