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

const BASE_URL = "https://api.wave.com/v1";

export class WaveProvider implements BaseProvider {
  readonly name = "wave";
  readonly label = "Wave";

  info(): ProviderInfo {
    return {
      name: this.name,
      label: this.label,
      configured: this.isConfigured(),
      supportedCurrencies: ["XOF"],
      supportedCountries: ["CI", "SN", "ML", "BF", "UG", "TZ"],
      supportedMethods: ["WAVE_MOBILE_MONEY"],
    };
  }

  isConfigured(): boolean {
    return !!getConfig().WAVE_API_KEY;
  }

  private headers() {
    return {
      Authorization: `Bearer ${getConfig().WAVE_API_KEY}`,
      "Content-Type": "application/json",
    };
  }

  async initiatePayment(input: PaymentInitiateInput): Promise<PaymentInitiateResult> {
    if (!this.isConfigured()) {
      throw new Error("Wave not configured: WAVE_API_KEY required");
    }

    const payload = {
      amount: String(input.amount),
      currency: input.currency,
      client_reference: input.idempotencyKey,
      success_url: input.returnUrl,
      error_url: input.returnUrl,
    };

    const data = await withRetry(async () => {
      const res = await fetch(`${BASE_URL}/checkout/sessions`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new HttpError(`Wave HTTP ${res.status}: ${await res.text()}`, res.status);
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    return {
      providerReference: (data?.id as string) || "",
      paymentUrl: (data?.wave_launch_url as string) || "",
      status: (data?.payment_status as string) || "pending",
      raw: data,
    };
  }

  async verifyPayment(providerReference: string): Promise<PaymentVerifyResult> {
    if (!this.isConfigured()) {
      throw new Error("Wave not configured");
    }

    const data = await withRetry(async () => {
      const res = await fetch(`${BASE_URL}/checkout/sessions/${providerReference}`, {
        method: "GET",
        headers: this.headers(),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new HttpError(`Wave verify HTTP ${res.status}`, res.status);
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    const waveStatus = data?.payment_status;
    let status: PaymentVerifyResult["status"] = "pending";
    if (waveStatus === "succeeded") status = "completed";
    else if (waveStatus === "failed" || waveStatus === "cancelled") status = "failed";
    else if (waveStatus === "processing") status = "processing";

    return {
      providerReference,
      status,
      amount: data?.amount ? Number(data.amount) : undefined,
      currency: data?.currency as string | undefined,
      paymentMethod: "WAVE_MOBILE_MONEY",
      raw: data,
    };
  }

  async initiatePayout(input: PayoutInitiateInput): Promise<PayoutInitiateResult> {
    if (!this.isConfigured()) {
      throw new Error("Wave not configured");
    }

    const payload = {
      currency: input.currency,
      receive_amount: String(input.amount),
      name: input.recipientName,
      mobile: input.recipientPhone,
      client_reference: input.idempotencyKey,
    };

    const data = await withRetry(async () => {
      const res = await fetch(`${BASE_URL}/payouts`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new HttpError(`Wave payout HTTP ${res.status}: ${await res.text()}`, res.status);
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    return {
      providerReference: (data?.id as string) || "",
      status: (data?.status as string) || "pending",
      raw: data,
    };
  }

  async verifyPayout(providerReference: string): Promise<PayoutVerifyResult> {
    if (!this.isConfigured()) {
      throw new Error("Wave not configured");
    }

    const data = await withRetry(async () => {
      const res = await fetch(`${BASE_URL}/payouts/${providerReference}`, {
        method: "GET",
        headers: this.headers(),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new HttpError(`Wave payout verify HTTP ${res.status}`, res.status);
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    let status: PayoutVerifyResult["status"] = "pending";
    if (data?.status === "completed") status = "completed";
    else if (data?.status === "failed") status = "failed";
    else if (data?.status === "processing") status = "processing";

    return { providerReference, status, raw: data };
  }
}
