import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { resolveFailoverChain } from "../../src/tools/initiate-payment.js";
import { decimalToAtomic, buildAccepts } from "../../src/server/middleware/x402.js";
import { loadConfig } from "../../src/config.js";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("DATABASE_URL", "postgres://test");
});

// ---------------------------------------------------------------- failover
describe("resolveFailoverChain", () => {
  it("drops the failed provider, mock, blanks and duplicates; preserves order", () => {
    expect(resolveFailoverChain("cinetpay", "fedapay, cinetpay, mock, hub2, fedapay,, wave")).toEqual([
      "fedapay",
      "hub2",
      "wave",
    ]);
  });

  it("is case-insensitive on the requested provider", () => {
    expect(resolveFailoverChain("FedaPay", "fedapay,hub2")).toEqual(["hub2"]);
  });

  it("returns empty for an empty chain", () => {
    expect(resolveFailoverChain("cinetpay", "")).toEqual([]);
  });
});

// ---------------------------------------------------------------- EURC
describe("decimalToAtomic", () => {
  it("converts decimals to 6-decimal atomic units", () => {
    expect(decimalToAtomic("0.017")).toBe("17000");
    expect(decimalToAtomic("0.004")).toBe("4000");
    expect(decimalToAtomic("1")).toBe("1000000");
    expect(decimalToAtomic("2.5")).toBe("2500000");
  });
  it("rejects malformed and over-precise values", () => {
    expect(() => decimalToAtomic("0.0000001")).toThrow();
    expect(() => decimalToAtomic("abc")).toThrow();
  });
});

describe("buildAccepts", () => {
  const base = {
    X402_NETWORK: "eip155:8453",
    X402_PAY_TO: "0x1111111111111111111111111111111111111111",
    X402_PRICE_WRITE: "$0.02",
    X402_PRICE_READ: "$0.005",
    X402_ACCEPT_EURC: false,
    X402_EURC_ASSET: "",
    X402_EURC_NAME: "EURC",
    X402_EURC_VERSION: "2",
    X402_EURC_PRICE_WRITE: "0.017",
    X402_EURC_PRICE_READ: "0.004",
  };

  it("USDC only when EURC disabled", () => {
    const opts = buildAccepts(base, "write") as Array<Record<string, unknown>>;
    expect(opts).toHaveLength(1);
    expect(opts[0].price).toBe("$0.02");
  });

  it("adds EURC option with atomic amount and EIP-712 domain when enabled", () => {
    const opts = buildAccepts({ ...base, X402_ACCEPT_EURC: true }, "write") as Array<{
      price: { asset: string; amount: string; extra: Record<string, string> } | string;
    }>;
    expect(opts).toHaveLength(2);
    const eurc = opts[1].price as { asset: string; amount: string; extra: Record<string, string> };
    expect(eurc.asset).toBe("0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42");
    expect(eurc.amount).toBe("17000");
    expect(eurc.extra).toEqual({ name: "EURC", version: "2" });
  });

  it("falls back to USDC-only on unknown network without explicit EURC address", () => {
    const opts = buildAccepts(
      { ...base, X402_ACCEPT_EURC: true, X402_NETWORK: "eip155:1" },
      "read"
    );
    expect(opts).toHaveLength(1);
  });
});

// ---------------------------------------------------------------- prepaid
describe("createPrepaidChargeMiddleware", () => {
  function mockReqRes(over: Partial<Request> & { apiKeyId?: string } = {}) {
    const req = { method: "POST", path: "/api/v1/payments/initiate", headers: {}, ...over } as Request;
    const headers: Record<string, string> = {};
    const res = {
      statusCode: 200,
      status(c: number) { (res as { statusCode: number }).statusCode = c; return res; },
      json: vi.fn().mockReturnThis(),
      setHeader: (k: string, v: string) => { headers[k] = v; },
    } as unknown as Response;
    return { req, res, headers };
  }

  async function runMw(
    envEnabled: boolean,
    reqOver: Partial<Request> & { apiKeyId?: string },
    deps: { charge?: unknown; hasAccount?: unknown }
  ) {
    vi.stubEnv("BILLING_PREPAID_ENABLED", envEnabled ? "true" : "false");
    vi.resetModules();
    const { createPrepaidChargeMiddleware } = await import(
      "../../src/server/middleware/prepaid.js"
    );
    const mw = createPrepaidChargeMiddleware({} as never, deps as never);
    const { req, res, headers } = mockReqRes(reqOver);
    let nextCalled = false;
    await mw(req, res, (() => { nextCalled = true; }) as NextFunction);
    return { res, headers, nextCalled };
  }

  it("passes through when prepaid disabled", async () => {
    const charge = vi.fn();
    const r = await runMw(false, { apiKeyId: "k1" }, { charge, hasAccount: async () => true });
    expect(r.nextCalled).toBe(true);
    expect(charge).not.toHaveBeenCalled();
  });

  it("passes through for keyless (x402-paid) requests", async () => {
    const charge = vi.fn();
    const r = await runMw(true, {}, { charge, hasAccount: async () => true });
    expect(r.nextCalled).toBe(true);
    expect(charge).not.toHaveBeenCalled();
  });

  it("passes through for keys without a credit account (subscription keys)", async () => {
    const charge = vi.fn();
    const r = await runMw(true, { apiKeyId: "k1" }, { charge, hasAccount: async () => false });
    expect(r.nextCalled).toBe(true);
    expect(charge).not.toHaveBeenCalled();
  });

  it("charges write price on POST and exposes the new balance", async () => {
    const charge = vi.fn(async () => 985);
    const r = await runMw(true, { apiKeyId: "k1" }, { charge, hasAccount: async () => true });
    expect(r.nextCalled).toBe(true);
    expect(charge).toHaveBeenCalledWith({}, "k1", 15, "charge:POST /api/v1/payments/initiate");
    expect(r.headers["X-Credit-Balance-XOF"]).toBe("985");
  });

  it("charges read price on GET", async () => {
    const charge = vi.fn(async () => 997);
    await runMw(true, { apiKeyId: "k1", method: "GET", path: "/api/v1/payments" } as never, {
      charge,
      hasAccount: async () => true,
    });
    expect(charge).toHaveBeenCalledWith({}, "k1", 3, "charge:GET /api/v1/payments");
  });

  it("402s with top-up pointer when balance is insufficient", async () => {
    const charge = vi.fn(async () => null);
    const r = await runMw(true, { apiKeyId: "k1" }, { charge, hasAccount: async () => true });
    expect(r.nextCalled).toBe(false);
    expect(r.res.statusCode).toBe(402);
  });

  it("never charges the billing endpoints themselves", async () => {
    const charge = vi.fn();
    const r = await runMw(true, { apiKeyId: "k1", path: "/api/v1/billing/topup" } as never, {
      charge,
      hasAccount: async () => true,
    });
    expect(r.nextCalled).toBe(true);
    expect(charge).not.toHaveBeenCalled();
  });
});

void loadConfig;
