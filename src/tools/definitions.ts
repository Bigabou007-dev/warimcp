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
  customerEmail: z.string().email().optional().default(""),
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

export type InitiatePaymentInput = z.infer<typeof InitiatePaymentSchema>;
export type VerifyPaymentInput = z.infer<typeof VerifyPaymentSchema>;
export type RefundPaymentInput = z.infer<typeof RefundPaymentSchema>;
export type ListTransactionsInput = z.infer<typeof ListTransactionsSchema>;
export type GeneratePaymentLinkInput = z.infer<typeof GeneratePaymentLinkSchema>;
export type InitiatePayoutInput = z.infer<typeof InitiatePayoutSchema>;
export type VerifyPayoutInput = z.infer<typeof VerifyPayoutSchema>;
