import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { getConfig } from "../../config.js";
import { createAuthMiddleware } from "./auth.js";

/**
 * Dual-door billing for the WariMCP HTTP API.
 *
 * Door 1 — X-Api-Key (existing): account holders authenticate as before.
 *          A present-but-invalid key is REJECTED (403), never silently
 *          downgraded to the payment flow — that would mask key rotation bugs.
 * Door 2 — x402 (new): requests with no API key can pay per call in USDC on
 *          Base via the x402 protocol (402 challenge → signed payment →
 *          facilitator verify/settle). No account, no key — agents and
 *          humans alike.
 *
 * With X402_ENABLED=false (default) behavior is byte-identical to the old
 * auth middleware: missing key → 401.
 */

/** Route prices, money-format strings (the x402 stack converts to USDC). */
export interface X402RoutePrices {
  write: string;
  read: string;
}

/**
 * Build the x402 payment middleware for the priced API routes.
 * Isolated so tests can inject a fake and boot without network access.
 */
export async function buildX402Middleware(): Promise<RequestHandler> {
  const cfg = getConfig();
  if (!cfg.X402_PAY_TO) {
    throw new Error("X402_ENABLED=true requires X402_PAY_TO (receiving wallet address)");
  }

  // Dynamic imports keep x402 deps out of the boot path when disabled.
  const { paymentMiddlewareFromHTTPServer, x402ResourceServer } = await import(
    "@x402/express"
  );
  const { ExactEvmScheme } = await import("@x402/evm/exact/server");
  const { HTTPFacilitatorClient, x402HTTPResourceServer } = await import(
    "@x402/core/server"
  );

  const facilitator = new HTTPFacilitatorClient({ url: cfg.X402_FACILITATOR_URL });
  const resourceServer = new x402ResourceServer(facilitator).register(
    cfg.X402_NETWORK as never,
    new ExactEvmScheme() as never
  );

  // Bazaar discovery metadata — lets the x402 Bazaar catalog index WariMCP so
  // agents can find and pay for it programmatically.
  const { declareDiscoveryExtension } = await import("@x402/extensions/bazaar");

  const accepts = (price: string) => ({
    accepts: {
      scheme: "exact" as const,
      price,
      network: cfg.X402_NETWORK as never,
      payTo: cfg.X402_PAY_TO,
    },
  });

  const routes = {
    "POST /api/v1/payments/initiate": {
      ...accepts(cfg.X402_PRICE_WRITE),
      description: "Initiate a mobile-money/card payment in West Africa (returns checkout URL)",
      extensions: declareDiscoveryExtension({
        bodyType: "json",
        input: {
          provider: "fedapay",
          amount: 5000,
          currency: "XOF",
          idempotencyKey: "order-1234",
          description: "Order #1234",
          customerName: "Awa Kone",
          customerPhone: "+2250707070707",
        },
        inputSchema: {
          type: "object",
          properties: {
            provider: { type: "string", description: "fedapay | cinetpay | wave | kkiapay | moneroo | flutterwave | mock" },
            amount: { type: "integer", description: "Whole currency units, e.g. 5000 = 5000 XOF" },
            currency: { type: "string", description: "XOF, XAF, CDF, GNF" },
            idempotencyKey: { type: "string" },
            description: { type: "string" },
            customerName: { type: "string" },
            customerPhone: { type: "string", description: "International format: +225..." },
          },
          required: ["provider", "amount", "currency", "idempotencyKey", "customerName", "customerPhone"],
        },
      }),
    },
    "GET /api/v1/payments/:id": {
      ...accepts(cfg.X402_PRICE_READ),
      description: "Verify a payment's status",
      extensions: declareDiscoveryExtension({
        input: {},
        inputSchema: { type: "object", properties: {} },
      }),
    },
    "POST /api/v1/payments/:id/refund": {
      ...accepts(cfg.X402_PRICE_WRITE),
      description: "Refund a payment (full or partial)",
    },
    "GET /api/v1/payments": {
      ...accepts(cfg.X402_PRICE_READ),
      description: "List transactions",
    },
    "POST /api/v1/payment-links": {
      ...accepts(cfg.X402_PRICE_WRITE),
      description: "Create a shareable payment link",
    },
    "POST /api/v1/payouts/initiate": {
      ...accepts(cfg.X402_PRICE_WRITE),
      description: "Disburse funds to a mobile-money wallet or bank account in West Africa",
      extensions: declareDiscoveryExtension({
        bodyType: "json",
        input: {
          provider: "fedapay",
          amount: 10000,
          currency: "XOF",
          idempotencyKey: "payout-5678",
          recipientName: "Awa Kone",
          recipientPhone: "+2250707070707",
        },
        inputSchema: {
          type: "object",
          properties: {
            provider: { type: "string" },
            amount: { type: "integer" },
            currency: { type: "string" },
            idempotencyKey: { type: "string" },
            recipientName: { type: "string" },
            recipientPhone: { type: "string" },
          },
          required: ["provider", "amount", "currency", "idempotencyKey", "recipientName", "recipientPhone"],
        },
      }),
    },
    "GET /api/v1/payouts/:id": {
      ...accepts(cfg.X402_PRICE_READ),
      description: "Verify a payout's status",
    },
  };

  // We own facilitator initialization instead of letting the middleware do it
  // (its construction-time promise is unhandled — an unreachable facilitator
  // at boot would crash the whole gateway). Await the first attempt so a
  // healthy boot is fully validated; on failure, log and retry in the
  // background with linear backoff. The gateway itself never dies: API-key
  // traffic keeps working, and priced (x402) requests fail with an error until
  // a sync succeeds.
  const httpServer = new x402HTTPResourceServer(resourceServer, routes as never);

  if (cfg.X402_SYNC_ON_START) {
    const MAX_ATTEMPTS = 10;
    const sync = async (attempt: number): Promise<boolean> => {
      try {
        await httpServer.initialize();
        console.error("[x402] facilitator synced — pay-per-call billing active");
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[x402] facilitator sync failed (attempt ${attempt}/${MAX_ATTEMPTS}): ${msg}`);
        return false;
      }
    };
    const ok = await sync(1);
    if (!ok) {
      let attempt = 2;
      const retry = () => {
        if (attempt > MAX_ATTEMPTS) {
          console.error("[x402] giving up on facilitator sync — priced requests will error until restart");
          return;
        }
        const current = attempt++;
        setTimeout(() => {
          void sync(current).then((done) => {
            if (!done) retry();
          });
        }, Math.min(current * 5_000, 60_000)).unref();
      };
      retry();
    }
  }

  return paymentMiddlewareFromHTTPServer(
    httpServer,
    undefined,
    undefined,
    false // we already handle initialization above
  ) as RequestHandler;
}

/**
 * Create the combined billing middleware. Drop-in replacement for the old
 * `createAuthMiddleware(db)` on priced routes.
 *
 * @param db          database handle (API-key lookups)
 * @param x402        the x402 payment middleware, or null when disabled
 */
export function createBillingMiddleware(
  db: PostgresJsDatabase,
  x402: RequestHandler | null
): RequestHandler {
  const apiKeyAuth = createAuthMiddleware(db);

  return (req: Request, res: Response, next: NextFunction) => {
    // Door 1: an API key is present → strict key auth, success or 401/403.
    if (req.headers["x-api-key"]) {
      return apiKeyAuth(req, res, next);
    }
    // Door 2: no key → pay-per-call, when enabled.
    if (x402) {
      return x402(req, res, next);
    }
    // x402 disabled → legacy behavior (401 from the auth middleware).
    return apiKeyAuth(req, res, next);
  };
}
