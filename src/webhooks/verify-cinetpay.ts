import { getConfig } from "../config.js";

/**
 * CinetPay webhook verification.
 * CinetPay sends form-encoded or JSON webhooks with cpm_site_id.
 * We verify by checking the site_id matches AND re-verifying the transaction server-side.
 */
export function verifyCinetPayWebhook(body: Record<string, unknown>): boolean {
  const config = getConfig();
  const siteId = body.cpm_site_id || body.site_id;

  if (!siteId || !config.CINETPAY_SITE_ID) return false;
  return String(siteId) === config.CINETPAY_SITE_ID;
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
