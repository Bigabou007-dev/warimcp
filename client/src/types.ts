export interface WariMCPClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}

export interface PaymentResult {
  transactionId: string;
  provider: string;
  providerReference?: string;
  status: string;
  paymentUrl?: string;
  amount: number;
  currency: string;
  idempotent?: boolean;
  paymentMethod?: string;
  note?: string;
}

export interface PaymentLinkResult {
  transactionId: string;
  paymentUrl: string;
  amount: number;
  currency: string;
  provider: string;
}

export interface PayoutResult {
  payoutId: string;
  provider: string;
  providerReference?: string;
  status: string;
  amount: number;
  currency: string;
  idempotent?: boolean;
}

export interface PaginatedResult<T> {
  transactions: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface InitiatePaymentInput {
  provider?: string;
  amount: number;
  currency?: string;
  idempotencyKey: string;
  description?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  returnUrl?: string;
  notifyUrl?: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface RefundInput {
  amount?: number;
  reason?: string;
}

export interface TransactionFilters {
  provider?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface PaymentLinkInput {
  provider?: string;
  amount: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface InitiatePayoutInput {
  provider?: string;
  amount: number;
  currency?: string;
  idempotencyKey: string;
  recipientPhone: string;
  recipientName: string;
  method?: "mobile_money" | "bank";
  metadata?: Record<string, unknown>;
}

export interface ProviderInfo {
  name: string;
  label: string;
  configured: boolean;
  supportedCurrencies: string[];
  supportedCountries: string[];
  supportedMethods: string[];
  mode: string;
  effective: string;
}

export interface ProvidersResponse {
  mode: string;
  providers: ProviderInfo[];
}
