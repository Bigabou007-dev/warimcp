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
