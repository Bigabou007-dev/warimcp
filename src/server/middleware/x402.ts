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

/** Built-in EURC contract addresses (Circle). Override via X402_EURC_ASSET. */
const EURC_DEFAULT_ASSET: Record<string, string> = {
  "eip155:8453": "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42", // Base mainnet
  "eip155:84532": "0x808456652fdb597867f38412077A9182bf77359F", // Base Sepolia
};

/** Convert a decimal string ("0.017") to an atomic token amount ("17000"). */
export function decimalToAtomic(value: string, decimals = 6): string {
  const [whole = "0", frac = ""] = value.trim().split(".");
  if (!/^\d*$/.test(whole) || !/^\d*$/.test(frac) || frac.length > decimals) {
    throw new Error(`invalid decimal amount: ${value}`);
  }
  const atomic = BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0");
  return atomic.toString();
}

/**
 * Build the payment options for a route class. Always offers USDC (money
 * format); optionally adds EURC as a second settlement asset. XOF is pegged
 * to the euro (655.957 XOF/EUR), so EURC pricing carries zero FX drift for a
 * WAEMU-based operator.
 */
export function buildAccepts(
  cfg: {
    X402_NETWORK: string;
    X402_PAY_TO: string;
    X402_PRICE_WRITE: string;
    X402_PRICE_READ: string;
    X402_ACCEPT_EURC: boolean;
    X402_EURC_ASSET: string;
    X402_EURC_NAME: string;
    X402_EURC_VERSION: string;
    X402_EURC_PRICE_WRITE: string;
    X402_EURC_PRICE_READ: string;
  },
  kind: "write" | "read"
): object[] {
  const usdc = {
    scheme: "exact" as const,
    price: kind === "write" ? cfg.X402_PRICE_WRITE : cfg.X402_PRICE_READ,
    network: cfg.X402_NETWORK,
    payTo: cfg.X402_PAY_TO,
  };
  if (!cfg.X402_ACCEPT_EURC) return [usdc];

  const asset = cfg.X402_EURC_ASSET || EURC_DEFAULT_ASSET[cfg.X402_NETWORK];
  if (!asset) {
    console.error(
      `[x402] X402_ACCEPT_EURC=true but no EURC address known for ${cfg.X402_NETWORK} — set X402_EURC_ASSET. Offering USDC only.`
    );
    return [usdc];
  }
  const eurc = {
    scheme: "exact" as const,
    price: {
      asset,
      amount: decimalToAtomic(
        kind === "write" ? cfg.X402_EURC_PRICE_WRITE : cfg.X402_EURC_PRICE_READ
      ),
      extra: { name: cfg.X402_EURC_NAME, version: cfg.X402_EURC_VERSION },
    },
    network: cfg.X402_NETWORK,
    payTo: cfg.X402_PAY_TO,
  };
  return [usdc, eurc];
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

  const accepts = (kind: "write" | "read") => ({
    accepts: buildAccepts(cfg, kind) as never,
  });

  const routes = {
    "POST /api/v1/payments/initiate": {
      ...accepts("write"),
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
      ...accepts("read"),
      description: "Verify a payment's status",
      extensions: declareDiscoveryExtension({
        input: {},
        inputSchema: { type: "object", properties: {} },
      }),
    },
    "POST /api/v1/payments/:id/refund": {
      ...accepts("write"),
      description: "Refund a payment (full or partial)",
    },
    "GET /api/v1/payments": {
      ...accepts("read"),
      description: "List transactions",
    },
    "POST /api/v1/payment-links": {
      ...accepts("write"),
      description: "Create a shareable payment link",
    },
    "POST /api/v1/payouts/initiate": {
      ...accepts("write"),
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
      ...accepts("read"),
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
    const sleep = (ms: number) =>
      new Promise<void>((r) => setTimeout(r, ms).unref());

    // First attempt is awaited so a healthy boot is fully validated; failures
    // retry in a detached background loop (linear backoff, capped) and never
    // crash or block the gateway. NOTE: the repo's withRetry() is deliberately
    // NOT used here — its retryable-error filter would skip facilitator init
    // errors, and we want retry-on-anything semantics for this path.
    if (!(await sync(1))) {
      void (async () => {
        for (let attempt = 2; attempt <= MAX_ATTEMPTS; attempt++) {
          await sleep(Math.min(attempt * 5_000, 60_000));
          if (await sync(attempt)) return;
        }
        console.error(
          "[x402] giving up on facilitator sync — priced requests will error until restart"
        );
      })();
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
 * Create the combined billing middleware: API-key requests go through strict
 * key auth; keyless requests go through the x402 payment door. The
 * x402-disabled case never reaches here — http.ts falls back to plain
 * `createAuthMiddleware(db)` when no billing middleware is provided.
 */
export function createBillingMiddleware(
  db: PostgresJsDatabase,
  x402: RequestHandler
): RequestHandler {
  const apiKeyAuth = createAuthMiddleware(db);

  return (req: Request, res: Response, next: NextFunction) => {
    // Door 1: an API key is present → strict key auth, success or 401/403.
    // A present-but-invalid key is rejected, never downgraded to payment.
    if (req.headers["x-api-key"]) {
      return apiKeyAuth(req, res, next);
    }
    // Door 2: no key → pay-per-call.
    return x402(req, res, next);
  };
}
