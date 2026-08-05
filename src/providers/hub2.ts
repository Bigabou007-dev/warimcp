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
