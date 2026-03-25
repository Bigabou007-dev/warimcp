import { getConfig } from "../config.js";
import { withRetry } from "./retry.js";
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

const BASE_URL = "https://api.moneroo.io/v1";

export class MonerooProvider implements BaseProvider {
  readonly name = "moneroo";
  readonly label = "Moneroo";

  info(): ProviderInfo {
    return {
      name: this.name,
      label: this.label,
      configured: this.isConfigured(),
      supportedCurrencies: ["XOF", "XAF", "GNF", "CDF", "NGN", "GHS", "KES", "USD", "EUR"],
      supportedCountries: ["CI", "SN", "BJ", "BF", "ML", "TG", "NE", "GW", "CM", "CD", "GN", "NG", "GH", "KE"],
      supportedMethods: ["MTN_MOBILE_MONEY", "ORANGE_MONEY", "WAVE", "MOOV", "CARD", "BANK_TRANSFER"],
    };
  }

  isConfigured(): boolean {
    return !!getConfig().MONEROO_SECRET_KEY;
  }

  private headers() {
    return {
      Authorization: `Bearer ${getConfig().MONEROO_SECRET_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  async initiatePayment(input: PaymentInitiateInput): Promise<PaymentInitiateResult> {
    if (!this.isConfigured()) {
      throw new Error("Moneroo not configured: MONEROO_SECRET_KEY required");
    }

    const payload = {
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      customer: {
        email: input.customerEmail,
        first_name: input.customerName,
        last_name: "",
        phone: input.customerPhone,
      },
      return_url: input.returnUrl,
      metadata: { idempotency_key: input.idempotencyKey, ...input.metadata },
    };

    const data = await withRetry(async () => {
      const res = await fetch(`${BASE_URL}/payments/initialize`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new HttpError(`Moneroo HTTP ${res.status}: ${await res.text()}`, res.status);
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    const nested = data?.data as Record<string, unknown> | undefined;

    return {
      providerReference: (nested?.id as string) || "",
      paymentUrl: (nested?.checkout_url as string) || "",
      status: (data?.status as string) || "pending",
      raw: data,
    };
  }

  async verifyPayment(providerReference: string): Promise<PaymentVerifyResult> {
    if (!this.isConfigured()) {
      throw new Error("Moneroo not configured");
    }

    const data = await withRetry(async () => {
      const res = await fetch(`${BASE_URL}/payments/${providerReference}`, {
        method: "GET",
        headers: this.headers(),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new HttpError(`Moneroo verify HTTP ${res.status}`, res.status);
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    const nested = data?.data as Record<string, unknown> | undefined;
    const monerooStatus = nested?.status as string | undefined;

    let status: PaymentVerifyResult["status"] = "pending";
    if (monerooStatus === "success") status = "completed";
    else if (monerooStatus === "failed") status = "failed";

    return {
      providerReference,
      status,
      amount: nested?.amount ? Number(nested.amount) : undefined,
      currency: nested?.currency as string | undefined,
      paymentMethod: "MONEROO",
      raw: data,
    };
  }

  async initiatePayout(input: PayoutInitiateInput): Promise<PayoutInitiateResult> {
    if (!this.isConfigured()) {
      throw new Error("Moneroo not configured");
    }

    const payload = {
      amount: input.amount,
      currency: input.currency,
      description: "Payout",
      customer: {
        email: "",
        first_name: input.recipientName,
        last_name: "",
        phone: input.recipientPhone,
      },
      method: input.method === "mobile_money" ? "mtn_ci" : "mtn_ci",
      metadata: { idempotency_key: input.idempotencyKey, ...input.metadata },
    };

    const data = await withRetry(async () => {
      const res = await fetch(`${BASE_URL}/payouts/initialize`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new HttpError(`Moneroo payout HTTP ${res.status}: ${await res.text()}`, res.status);
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    const nested = data?.data as Record<string, unknown> | undefined;

    return {
      providerReference: (nested?.id as string) || "",
      status: (data?.status as string) || "pending",
      raw: data,
    };
  }

  async verifyPayout(providerReference: string): Promise<PayoutVerifyResult> {
    if (!this.isConfigured()) {
      throw new Error("Moneroo not configured");
    }

    const data = await withRetry(async () => {
      const res = await fetch(`${BASE_URL}/payouts/${providerReference}`, {
        method: "GET",
        headers: this.headers(),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new HttpError(`Moneroo payout verify HTTP ${res.status}`, res.status);
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    const nested = data?.data as Record<string, unknown> | undefined;
    const monerooStatus = nested?.status as string | undefined;

    let status: PayoutVerifyResult["status"] = "pending";
    if (monerooStatus === "success") status = "completed";
    else if (monerooStatus === "failed") status = "failed";

    return { providerReference, status, raw: data };
  }
}
