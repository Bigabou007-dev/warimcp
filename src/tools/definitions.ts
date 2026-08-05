import { z } from "zod";

const walletDisciplineFields = {
  fundsSource: z.enum(["fiat", "usdc"]).default("fiat"),
  agentWalletSignature: z.string().optional(),
  walletProvider: z.string().optional(),
};

const walletDisciplineRefine = (
  val: { fundsSource: string; agentWalletSignature?: string; walletProvider?: string },
  ctx: z.RefinementCtx
) => {
  if (val.fundsSource === "usdc") {
    if (!val.agentWalletSignature) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "agentWalletSignature is required when fundsSource is usdc",
      });
    }
    if (!val.walletProvider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "walletProvider is required when fundsSource is usdc",
      });
    }
  }
};

export const InitiatePaymentSchema = z.object({
  provider: z.string().default("fedapay"),
  amount: z.number().int().min(100).max(5_000_000),
  currency: z.string().default("XOF"),
  idempotencyKey: z.string().min(6).max(128),
  description: z.string().default("Payment"),
  customerName: z.string().min(1),
  customerEmail: z.union([z.string().email(), z.literal("")]).optional().default(""),
  customerPhone: z.string().min(8),
  returnUrl: z.union([z.string().url(), z.literal("")]).optional().default(""),
  notifyUrl: z.union([z.string().url(), z.literal("")]).optional().default(""),
  callbackUrl: z.union([z.string().url(), z.literal("")]).optional().default(""),
  metadata: z.record(z.unknown()).optional().default({}),
  ...walletDisciplineFields,
}).superRefine(walletDisciplineRefine);

export const VerifyPaymentSchema = z.object({
  transactionId: z.string().uuid(),
});

export const RefundPaymentSchema = z.object({
  transactionId: z.string().uuid(),
  amount: z.number().int().min(1).optional(),
  reason: z.string().optional().default(""),
});

export const ListTransactionsSchema = z.object({
  provider: z.string().optional(),
  status: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export const GeneratePaymentLinkSchema = z.object({
  provider: z.string().default("fedapay"),
  amount: z.number().int().min(100).max(5_000_000),
  currency: z.string().default("XOF"),
  description: z.string().default("Payment"),
  metadata: z.record(z.unknown()).optional().default({}),
  ...walletDisciplineFields,
}).superRefine(walletDisciplineRefine);

export const InitiatePayoutSchema = z.object({
  provider: z.string().default("fedapay"),
  amount: z.number().int().min(100).max(5_000_000),
  currency: z.string().default("XOF"),
  idempotencyKey: z.string().min(6).max(128),
  recipientPhone: z.string().min(8),
  recipientName: z.string().min(1),
  method: z.enum(["mobile_money", "bank"]).default("mobile_money"),
  metadata: z.record(z.unknown()).optional().default({}),
  ...walletDisciplineFields,
}).superRefine(walletDisciplineRefine);

export const VerifyPayoutSchema = z.object({
  payoutId: z.string().uuid(),
});

export const PaymentMandateSchema = z.object({
  // Bounds mirror InitiatePaymentSchema.amount exactly — a mandate must not be able
  // to authorize an amount the sibling payment tool would reject.
  amount: z.number().int().min(100).max(5_000_000),
  currency: z.string(),
  merchantRef: z.string().min(1),
  expiresAtMs: z.number().int(),
  nonce: z.string().min(1),
});

// NOTE: no agentPublicKeyPem here — the verification key comes from the server-side
// WARIMCP_TRUSTED_AGENT_KEYS allowlist, never from caller input (trust-anyone fix).
export const AuthorizeAndPaySchema = z.object({
  mandate: PaymentMandateSchema,
  signature: z.string().min(1).describe("Base64-encoded Ed25519 signature of the canonical mandate bytes"),
  provider: z.string().min(1).describe("Payment provider: mock, cinetpay, wave, fedapay"),
  customerPhone: z.string().min(8).describe("Customer phone in international format"),
  customerEmail: z.string().email().optional().describe("Customer email (optional)"),
  returnUrl: z.union([z.string().url(), z.literal("")]).describe("Redirect URL after payment"),
  notifyUrl: z.union([z.string().url(), z.literal("")]).describe("Webhook URL for payment notifications"),
});

export type InitiatePaymentInput = z.infer<typeof InitiatePaymentSchema>;
export type VerifyPaymentInput = z.infer<typeof VerifyPaymentSchema>;
export type RefundPaymentInput = z.infer<typeof RefundPaymentSchema>;
export type ListTransactionsInput = z.infer<typeof ListTransactionsSchema>;
export type GeneratePaymentLinkInput = z.infer<typeof GeneratePaymentLinkSchema>;
export type InitiatePayoutInput = z.infer<typeof InitiatePayoutSchema>;
export type VerifyPayoutInput = z.infer<typeof VerifyPayoutSchema>;
export type AuthorizeAndPayInput = z.infer<typeof AuthorizeAndPaySchema>;
