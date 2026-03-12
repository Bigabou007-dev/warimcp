import { describe, it, expect, beforeAll } from "vitest";

// Set env before importing config
process.env.WARIMCP_MODE = "mock";
process.env.WARIMCP_TRANSPORT = "http";
process.env.WARIMCP_PORT = "3000";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

import { MockProvider } from "../../../src/providers/mock.js";

describe("MockProvider", () => {
  const provider = new MockProvider();

  it("reports as always configured", () => {
    expect(provider.isConfigured()).toBe(true);
  });

  it("returns correct provider info", () => {
    const info = provider.info();
    expect(info.name).toBe("mock");
    expect(info.configured).toBe(true);
    expect(info.supportedCurrencies).toContain("XOF");
  });

  describe("initiatePayment", () => {
    it("returns completed for amount ending in 00", async () => {
      const result = await provider.initiatePayment({
        amount: 5000,
        currency: "XOF",
        idempotencyKey: "test-001",
        description: "Test",
        customerName: "Test",
        customerEmail: "test@test.com",
        customerPhone: "+2250707070707",
        returnUrl: "https://example.com",
        notifyUrl: "https://example.com/webhook",
      });

      expect(result.providerReference).toMatch(/^MOCK-/);
      expect(result.paymentUrl).toContain("mock.warimcp.local");
      expect(result.status).toBe("completed");
    });

    it("returns pending for amount ending in 50", async () => {
      const result = await provider.initiatePayment({
        amount: 5050,
        currency: "XOF",
        idempotencyKey: "test-050",
        description: "Test",
        customerName: "Test",
        customerEmail: "",
        customerPhone: "+2250707070707",
        returnUrl: "",
        notifyUrl: "",
      });

      expect(result.status).toBe("pending");
    });

    it("returns failed status for verify on amount ending in 99", async () => {
      const result = await provider.initiatePayment({
        amount: 4999,
        currency: "XOF",
        idempotencyKey: "test-099",
        description: "Test",
        customerName: "Test",
        customerEmail: "",
        customerPhone: "+2250707070707",
        returnUrl: "",
        notifyUrl: "",
      });

      const verify = await provider.verifyPayment(result.providerReference);
      expect(verify.status).toBe("failed");
    });
  });

  describe("verifyPayment", () => {
    it("returns failed for unknown reference", async () => {
      const result = await provider.verifyPayment("MOCK-nonexistent");
      expect(result.status).toBe("failed");
    });
  });

  describe("initiatePayout", () => {
    it("returns completed for amount ending in 00", async () => {
      const result = await provider.initiatePayout({
        amount: 10000,
        currency: "XOF",
        idempotencyKey: "payout-001",
        recipientPhone: "+2250707070707",
        recipientName: "Test Seller",
        method: "mobile_money",
      });

      expect(result.providerReference).toMatch(/^MOCK-PO-/);
      expect(result.status).toBe("completed");
    });
  });
});
