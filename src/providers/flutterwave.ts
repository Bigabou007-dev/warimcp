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

const BASE_URL = "https://api.flutterwave.com/v3";

export class FlutterwaveProvider implements BaseProvider {
  readonly name = "flutterwave";
  readonly label = "Flutterwave";

  info(): ProviderInfo {
    return {
      name: this.name,
      label: this.label,
      configured: this.isConfigured(),
      supportedCurrencies: ["XOF", "XAF", "NGN", "GHS", "KES", "USD", "EUR"],
      supportedCountries: ["CI", "SN", "ML", "BF", "NG", "GH", "KE", "TZ", "UG"],
      supportedMethods: ["MOBILE_MONEY", "CARD", "BANK_TRANSFER"],
    };
  }

  isConfigured(): boolean {
    return !!getConfig().FLUTTERWAVE_SECRET_KEY;
  }

  private headers() {
    return {
      Authorization: `Bearer ${getConfig().FLUTTERWAVE_SECRET_KEY}`,
      "Content-Type": "application/json",
    };
  }

  async initiatePayment(input: PaymentInitiateInput): Promise<PaymentInitiateResult> {
    if (!this.isConfigured()) {
      throw new Error("Flutterwave not configured: FLUTTERWAVE_SECRET_KEY required");
    }

    const payload = {
      tx_ref: input.idempotencyKey,
      amount: String(input.amount),
      currency: input.currency,
      redirect_url: input.returnUrl,
      customer: {
        email: input.customerEmail,
        name: input.customerName,
        phonenumber: input.customerPhone,
      },
      customizations: {
        title: input.description,
      },
      meta: input.metadata || {},
    };

    const data = await withRetry(async () => {
      const res = await fetch(`${BASE_URL}/payments`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new HttpError(`Flutterwave HTTP ${res.status}: ${await res.text()}`, res.status);
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    const nested = data?.data as Record<string, unknown> | undefined;

    return {
      providerReference: input.idempotencyKey,
      paymentUrl: (nested?.link as string) || "",
      status: (data?.status as string) || "pending",
      raw: data,
    };
  }

  async verifyPayment(providerReference: string): Promise<PaymentVerifyResult> {
    if (!this.isConfigured()) {
      throw new Error("Flutterwave not configured");
    }

    const data = await withRetry(async () => {
      const res = await fetch(
        `${BASE_URL}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(providerReference)}`,
        {
          method: "GET",
          headers: this.headers(),
          signal: AbortSignal.timeout(30_000),
        },
      );

      if (!res.ok) {
        throw new HttpError(`Flutterwave verify HTTP ${res.status}`, res.status);
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    const nested = data?.data as Record<string, unknown> | undefined;
    const fwStatus = nested?.status as string | undefined;

    let status: PaymentVerifyResult["status"] = "pending";
    if (fwStatus === "successful") status = "completed";
    else if (fwStatus === "failed") status = "failed";

    return {
      providerReference,
      status,
      amount: nested?.amount ? Number(nested.amount) : undefined,
      currency: nested?.currency as string | undefined,
      paymentMethod: (nested?.payment_type as string) || "FLUTTERWAVE",
      raw: data,
    };
  }

  async initiatePayout(input: PayoutInitiateInput): Promise<PayoutInitiateResult> {
    if (!this.isConfigured()) {
      throw new Error("Flutterwave not configured");
    }

    const bankCode = input.method === "mobile_money" ? "MPS" : "MPS"; // bank transfers require specific bank codes via metadata
    const payload = {
      account_bank: bankCode,
      account_number: input.recipientPhone,
      amount: input.amount,
      currency: input.currency,
      reference: input.idempotencyKey,
      beneficiary_name: input.recipientName,
      meta: [{ mobile_number: input.recipientPhone }],
    };

    const data = await withRetry(async () => {
      const res = await fetch(`${BASE_URL}/transfers`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new HttpError(`Flutterwave payout HTTP ${res.status}: ${await res.text()}`, res.status);
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    const nested = data?.data as Record<string, unknown> | undefined;

    return {
      providerReference: nested?.id ? String(nested.id) : "",
      status: (nested?.status as string) || "pending",
      raw: data,
    };
  }

  async verifyPayout(providerReference: string): Promise<PayoutVerifyResult> {
    if (!this.isConfigured()) {
      throw new Error("Flutterwave not configured");
    }

    const data = await withRetry(async () => {
      const res = await fetch(`${BASE_URL}/transfers/${providerReference}`, {
        method: "GET",
        headers: this.headers(),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new HttpError(`Flutterwave payout verify HTTP ${res.status}`, res.status);
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    const nested = data?.data as Record<string, unknown> | undefined;
    const fwStatus = nested?.status as string | undefined;

    let status: PayoutVerifyResult["status"] = "pending";
    if (fwStatus === "SUCCESSFUL") status = "completed";
    else if (fwStatus === "FAILED") status = "failed";

    return { providerReference, status, raw: data };
  }
}
