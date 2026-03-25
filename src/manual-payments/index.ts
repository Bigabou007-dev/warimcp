/**
 * Manual Payment Collection — pre-RCCM solution.
 *
 * Uses unique amounts (base + 1–99 XOF suffix) as reference codes
 * to match personal Wave/Orange Money transfers to specific orders
 * without API access.
 */

export {
  generatePaymentReference,
  matchPayment,
  markReferenceAsPaid,
  getReference,
  expireStaleReferences,
  getActiveReferences,
  type PaymentReference,
} from "./reference-generator.js";

export { smsWebhookRouter } from "./sms-webhook.js";
export { paymentPageRouter } from "./payment-page.js";
