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

const SANDBOX_URL = "https://sandbox.momodeveloper.mtn.com";
const LIVE_URL = "https://proxy.momoapi.mtn.com";

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

export class MtnMomoProvider implements BaseProvider {
  readonly name = "mtn";
  readonly label = "MTN MoMo";

  private tokenCache: TokenCache | null = null;

  info(): ProviderInfo {
    return {
      name: this.name,
      label: this.label,
      configured: this.isConfigured(),
      supportedCurrencies: ["EUR"],
      supportedCountries: ["CI", "GH", "UG", "RW", "BJ", "CM", "CG"],
      supportedMethods: ["MTN_MOBILE_MONEY"],
    };
  }

  isConfigured(): boolean {
    const cfg = getConfig();
    return (
      !!cfg.MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY &&
      !!cfg.MTN_MOMO_API_USER &&
      !!cfg.MTN_MOMO_API_KEY
    );
  }

  private getBaseUrl(): string {
    const env = getConfig().MTN_MOMO_ENVIRONMENT;
    return env === "live" ? LIVE_URL : SANDBOX_URL;
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.tokenCache && this.tokenCache.expiresAt > now) {
      return this.tokenCache.accessToken;
    }

    const cfg = getConfig();
    const credentials = Buffer.from(
      `${cfg.MTN_MOMO_API_USER}:${cfg.MTN_MOMO_API_KEY}`
    ).toString("base64");

    const data = await withRetry(async () => {
      const res = await fetch(`${this.getBaseUrl()}/collection/token/`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Ocp-Apim-Subscription-Key": cfg.MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY,
        },
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new HttpError(
          `MTN MoMo token HTTP ${res.status}: ${await res.text()}`,
          res.status
        );
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    const accessToken = data.access_token as string;
    const expiresIn = (data.expires_in as number) || 3600;

    // Cache with 60-second safety margin
    this.tokenCache = {
      accessToken,
      expiresAt: now + (expiresIn - 60) * 1000,
    };

    return accessToken;
  }

  async initiatePayment(input: PaymentInitiateInput): Promise<PaymentInitiateResult> {
    if (!this.isConfigured()) {
      throw new Error(
        "MTN MoMo not configured: MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY, MTN_MOMO_API_USER, and MTN_MOMO_API_KEY required"
      );
    }

    const cfg = getConfig();
    const token = await this.getAccessToken();
    const referenceId = crypto.randomUUID();

    const payload = {
      amount: String(input.amount),
      currency: input.currency,
      externalId: input.idempotencyKey,
      payer: {
        partyIdType: "MSISDN",
        partyId: input.customerPhone,
      },
      payerMessage: input.description,
      payeeNote: input.description,
    };

    await withRetry(async () => {
      const res = await fetch(
        `${this.getBaseUrl()}/collection/v1_0/requesttopay`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Reference-Id": referenceId,
            "X-Target-Environment": cfg.MTN_MOMO_ENVIRONMENT,
            "Ocp-Apim-Subscription-Key": cfg.MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY,
            "Content-Type": "application/json",
            ...(cfg.MTN_MOMO_CALLBACK_URL
              ? { "X-Callback-Url": cfg.MTN_MOMO_CALLBACK_URL }
              : {}),
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30_000),
        }
      );

      if (!res.ok) {
        throw new HttpError(
          `MTN MoMo requesttopay HTTP ${res.status}: ${await res.text()}`,
          res.status
        );
      }
    });

    return {
      providerReference: referenceId,
      paymentUrl: "",
      status: "pending",
    };
  }

  async verifyPayment(providerReference: string): Promise<PaymentVerifyResult> {
    if (!this.isConfigured()) {
      throw new Error("MTN MoMo not configured");
    }

    const cfg = getConfig();
    const token = await this.getAccessToken();

    const data = await withRetry(async () => {
      const res = await fetch(
        `${this.getBaseUrl()}/collection/v1_0/requesttopay/${providerReference}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Target-Environment": cfg.MTN_MOMO_ENVIRONMENT,
            "Ocp-Apim-Subscription-Key": cfg.MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY,
          },
          signal: AbortSignal.timeout(30_000),
        }
      );

      if (!res.ok) {
        throw new HttpError(
          `MTN MoMo verify HTTP ${res.status}: ${await res.text()}`,
          res.status
        );
      }

      return res.json() as Promise<Record<string, unknown>>;
    });

    const momoStatus = data?.status as string | undefined;
    let status: PaymentVerifyResult["status"] = "pending";
    if (momoStatus === "SUCCESSFUL") status = "completed";
    else if (momoStatus === "FAILED") status = "failed";

    return {
      providerReference,
      status,
      amount: data?.amount ? Number(data.amount) : undefined,
      currency: data?.currency as string | undefined,
      paymentMethod: "MTN_MOBILE_MONEY",
      raw: data,
    };
  }

  async initiatePayout(_input: PayoutInitiateInput): Promise<PayoutInitiateResult> {
    throw new Error("MTN MoMo disbursements not yet configured");
  }

  async verifyPayout(_providerReference: string): Promise<PayoutVerifyResult> {
    throw new Error("MTN MoMo disbursements not yet configured");
  }
}
