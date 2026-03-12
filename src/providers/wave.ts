import { getConfig } from "../config.js";
import { withRetry } from "./retry.js";
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
        const err = new Error(`Wave HTTP ${res.status}: ${await res.text()}`);
        (err as any).status = res.status;
        throw err;
      }

      return res.json() as Promise<any>;
    });

    return {
      providerReference: data?.id || "",
      paymentUrl: data?.wave_launch_url || "",
      status: data?.payment_status || "pending",
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
        const err = new Error(`Wave verify HTTP ${res.status}`);
        (err as any).status = res.status;
        throw err;
      }

      return res.json() as Promise<any>;
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
      currency: data?.currency,
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
        const err = new Error(`Wave payout HTTP ${res.status}: ${await res.text()}`);
        (err as any).status = res.status;
        throw err;
      }

      return res.json() as Promise<any>;
    });

    return {
      providerReference: data?.id || "",
      status: data?.status || "pending",
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
        const err = new Error(`Wave payout verify HTTP ${res.status}`);
        (err as any).status = res.status;
        throw err;
      }

      return res.json() as Promise<any>;
    });

    let status: PayoutVerifyResult["status"] = "pending";
    if (data?.status === "completed") status = "completed";
    else if (data?.status === "failed") status = "failed";
    else if (data?.status === "processing") status = "processing";

    return { providerReference, status, raw: data };
  }
}
