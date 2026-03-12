import crypto from "node:crypto";
import { getConfig } from "../config.js";

/**
 * Wave webhook verification.
 * Wave signs webhooks with HMAC-SHA256 using the webhook secret.
 */
export function verifyWaveWebhook(
  rawBody: string,
  signatureHeader: string | undefined
): boolean {
  const config = getConfig();
  if (!config.WAVE_WEBHOOK_SECRET || !signatureHeader) return false;

  const expected = crypto
    .createHmac("sha256", config.WAVE_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signatureHeader, "hex")
    );
  } catch {
    return false;
  }
}

export function parseWaveEvent(body: Record<string, unknown>) {
  const data = (body.data || body) as Record<string, unknown>;
  const sessionId = String(data.id || data.checkout_session_id || "");
  const type = String(body.type || "");

  let normalizedStatus: string;
  if (type === "checkout.session.completed") normalizedStatus = "completed";
  else if (type === "checkout.session.failed") normalizedStatus = "failed";
  else normalizedStatus = "pending";

  return {
    providerReference: sessionId,
    eventType: `payment.${normalizedStatus}`,
    status: normalizedStatus,
  };
}
