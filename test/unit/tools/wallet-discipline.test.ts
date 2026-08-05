import { describe, it, expect } from "vitest";
import {
  InitiatePaymentSchema,
  GeneratePaymentLinkSchema,
  InitiatePayoutSchema,
} from "../../../src/tools/definitions.js";

describe("I5 wallet discipline on initiate_payment", () => {
  const fiatInput = { provider: "mock", amount: 1000, currency: "XOF", description: "d",
    customerName: "n", customerEmail: "e@x.com", customerPhone: "00000001",
    idempotencyKey: "idem-key-001" };
  it("fiat callers unaffected (fundsSource defaults to fiat)", () => {
    const parsed = InitiatePaymentSchema.parse(fiatInput);
    expect(parsed.fundsSource).toBe("fiat");
  });
  it("usdc without agentWalletSignature is rejected", () => {
    expect(() => InitiatePaymentSchema.parse({ ...fiatInput, fundsSource: "usdc", walletProvider: "phantom" }))
      .toThrow(/agentWalletSignature is required when fundsSource is usdc/);
  });
  it("usdc without walletProvider is rejected", () => {
    expect(() => InitiatePaymentSchema.parse({ ...fiatInput, fundsSource: "usdc", agentWalletSignature: "sig" }))
      .toThrow(/walletProvider is required when fundsSource is usdc/);
  });
});

describe("I5 wallet discipline on generate_payment_link", () => {
  const fiatInput = { provider: "mock", amount: 1000, currency: "XOF", description: "d" };
  it("usdc without agentWalletSignature is rejected", () => {
    expect(() => GeneratePaymentLinkSchema.parse({ ...fiatInput, fundsSource: "usdc", walletProvider: "phantom" }))
      .toThrow(/agentWalletSignature is required when fundsSource is usdc/);
  });
});

describe("I5 wallet discipline on initiate_payout", () => {
  const fiatInput = { provider: "mock", amount: 1000, currency: "XOF",
    idempotencyKey: "idem-key-002", recipientPhone: "00000001", recipientName: "n" };
  it("usdc without agentWalletSignature is rejected", () => {
    expect(() => InitiatePayoutSchema.parse({ ...fiatInput, fundsSource: "usdc", walletProvider: "phantom" }))
      .toThrow(/agentWalletSignature is required when fundsSource is usdc/);
  });
});
