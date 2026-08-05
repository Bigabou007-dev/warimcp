// test/unit/providers/hub2-initiate.test.ts
// Module-level env setup (required by Zod config schema before any import resolves)
process.env.WARIMCP_MODE = "sandbox";
process.env.WARIMCP_TRANSPORT = "http";
process.env.WARIMCP_PORT = "3000";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetConfig } from "../../../src/config.js";
import { Hub2Provider } from "../../../src/providers/hub2.js";

const baseInput = {
  amount: 1000, currency: "XOF", idempotencyKey: "idem-1",
  description: "test order", customerName: "Test", customerEmail: "t@example.com",
  customerPhone: "00000001", returnUrl: "https://example.com/return",
  notifyUrl: "https://example.com/notify", metadata: { provider: "mtn" },
};

function mockFetchSequence(responses: Array<{ status?: number; json: unknown }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let i = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses[Math.min(i++, responses.length - 1)];
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200 });
  }));
  return calls;
}

beforeEach(() => {
  process.env.HUB2_API_KEY = "sk_test";
  process.env.HUB2_MERCHANT_ID = "m_test";
  resetConfig();
});
afterEach(() => vi.unstubAllGlobals());

describe("Hub2Provider.initiatePayment", () => {
  it("creates intent then attempts payment; returns intent id as providerReference", async () => {
    const calls = mockFetchSequence([
      { json: { id: "pi_1", token: "tok_1", status: "payment_required" } },
      { json: { status: "processing", payments: [{ id: "pay_1", nextAction: null }] } },
    ]);
    const r = await new Hub2Provider().initiatePayment(baseInput);
    expect(r.providerReference).toBe("pi_1");
    expect(r.status).toBe("processing");
    const intentBody = JSON.parse(String(calls[0].init.body));
    expect(intentBody).toMatchObject({ amount: 1000, currency: "XOF", customerReference: "t@example.com" });
    const h0 = calls[0].init.headers as Record<string, string>;
    expect(h0.ApiKey).toBe("sk_test");
    expect(h0.MerchantId).toBe("m_test");
    expect(h0.Environment).toBe("sandbox");
    const h1 = calls[1].init.headers as Record<string, string>;
    expect(h1.Authorization).toBe("Bearer tok_1");
    expect(h1.ApiKey).toBeUndefined();          // token mode: no ApiKey/MerchantId
    const attemptBody = JSON.parse(String(calls[1].init.body));
    expect(attemptBody.mobileMoney.msisdn).toBe("00000001");
  });

  it("throws fast when customerReference would be empty", async () => {
    mockFetchSequence([{ json: {} }]);
    await expect(new Hub2Provider().initiatePayment({ ...baseInput, customerEmail: "", customerPhone: "" }))
      .rejects.toThrow(/customerReference/);
  });

  it("wave: sends https redirect URLs and returns redirect as paymentUrl", async () => {
    const calls = mockFetchSequence([
      { json: { id: "pi_2", token: "tok_2", status: "payment_required" } },
      { json: { status: "processing", payments: [{ id: "pay_2", nextAction: { type: "redirect", url: "https://wave.example/x" } }] } },
    ]);
    const r = await new Hub2Provider().initiatePayment({ ...baseInput, metadata: { provider: "wave" } });
    const attemptBody = JSON.parse(String(calls[1].init.body));
    expect(attemptBody.mobileMoney.onSuccessRedirectionUrl).toBe("https://example.com/return");
    expect(attemptBody.mobileMoney.onFailedRedirectionUrl).toBe("https://example.com/return");
    expect(attemptBody.mobileMoney.onFinishRedirectionUrl).toBeUndefined();
    expect(r.paymentUrl).toBe("https://wave.example/x");
  });

  it("wave: rejects non-https returnUrl before calling Hub2", async () => {
    const calls = mockFetchSequence([{ json: { id: "pi_3", token: "tok_3", status: "payment_required" } }]);
    await expect(new Hub2Provider().initiatePayment({
      ...baseInput, returnUrl: "http://insecure.example/r", metadata: { provider: "wave" },
    })).rejects.toThrow(/https/);
    expect(calls.length).toBeLessThan(2);      // attempt call never made
  });
});
