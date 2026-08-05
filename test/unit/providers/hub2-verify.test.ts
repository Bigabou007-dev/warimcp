// test/unit/providers/hub2-verify.test.ts
// Module-level env setup (required by Zod config schema before any import resolves)
process.env.WARIMCP_MODE = "sandbox";
process.env.WARIMCP_TRANSPORT = "http";
process.env.WARIMCP_PORT = "3000";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetConfig } from "../../../src/config.js";
import { Hub2Provider } from "../../../src/providers/hub2.js";

beforeEach(() => {
  process.env.HUB2_API_KEY = "sk_test";
  process.env.HUB2_MERCHANT_ID = "m_test";
  resetConfig();
});
afterEach(() => vi.unstubAllGlobals());

describe("Hub2Provider.verifyPayment", () => {
  it("maps succeeded intent to completed with amount/currency", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ id: "pi_1", status: "succeeded", amount: 1000, currency: "XOF" }), { status: 200 })));
    const r = await new Hub2Provider().verifyPayment("pi_1");
    expect(r.status).toBe("completed");
    expect(r.amount).toBe(1000);
    expect(r.currency).toBe("XOF");
    expect(r.paymentMethod).toBe("HUB2");
  });

  it("maps payment_required intent to pending", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ id: "pi_2", status: "payment_required", amount: 500, currency: "XOF" }), { status: 200 })));
    const r = await new Hub2Provider().verifyPayment("pi_2");
    expect(r.status).toBe("pending");
  });

  it("maps failed intent to failed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ id: "pi_3", status: "failed", amount: 500, currency: "XOF" }), { status: 200 })));
    const r = await new Hub2Provider().verifyPayment("pi_3");
    expect(r.status).toBe("failed");
  });

  it("rejects with Hub2 verify HTTP 404 on non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ error: "not found" }), { status: 404 })));
    await expect(new Hub2Provider().verifyPayment("pi_missing"))
      .rejects.toThrow(/Hub2 verify HTTP 404/);
  });

  it("throws on unknown wire status (fail loudly by design)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ id: "pi_x", status: "mystery" }), { status: 200 })));
    await expect(new Hub2Provider().verifyPayment("pi_x"))
      .rejects.toThrow(/Unknown Hub2 status/);
  });
});
