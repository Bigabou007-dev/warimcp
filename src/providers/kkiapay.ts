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

const BASE_URL = "https://api.kkiapay.me/api/v1";

export class KKiaPayProvider implements BaseProvider {
  readonly name = "kkiapay";
  readonly label = "KKiaPay";

  info(): ProviderInfo {
    return {
      name: this.name,
      label: this.label,
      configured: this.isConfigured(),
      supportedCurrencies: ["XOF", "XAF"],
      supportedCountries: ["CI", "SN", "BJ", "BF", "ML", "TG", "NE", "GW"],
      supportedMethods: ["MTN_MOBILE_MONEY", "ORANGE_MONEY", "WAVE", "CARD"],
    };
  }

  isConfigured(): boolean {
    return !!getConfig().KKIAPAY_PRIVATE_KEY;
  }

  private headers() {
    return {
      "X-API-Key": getConfig().KKIAPAY_PRIVATE_KEY,
      "Content-Type": "application/json",
    };
  }

  async initiatePayment(input: PaymentInitiateInput): Promise<PaymentInitiateResult> {
    if (!this.isConfigured()) {
      throw new Error("KKiaPay not configured: KKIAPAY_PRIVATE_KEY required");
    }

    const payload = {
      amount: input.amount,
      reason: input.description,
      phone_number: input.customerPhone,
      name: input.customerName,
      email: input.customerEmail,
      callback_url: input.notifyUrl,
      return_url: input.returnUrl,
      external_transaction_id: input.idempotencyKey,
    };

    const data = await withRetry(async () => {
      const res = await fetch(`${BASE_URL}/transactions/request-payment`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new HttpError(`KKiaPay HTTP ${res.status}: ${await res.text()}`, res.status);
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    return {
      providerReference: (data?.transactionId as string) || "",
      paymentUrl: (data?.payment_url as string) || "",
      status: (data?.status as string) || "pending",
      raw: data,
    };
  }

  async verifyPayment(providerReference: string): Promise<PaymentVerifyResult> {
    if (!this.isConfigured()) {
      throw new Error("KKiaPay not configured");
    }

    const data = await withRetry(async () => {
      const res = await fetch(`${BASE_URL}/transactions/status/${providerReference}`, {
        method: "GET",
        headers: this.headers(),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new HttpError(`KKiaPay verify HTTP ${res.status}`, res.status);
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    const kkState = data?.state;
    let status: PaymentVerifyResult["status"] = "pending";
    if (kkState === "SUCCESS") status = "completed";
    else if (kkState === "FAILED") status = "failed";

    return {
      providerReference,
      status,
      amount: data?.amount ? Number(data.amount) : undefined,
      currency: (data?.currency as string) || undefined,
      paymentMethod: data?.source as string | undefined,
      raw: data,
    };
  }

  async initiatePayout(input: PayoutInitiateInput): Promise<PayoutInitiateResult> {
    if (!this.isConfigured()) {
      throw new Error("KKiaPay not configured");
    }

    const payload = {
      amount: input.amount,
      phone_number: input.recipientPhone,
      reason: "Payout",
      external_transaction_id: input.idempotencyKey,
    };

    const data = await withRetry(async () => {
      const res = await fetch(`${BASE_URL}/transactions/payout`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new HttpError(`KKiaPay payout HTTP ${res.status}: ${await res.text()}`, res.status);
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    return {
      providerReference: (data?.transactionId as string) || "",
      status: (data?.status as string) || "pending",
      raw: data,
    };
  }

  async verifyPayout(providerReference: string): Promise<PayoutVerifyResult> {
    if (!this.isConfigured()) {
      throw new Error("KKiaPay not configured");
    }

    const data = await withRetry(async () => {
      const res = await fetch(`${BASE_URL}/transactions/status/${providerReference}`, {
        method: "GET",
        headers: this.headers(),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new HttpError(`KKiaPay payout verify HTTP ${res.status}`, res.status);
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    let status: PayoutVerifyResult["status"] = "pending";
    if (data?.state === "SUCCESS") status = "completed";
    else if (data?.state === "FAILED") status = "failed";

    return { providerReference, status, raw: data };
  }
}
