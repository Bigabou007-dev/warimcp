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

export class PapssProvider implements BaseProvider {
  readonly name = "papss";
  readonly label = "PAPSS Pan-African";

  info(): ProviderInfo {
    return {
      name: this.name,
      label: this.label,
      configured: false,
      supportedCurrencies: ["XOF", "KES", "NGN", "GHS"],
      supportedCountries: ["CI", "KE", "NG", "GH"],
      supportedMethods: ["BANK_TRANSFER"],
    };
  }

  isConfigured(): boolean {
    return false;
  }

  async initiatePayment(_input: PaymentInitiateInput): Promise<PaymentInitiateResult> {
    throw new Error("PAPSS provider coming in Phase 3");
  }

  async verifyPayment(_ref: string): Promise<PaymentVerifyResult> {
    throw new Error("PAPSS provider coming in Phase 3");
  }

  async initiatePayout(_input: PayoutInitiateInput): Promise<PayoutInitiateResult> {
    throw new Error("PAPSS provider coming in Phase 3");
  }

  async verifyPayout(_ref: string): Promise<PayoutVerifyResult> {
    throw new Error("PAPSS provider coming in Phase 3");
  }
}
