export interface PaymentInitiateInput {
  amount: number;
  currency: string;
  idempotencyKey: string;
  description: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  returnUrl: string;
  notifyUrl: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentInitiateResult {
  providerReference: string;
  paymentUrl: string;
  status: string;
  raw?: unknown;
}

export interface PaymentVerifyResult {
  providerReference: string;
  status: "pending" | "processing" | "completed" | "failed" | "refunded";
  amount?: number;
  currency?: string;
  paymentMethod?: string;
  raw?: unknown;
}

export interface PayoutInitiateInput {
  amount: number;
  currency: string;
  idempotencyKey: string;
  recipientPhone: string;
  recipientName: string;
  method: "mobile_money" | "bank";
  metadata?: Record<string, unknown>;
}

export interface PayoutInitiateResult {
  providerReference: string;
  status: string;
  raw?: unknown;
}

export interface PayoutVerifyResult {
  providerReference: string;
  status: "pending" | "processing" | "completed" | "failed";
  raw?: unknown;
}

export interface ProviderInfo {
  name: string;
  label: string;
  configured: boolean;
  supportedCurrencies: string[];
  supportedCountries: string[];
  supportedMethods: string[];
}

export interface BaseProvider {
  readonly name: string;
  readonly label: string;

  info(): ProviderInfo;
  isConfigured(): boolean;

  initiatePayment(input: PaymentInitiateInput): Promise<PaymentInitiateResult>;
  verifyPayment(providerReference: string): Promise<PaymentVerifyResult>;

  initiatePayout(input: PayoutInitiateInput): Promise<PayoutInitiateResult>;
  verifyPayout(providerReference: string): Promise<PayoutVerifyResult>;
}
