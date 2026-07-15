import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { createBillingMiddleware } from "../../src/server/middleware/x402.js";

/** Minimal chainable Drizzle stub for the auth lookup (with leftJoin). */
function dbStub(rows: unknown[]) {
  const chain = {
    select: () => chain,
    from: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    limit: async () => rows,
    update: () => chain,
    set: () => chain,
    catch: () => undefined,
  };
  return chain as never;
}

function mockRes() {
  const res: Partial<Response> = {
    statusCode: 200,
    status(code: number) {
      (res as { statusCode: number }).statusCode = code;
      return res as Response;
    },
    json: vi.fn().mockReturnThis(),
  };
  return res as Response;
}

const run = (mw: RequestHandler, req: Partial<Request>) =>
  new Promise<{ res: Response; nextCalled: boolean }>((resolve) => {
    const res = mockRes();
    let nextCalled = false;
    const maybe = mw(req as Request, res, (() => {
      nextCalled = true;
      resolve({ res, nextCalled });
    }) as NextFunction) as unknown;
    // resolve when middleware finishes without calling next
    Promise.resolve(maybe).then(() =>
      setTimeout(() => resolve({ res, nextCalled }), 10)
    );
  });

describe("createBillingMiddleware (dual door)", () => {
  it("routes API-key requests through key auth (invalid key → 403, never x402)", async () => {
    const x402 = vi.fn();
    const mw = createBillingMiddleware(dbStub([]), x402 as never);
    const { res, nextCalled } = await run(mw, { headers: { "x-api-key": "bad-key" } });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(x402).not.toHaveBeenCalled();
  });

  it("valid API key passes through without touching x402", async () => {
    const x402 = vi.fn();
    // auth now selects { key, creditAccountId } via LEFT JOIN
    const row = {
      key: { id: "k1", label: "test", permissions: null, rateLimitPerMinute: null, keyHash: "h", active: true },
      creditAccountId: null,
    };
    const mw = createBillingMiddleware(dbStub([row]), x402 as never);
    const { nextCalled } = await run(mw, { headers: { "x-api-key": "good" } });
    expect(nextCalled).toBe(true);
    expect(x402).not.toHaveBeenCalled();
  });

  it("no API key + x402 enabled → x402 door handles the request", async () => {
    const x402 = vi.fn((_req, _res, next) => next());
    const mw = createBillingMiddleware(dbStub([]), x402 as never);
    const { nextCalled } = await run(mw, { headers: {} });
    expect(x402).toHaveBeenCalledOnce();
    expect(nextCalled).toBe(true);
  });

});

describe("buildX402Middleware", () => {
  it("throws when enabled without a receiving wallet", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://test");
    vi.stubEnv("X402_PAY_TO", "");
    // force config re-parse
    vi.resetModules();
    const { buildX402Middleware: build } = await import("../../src/server/middleware/x402.js");
    await expect(build()).rejects.toThrow(/X402_PAY_TO/);
  });

  it("constructs the real payment middleware offline (sync-on-start off)", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://test");
    vi.stubEnv("X402_PAY_TO", "0x1111111111111111111111111111111111111111");
    vi.stubEnv("X402_NETWORK", "eip155:84532");
    vi.stubEnv("X402_SYNC_ON_START", "false");
    vi.resetModules();
    const { buildX402Middleware: build } = await import("../../src/server/middleware/x402.js");
    const mw = await build();
    expect(typeof mw).toBe("function");
  });
});

