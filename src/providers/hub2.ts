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
      configured: false,
      supportedCurrencies: ["XOF", "XAF"],
      supportedCountries: ["CI", "SN", "ML", "BF", "TG", "BJ", "NE", "CM"],
      supportedMethods: ["MOBILE_MONEY"],
    };
  }

  isConfigured(): boolean {
    return false;
  }

  async initiatePayment(_input: PaymentInitiateInput): Promise<PaymentInitiateResult> {
    throw new Error("Hub2 provider coming in Phase 2");
  }

  async verifyPayment(_ref: string): Promise<PaymentVerifyResult> {
    throw new Error("Hub2 provider coming in Phase 2");
  }

  async initiatePayout(_input: PayoutInitiateInput): Promise<PayoutInitiateResult> {
    throw new Error("Hub2 provider coming in Phase 2");
  }

  async verifyPayout(_ref: string): Promise<PayoutVerifyResult> {
    throw new Error("Hub2 provider coming in Phase 2");
  }
}
