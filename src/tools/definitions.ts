import { z } from "zod";

export const InitiatePaymentSchema = z.object({
  provider: z.string().default("moneroo"),
  amount: z.number().int().min(100).max(5_000_000),
  currency: z.string().default("XOF"),
  idempotencyKey: z.string().min(6).max(128),
  description: z.string().default("Payment"),
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional().default(""),
  customerPhone: z.string().min(8),
  returnUrl: z.string().url().optional().default(""),
  notifyUrl: z.string().url().optional().default(""),
  callbackUrl: z.string().url().optional().default(""),
  metadata: z.record(z.unknown()).optional().default({}),
});

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
  provider: z.string().default("moneroo"),
  amount: z.number().int().min(100).max(5_000_000),
  currency: z.string().default("XOF"),
  description: z.string().default("Payment"),
  metadata: z.record(z.unknown()).optional().default({}),
});

export const InitiatePayoutSchema = z.object({
  provider: z.string().default("moneroo"),
  amount: z.number().int().min(100).max(5_000_000),
  currency: z.string().default("XOF"),
  idempotencyKey: z.string().min(6).max(128),
  recipientPhone: z.string().min(8),
  recipientName: z.string().min(1),
  method: z.enum(["mobile_money", "bank"]).default("mobile_money"),
  metadata: z.record(z.unknown()).optional().default({}),
});

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
