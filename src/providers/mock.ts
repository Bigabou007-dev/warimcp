import crypto from "node:crypto";
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

const mockStore = new Map<
  string,
  { status: string; amount: number; currency: string; method?: string }
>();

function determineMockOutcome(amount: number): "completed" | "failed" | "pending" {
  const lastTwo = amount % 100;
  if (lastTwo === 99) return "failed";
  if (lastTwo === 50) return "pending";
  return "completed";
}

export class MockProvider implements BaseProvider {
  readonly name = "mock";
  readonly label = "Mock Provider";

  info(): ProviderInfo {
    return {
      name: this.name,
      label: this.label,
      configured: true,
      supportedCurrencies: ["XOF", "XAF", "CDF", "GNF", "USD", "EUR"],
      supportedCountries: ["CI", "SN", "ML", "BF", "TG", "BJ"],
      supportedMethods: ["MOBILE_MONEY", "CREDIT_CARD", "WALLET", "WAVE"],
    };
  }

  isConfigured(): boolean {
    return true;
  }

  async initiatePayment(input: PaymentInitiateInput): Promise<PaymentInitiateResult> {
    const ref = `MOCK-${crypto.randomUUID().slice(0, 12)}`;
    const outcome = determineMockOutcome(input.amount);

    mockStore.set(ref, {
      status: outcome === "completed" ? "completed" : outcome === "failed" ? "failed" : "pending",
      amount: input.amount,
      currency: input.currency,
    });

    return {
      providerReference: ref,
      paymentUrl: `https://mock.warimcp.local/pay/${ref}`,
      status: outcome === "completed" ? "completed" : "pending",
    };
  }

  async verifyPayment(providerReference: string): Promise<PaymentVerifyResult> {
    const entry = mockStore.get(providerReference);
    if (!entry) {
      return {
        providerReference,
        status: "failed",
      };
    }

    return {
      providerReference,
      status: entry.status as PaymentVerifyResult["status"],
      amount: entry.amount,
      currency: entry.currency,
      paymentMethod: "MOCK",
    };
  }

  async initiatePayout(input: PayoutInitiateInput): Promise<PayoutInitiateResult> {
    const ref = `MOCK-PO-${crypto.randomUUID().slice(0, 12)}`;
    const outcome = determineMockOutcome(input.amount);

    mockStore.set(ref, {
      status: outcome,
      amount: input.amount,
      currency: input.currency,
      method: input.method,
    });

    return {
      providerReference: ref,
      status: outcome === "completed" ? "completed" : "pending",
    };
  }

  async verifyPayout(providerReference: string): Promise<PayoutVerifyResult> {
    const entry = mockStore.get(providerReference);
    if (!entry) {
      return { providerReference, status: "failed" };
    }

    return {
      providerReference,
      status: entry.status as PayoutVerifyResult["status"],
    };
  }
}
