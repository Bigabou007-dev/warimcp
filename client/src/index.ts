import type {
  WariMCPClientConfig,
  PaymentResult,
  PaymentLinkResult,
  PayoutResult,
  PaginatedResult,
  InitiatePaymentInput,
  RefundInput,
  TransactionFilters,
  PaymentLinkInput,
  InitiatePayoutInput,
  ProvidersResponse,
} from "./types.js";

export type {
  WariMCPClientConfig,
  PaymentResult,
  PaymentLinkResult,
  PayoutResult,
  PaginatedResult,
  InitiatePaymentInput,
  RefundInput,
  TransactionFilters,
  PaymentLinkInput,
  InitiatePayoutInput,
  ProvidersResponse,
};

export class WariMCPClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(config: WariMCPClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30_000;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "X-Api-Key": this.apiKey,
      "Content-Type": "application/json",
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.timeout),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = (data as any)?.error || `HTTP ${res.status}`;
      throw new Error(`WariMCP API error: ${msg}`);
    }

    return data as T;
  }

  async listProviders(): Promise<ProvidersResponse> {
    return this.request("GET", "/api/v1/providers");
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<PaymentResult> {
    return this.request("POST", "/api/v1/payments/initiate", input);
  }

  async verifyPayment(transactionId: string): Promise<PaymentResult> {
    return this.request("GET", `/api/v1/payments/${transactionId}`);
  }

  async refundPayment(
    transactionId: string,
    input?: RefundInput
  ): Promise<PaymentResult> {
    return this.request(
      "POST",
      `/api/v1/payments/${transactionId}/refund`,
      input || {}
    );
  }

  async listTransactions(
    filters?: TransactionFilters
  ): Promise<PaginatedResult<PaymentResult>> {
    const params = new URLSearchParams();
    if (filters?.provider) params.set("provider", filters.provider);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.limit) params.set("limit", String(filters.limit));
    if (filters?.offset) params.set("offset", String(filters.offset));

    const query = params.toString();
    return this.request(
      "GET",
      `/api/v1/payments${query ? `?${query}` : ""}`
    );
  }

  async generatePaymentLink(
    input: PaymentLinkInput
  ): Promise<PaymentLinkResult> {
    return this.request("POST", "/api/v1/payment-links", input);
  }

  async initiatePayout(input: InitiatePayoutInput): Promise<PayoutResult> {
    return this.request("POST", "/api/v1/payouts/initiate", input);
  }

  async verifyPayout(payoutId: string): Promise<PayoutResult> {
    return this.request("GET", `/api/v1/payouts/${payoutId}`);
  }
}
