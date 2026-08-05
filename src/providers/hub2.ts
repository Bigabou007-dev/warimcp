import { getConfig } from "../config.js";
import { HttpError } from "../utils/http-error.js";
import type {
  BaseProvider,
  PaymentInitiateInput,
  PaymentInitiateResult,
  PaymentVerifyResult,
  PayoutInitiateInput,
  PayoutInitiateResult,
  PayoutVerifyResult,
  ProviderInfo,
} from "./base.js";

const HUB2_STATUS_MAP: Record<string, "pending" | "processing" | "completed" | "failed"> = {
  payment_required: "pending",
  processing: "processing",
  succeeded: "completed",
  successful: "completed",
  failed: "failed",
  expired: "failed",
};

export function normalizeHub2Status(s: string): "pending" | "processing" | "completed" | "failed" {
  const mapped = HUB2_STATUS_MAP[s];
  if (mapped === undefined) {
    throw new Error(`Unknown Hub2 status: "${s}" — add to HUB2_STATUS_MAP if Hub2 introduced a new wire value`);
  }
  return mapped;
}

/**
 * Normalize an MSISDN to the shape Hub2 accepts.
 *
 * Contract (three named cases + lenient fallback):
 * 1. CIV E.164 (`+225` + 10 digits, whitespace ignored) → strip `+225` to bare local (`0XXXXXXXXX`).
 * 2. CIV country-code without plus (`225` + 10 digits) → strip `225` to bare local.
 * 3. CIV local (`0XXXXXXXXX`) and 8-digit sandbox magic numbers (e.g. `00000001`) → pass through
 *    untouched via the fallback.
 * Fallback (everything else, incl. non-CIV E.164 and empty string): lenient passthrough that only
 * strips a leading `+` — it NEVER throws. This is deliberate, mirroring the battle-tested
 * lagoon-website implementation: Hub2's accept-set is lenient, and rejecting here would break
 * sandbox-magic and non-CIV corridors that Hub2 itself accepts.
 */
export function normalizeMsisdnForHub2(input: string): string {
  const trimmed = input.replace(/\s+/g, "");
  if (/^\+225\d{10}$/.test(trimmed)) return trimmed.slice(4);
  if (/^225\d{10}$/.test(trimmed)) return trimmed.slice(3);
  return trimmed.replace(/^\+/, "");
}

export class Hub2Provider implements BaseProvider {
  readonly name = "hub2";
  readonly label = "Hub2 / Ecobank";

  info(): ProviderInfo {
    return {
      name: this.name,
      label: this.label,
      configured: this.isConfigured(),
      supportedCurrencies: ["XOF", "XAF"],
      supportedCountries: ["CI", "SN", "ML", "BF", "TG", "BJ", "NE", "CM"],
      supportedMethods: ["MOBILE_MONEY"],
    };
  }

  isConfigured(): boolean {
    const config = getConfig();
    return !!(config.HUB2_API_KEY && config.HUB2_MERCHANT_ID);
  }

  private baseUrl(): string {
    return getConfig().HUB2_BASE_URL || "https://api.hub2.io";
  }

  private serverHeaders(): Record<string, string> {
    const config = getConfig();
    return {
      ApiKey: config.HUB2_API_KEY,
      MerchantId: config.HUB2_MERCHANT_ID,
      Environment: config.WARIMCP_MODE === "live" ? "live" : "sandbox",
      "Content-Type": "application/json",
    };
  }

  private tokenHeaders(token: string): Record<string, string> {
    const config = getConfig();
    return {
      Authorization: `Bearer ${token}`,
      Environment: config.WARIMCP_MODE === "live" ? "live" : "sandbox",
      "Content-Type": "application/json",
    };
  }

  async initiatePayment(input: PaymentInitiateInput): Promise<PaymentInitiateResult> {
    if (!this.isConfigured()) {
      throw new Error("Hub2 not configured: HUB2_API_KEY and HUB2_MERCHANT_ID required");
    }

    // Validate customerReference before any network call
    const customerReference = input.customerEmail || input.customerPhone;
    if (!customerReference) {
      throw new Error("Hub2: customerReference must be non-empty (set customerEmail or customerPhone)");
    }

    const provider = (input.metadata?.provider as string) || "mtn";

    // Wave requires https redirect URLs — validate before first network call
    if (provider === "wave") {
      if (!input.returnUrl || !input.returnUrl.startsWith("https://")) {
        throw new Error("Hub2 Wave: returnUrl must use https (Wave redirect URLs must be https)");
      }
    }

    const base = this.baseUrl();

    // Step 1: Create payment intent (server-mode headers: ApiKey + MerchantId)
    const intentPayload: Record<string, unknown> = {
      amount: input.amount,
      currency: input.currency,
      purchaseReference: input.idempotencyKey,
      customerReference,
    };

    // NO retry: non-idempotent POST, double-charge risk. If Hub2 created the intent
    // but the response was lost (5xx / network error), an automatic retry would
    // double-create it. The caller retries from scratch with the same idempotencyKey;
    // Hub2's purchaseReference idempotency semantics are unverified.
    const intentRes = await fetch(`${base}/payment-intents`, {
      method: "POST",
      headers: this.serverHeaders(),
      body: JSON.stringify(intentPayload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!intentRes.ok) {
      throw new HttpError(`Hub2 intent HTTP ${intentRes.status}: ${await intentRes.text()}`, intentRes.status);
    }

    const intentData = (await intentRes.json()) as Record<string, unknown>;

    const intentId = intentData.id as string;
    const token = intentData.token as string;
    const intentStatus = intentData.status as string;

    if (!intentId || !token) {
      throw new Error("Hub2: no intent id or token returned from payment-intents");
    }

    // Step 2: Attempt payment (token-mode headers: Authorization Bearer — NO ApiKey/MerchantId)
    const msisdn = normalizeMsisdnForHub2(input.customerPhone);

    const mobileMoney: Record<string, unknown> = { msisdn };

    if (provider === "wave") {
      mobileMoney.onSuccessRedirectionUrl = input.returnUrl;
      mobileMoney.onFailedRedirectionUrl = input.returnUrl;
      // onFinishRedirectionUrl is NOT a real Hub2 field — never send it
    }

    const attemptPayload: Record<string, unknown> = {
      token,
      paymentMethod: "mobile_money",
      country: "CI",
      provider,
      mobileMoney,
    };

    // NO retry: non-idempotent POST, double-charge risk — this is the call that
    // triggers the mobile-money debit. Same policy as the intent POST above.
    const attemptRes = await fetch(`${base}/payment-intents/${intentId}/payments`, {
      method: "POST",
      headers: this.tokenHeaders(token),
      body: JSON.stringify(attemptPayload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!attemptRes.ok) {
      throw new HttpError(`Hub2 attempt HTTP ${attemptRes.status}: ${await attemptRes.text()}`, attemptRes.status);
    }

    const attemptData = (await attemptRes.json()) as Record<string, unknown>;

    const attemptStatus = attemptData.status as string | undefined;
    const payments = attemptData.payments as Array<Record<string, unknown>> | undefined;

    // Extract redirect URL: payments[0].nextAction.url with top-level nextAction.url fallback
    let paymentUrl = "";
    if (payments && payments.length > 0) {
      const nextAction = payments[0].nextAction as Record<string, unknown> | null | undefined;
      if (nextAction?.url) {
        paymentUrl = nextAction.url as string;
      }
    }
    if (!paymentUrl) {
      const topNextAction = attemptData.nextAction as Record<string, unknown> | null | undefined;
      if (topNextAction?.url) {
        paymentUrl = topNextAction.url as string;
      }
    }

    // Determine normalized status: prefer attempt status, fall back to intent status
    let normalizedStatus: string;
    const rawStatus = attemptStatus || intentStatus;
    try {
      normalizedStatus = normalizeHub2Status(rawStatus);
    } catch {
      // If status is unknown, pass through raw rather than throwing
      normalizedStatus = rawStatus || "pending";
    }

    return {
      providerReference: intentId,
      paymentUrl,
      status: normalizedStatus,
      raw: { intent: intentData, attempt: attemptData },
    };
  }

  async verifyPayment(providerReference: string): Promise<PaymentVerifyResult> {
    if (!this.isConfigured()) {
      throw new Error("Hub2 not configured: HUB2_API_KEY and HUB2_MERCHANT_ID required");
    }

    const base = this.baseUrl();

    // GET endpoint shape not exercised by lagoon-website — Task 7's sandbox smoke confirms it.
    const res = await fetch(`${base}/payment-intents/${providerReference}`, {
      method: "GET",
      headers: this.serverHeaders(),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      throw new HttpError(`Hub2 verify HTTP ${res.status}: ${await res.text()}`, res.status);
    }

    const data = (await res.json()) as Record<string, unknown>;

    const status = normalizeHub2Status(data.status as string);
    const amount = data.amount as number | undefined;
    const currency = data.currency as string | undefined;

    return {
      providerReference,
      status,
      amount,
      currency,
      paymentMethod: "HUB2",
      raw: data,
    };
  }

  async initiatePayout(_input: PayoutInitiateInput): Promise<PayoutInitiateResult> {
    throw new Error("Hub2 payouts not supported in v1");
  }

  async verifyPayout(_ref: string): Promise<PayoutVerifyResult> {
    throw new Error("Hub2 payouts not supported in v1");
  }
}
