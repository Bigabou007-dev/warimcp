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

export class FedaPayProvider implements BaseProvider {
  readonly name = "fedapay";
  readonly label = "FedaPay";

  info(): ProviderInfo {
    return {
      name: this.name,
      label: this.label,
      configured: this.isConfigured(),
      supportedCurrencies: ["XOF", "XAF", "GNF"],
      supportedCountries: ["CI", "SN", "BJ", "TG", "BF", "ML", "NE", "GW"],
      supportedMethods: ["MTN_MOBILE_MONEY", "ORANGE_MONEY", "MOOV", "WAVE", "CARD"],
    };
  }

  isConfigured(): boolean {
    return !!getConfig().FEDAPAY_SECRET_KEY;
  }

  private baseUrl(): string {
    const config = getConfig();
    return config.WARIMCP_MODE === "live"
      ? "https://api.fedapay.com/v1"
      : "https://sandbox-api.fedapay.com/v1";
  }

  private headers() {
    return {
      Authorization: `Bearer ${getConfig().FEDAPAY_SECRET_KEY}`,
      "Content-Type": "application/json",
    };
  }

  async initiatePayment(input: PaymentInitiateInput): Promise<PaymentInitiateResult> {
    if (!this.isConfigured()) {
      throw new Error("FedaPay not configured: FEDAPAY_SECRET_KEY required");
    }

    const base = this.baseUrl();

    // Step 1: Create the transaction
    const payload = {
      description: input.description,
      amount: input.amount,
      currency: { iso: input.currency },
      callback_url: input.notifyUrl,
      return_url: input.returnUrl,
      customer: {
        firstname: input.customerName,
        lastname: "",
        email: input.customerEmail,
        phone_number: { number: input.customerPhone, country: "CI" },
      },
    };

    const txData = await withRetry(async () => {
      const res = await fetch(`${base}/transactions`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new HttpError(`FedaPay HTTP ${res.status}: ${await res.text()}`, res.status);
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    const transaction = txData?.["v1/transaction"] as Record<string, unknown> | undefined;
    const transactionId = transaction?.id ? String(transaction.id) : "";

    if (!transactionId) {
      throw new Error("FedaPay: no transaction ID returned");
    }

    // Step 2: Generate payment token for the transaction
    const tokenData = await withRetry(async () => {
      const res = await fetch(`${base}/transactions/${transactionId}/token`, {
        method: "POST",
        headers: this.headers(),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new HttpError(`FedaPay token HTTP ${res.status}: ${await res.text()}`, res.status);
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    const paymentUrl = (tokenData?.url as string) || "";

    return {
      providerReference: transactionId,
      paymentUrl,
      status: (transaction?.status as string) || "pending",
      raw: { transaction: txData, token: tokenData },
    };
  }

  async verifyPayment(providerReference: string): Promise<PaymentVerifyResult> {
    if (!this.isConfigured()) {
      throw new Error("FedaPay not configured");
    }

    const data = await withRetry(async () => {
      const res = await fetch(`${this.baseUrl()}/transactions/${providerReference}`, {
        method: "GET",
        headers: this.headers(),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new HttpError(`FedaPay verify HTTP ${res.status}`, res.status);
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    const transaction = data?.["v1/transaction"] as Record<string, unknown> | undefined;
    const fedaStatus = transaction?.status as string | undefined;

    let status: PaymentVerifyResult["status"] = "pending";
    if (fedaStatus === "approved" || fedaStatus === "transferred") status = "completed";
    else if (fedaStatus === "declined" || fedaStatus === "canceled") status = "failed";
    else if (fedaStatus === "refunded") status = "refunded";

    const currency = transaction?.currency as Record<string, unknown> | undefined;

    return {
      providerReference,
      status,
      amount: transaction?.amount ? Number(transaction.amount) : undefined,
      currency: (currency?.iso as string) || undefined,
      paymentMethod: "FEDAPAY",
      raw: data,
    };
  }

  async initiatePayout(input: PayoutInitiateInput): Promise<PayoutInitiateResult> {
    if (!this.isConfigured()) {
      throw new Error("FedaPay not configured");
    }

    const payload = {
      amount: input.amount,
      currency: { iso: input.currency },
      mode: "mtn_ci",
      customer: {
        firstname: input.recipientName,
        lastname: "",
        email: "",
        phone_number: { number: input.recipientPhone, country: "CI" },
      },
    };

    const data = await withRetry(async () => {
      const res = await fetch(`${this.baseUrl()}/payouts`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new HttpError(`FedaPay payout HTTP ${res.status}: ${await res.text()}`, res.status);
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    const payout = data?.["v1/payout"] as Record<string, unknown> | undefined;

    return {
      providerReference: payout?.id ? String(payout.id) : "",
      status: (payout?.status as string) || "pending",
      raw: data,
    };
  }

  async verifyPayout(providerReference: string): Promise<PayoutVerifyResult> {
    if (!this.isConfigured()) {
      throw new Error("FedaPay not configured");
    }

    const data = await withRetry(async () => {
      const res = await fetch(`${this.baseUrl()}/payouts/${providerReference}`, {
        method: "GET",
        headers: this.headers(),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new HttpError(`FedaPay payout verify HTTP ${res.status}`, res.status);
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    const payout = data?.["v1/payout"] as Record<string, unknown> | undefined;
    const fedaStatus = payout?.status as string | undefined;

    let status: PayoutVerifyResult["status"] = "pending";
    if (fedaStatus === "sent" || fedaStatus === "approved") status = "completed";
    else if (fedaStatus === "declined") status = "failed";

    return { providerReference, status, raw: data };
  }
}
