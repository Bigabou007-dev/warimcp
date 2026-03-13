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

const BASE_URL = "https://api-checkout.cinetpay.com/v2";

export class CinetPayProvider implements BaseProvider {
  readonly name = "cinetpay";
  readonly label = "CinetPay";

  info(): ProviderInfo {
    return {
      name: this.name,
      label: this.label,
      configured: this.isConfigured(),
      supportedCurrencies: ["XOF", "XAF", "CDF", "GNF"],
      supportedCountries: ["CI", "SN", "ML", "BF", "TG", "BJ", "NE", "GN", "CM", "CG", "GA", "CD"],
      supportedMethods: ["MOBILE_MONEY", "CREDIT_CARD", "WALLET"],
    };
  }

  isConfigured(): boolean {
    const c = getConfig();
    return !!(c.CINETPAY_API_KEY && c.CINETPAY_SITE_ID);
  }

  private creds() {
    const c = getConfig();
    return { apikey: c.CINETPAY_API_KEY, site_id: c.CINETPAY_SITE_ID };
  }

  async initiatePayment(input: PaymentInitiateInput): Promise<PaymentInitiateResult> {
    if (!this.isConfigured()) {
      throw new Error("CinetPay not configured: CINETPAY_API_KEY and CINETPAY_SITE_ID required");
    }

    const { apikey, site_id } = this.creds();
    const txId = input.idempotencyKey.slice(0, 20);

    const payload = {
      apikey,
      site_id,
      transaction_id: txId,
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      return_url: input.returnUrl,
      notify_url: input.notifyUrl,
      customer_name: input.customerName,
      customer_email: input.customerEmail,
      customer_phone_number: input.customerPhone,
      channels: "ALL",
      lang: "fr",
    };

    const data = await withRetry(async () => {
      const res = await fetch(`${BASE_URL}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new HttpError(`CinetPay HTTP ${res.status}: ${await res.text()}`, res.status);
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    const inner = data?.data as Record<string, unknown> | undefined;
    return {
      providerReference: txId,
      paymentUrl: (inner?.payment_url as string) || "",
      status: data?.code === "201" ? "pending" : "failed",
      raw: data,
    };
  }

  async verifyPayment(providerReference: string): Promise<PaymentVerifyResult> {
    if (!this.isConfigured()) {
      throw new Error("CinetPay not configured");
    }

    const { apikey, site_id } = this.creds();

    const data = await withRetry(async () => {
      const res = await fetch(`${BASE_URL}/payment/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apikey, site_id, transaction_id: providerReference }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new HttpError(`CinetPay verify HTTP ${res.status}`, res.status);
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    const inner = data?.data as Record<string, unknown> | undefined;
    const cpStatus = inner?.status;
    let status: PaymentVerifyResult["status"] = "pending";
    if (cpStatus === "ACCEPTED") status = "completed";
    else if (cpStatus === "REFUSED" || cpStatus === "CANCELLED") status = "failed";

    return {
      providerReference,
      status,
      amount: inner?.amount as number | undefined,
      currency: inner?.currency as string | undefined,
      paymentMethod: inner?.payment_method as string | undefined,
      raw: data,
    };
  }

  async initiatePayout(_input: PayoutInitiateInput): Promise<PayoutInitiateResult> {
    throw new Error("CinetPay payouts require manual processing via the CinetPay dashboard");
  }

  async verifyPayout(_providerReference: string): Promise<PayoutVerifyResult> {
    throw new Error("CinetPay payout verification not available via API");
  }
}
