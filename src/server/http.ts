import express from "express";
import helmet from "helmet";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import { validateBody } from "./middleware/validate.js";
import {
  InitiatePaymentSchema,
  VerifyPaymentSchema,
  RefundPaymentSchema,
  ListTransactionsSchema,
  GeneratePaymentLinkSchema,
  InitiatePayoutSchema,
  VerifyPayoutSchema,
} from "../tools/definitions.js";
import { initiatePayment } from "../tools/initiate-payment.js";
import { verifyPayment } from "../tools/verify-payment.js";
import { refundPayment } from "../tools/refund-payment.js";
import { listTransactions } from "../tools/list-transactions.js";
import { generatePaymentLink } from "../tools/generate-payment-link.js";
import { listProviders } from "../tools/list-providers.js";
import { initiatePayout } from "../tools/initiate-payout.js";
import { verifyPayout } from "../tools/verify-payout.js";
import { handleProviderWebhook } from "../webhooks/handler.js";
import { HttpError } from "../utils/http-error.js";
import { createPrepaidChargeMiddleware } from "./middleware/prepaid.js";
import { getBalance } from "../billing/credits.js";
import type { AuthenticatedRequest } from "./middleware/auth.js";
import { getConfig } from "../config.js";
import { generateIdempotencyKey } from "../utils/idempotency.js";
import { z } from "zod";

/** Sanitize errors for HTTP responses — never leak provider internals. */
function safeError(err: unknown): { status: number; body: { error: string } } {
  if (err instanceof HttpError) {
    console.error(`[provider-error] ${err.message}`);
    return {
      status: err.status >= 500 ? 502 : err.status,
      body: { error: "Payment provider error" },
    };
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  if (message.includes("not found")) {
    return { status: 404, body: { error: message } };
  }
  console.error(`[error] ${message}`);
  return { status: 500, body: { error: "Internal server error" } };
}

export function createHttpServer(
  db: PostgresJsDatabase,
  port: number,
  billing?: express.RequestHandler
) {
  const app = express();

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
      },
    },
  }));

  // Raw body needed for webhook signature verification
  app.use("/api/v1/webhooks", express.raw({ type: "*/*" }));
  app.use(express.json());

  // Billing doors:
  //  1. X-Api-Key (always) — via `billing` (dual-door) or legacy auth.
  //  2. x402 pay-per-call — inside `billing` when enabled.
  //  3. Prepaid XOF credits — per-route charge handlers after auth, with an
  //     explicit price class (same read/write classes as the x402 route map).
  //     Express composes handler arrays natively; billing routes use bare
  //     `auth` and are therefore never charged.
  const auth = billing ?? createAuthMiddleware(db);
  const authWrite: express.RequestHandler[] = [auth, createPrepaidChargeMiddleware(db, "write")];
  const authRead: express.RequestHandler[] = [auth, createPrepaidChargeMiddleware(db, "read")];

  // Health check — no auth
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", ts: new Date().toISOString(), version: "2.0.0" });
  });

  // Providers — no auth (info only)
  app.get("/api/v1/providers", (_req, res) => {
    res.json(listProviders());
  });

  // Payment endpoints — auth + rate limit
  app.post(
    "/api/v1/payments/initiate",
    ...authWrite,
    rateLimitMiddleware,
    validateBody(InitiatePaymentSchema),
    async (req, res) => {
      try {
        const result = await initiatePayment(db, req.body);
        res.status(201).json(result);
      } catch (err) {
        const { status, body } = safeError(err);
        res.status(status).json(body);
      }
    }
  );

  app.get("/api/v1/payments/:id", ...authRead, async (req, res) => {
    try {
      const parsed = VerifyPaymentSchema.parse({ transactionId: req.params.id });
      const result = await verifyPayment(db, parsed.transactionId);
      res.json(result);
    } catch (err) {
      const { status, body } = safeError(err);
      res.status(status).json(body);
    }
  });

  app.post("/api/v1/payments/:id/refund", ...authWrite, rateLimitMiddleware, async (req, res) => {
    try {
      const parsed = RefundPaymentSchema.parse({
        transactionId: req.params.id,
        ...req.body,
      });
      const result = await refundPayment(db, parsed.transactionId, parsed.amount, parsed.reason);
      res.json(result);
    } catch (err) {
      const { status, body } = safeError(err);
      res.status(status).json(body);
    }
  });

  app.get("/api/v1/payments", ...authRead, async (req, res) => {
    try {
      const parsed = ListTransactionsSchema.parse({
        provider: req.query.provider,
        status: req.query.status,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });
      const result = await listTransactions(db, parsed);
      res.json(result);
    } catch (err) {
      const { status, body } = safeError(err);
      res.status(status).json(body);
    }
  });

  app.post(
    "/api/v1/payment-links",
    ...authWrite,
    rateLimitMiddleware,
    validateBody(GeneratePaymentLinkSchema),
    async (req, res) => {
      try {
        const result = await generatePaymentLink(db, req.body);
        res.status(201).json(result);
      } catch (err) {
        const { status, body } = safeError(err);
        res.status(status).json(body);
      }
    }
  );

  // Payout endpoints
  app.post(
    "/api/v1/payouts/initiate",
    ...authWrite,
    rateLimitMiddleware,
    validateBody(InitiatePayoutSchema),
    async (req, res) => {
      try {
        const result = await initiatePayout(db, req.body);
        res.status(201).json(result);
      } catch (err) {
        const { status, body } = safeError(err);
        res.status(status).json(body);
      }
    }
  );

  app.get("/api/v1/payouts/:id", ...authRead, async (req, res) => {
    try {
      const parsed = VerifyPayoutSchema.parse({ payoutId: req.params.id });
      const result = await verifyPayout(db, parsed.payoutId);
      res.json(result);
    } catch (err) {
      const { status, body } = safeError(err);
      res.status(status).json(body);
    }
  });

  // --- Prepaid credit billing (door 3) ---
  // Top-ups are collected through WariMCP itself: the operator's own PSP
  // account collects the XOF, and the completed-payment webhook credits the
  // buyer's account (see webhooks/handler.ts). These routes require an API
  // key and are never themselves charged.
  app.get("/api/v1/billing/balance", auth, async (req, res) => {
    const { apiKeyId } = req as AuthenticatedRequest;
    if (!apiKeyId) {
      res.status(401).json({ error: "Billing endpoints require an API key" });
      return;
    }
    res.json(await getBalance(db, apiKeyId));
  });

  const TopupSchema = z.object({
    amount: z.number().int().min(getConfig().BILLING_TOPUP_MIN_XOF).max(5_000_000),
    provider: z.string().optional().default(""),
    customerPhone: z.string().min(8),
    customerName: z.string().optional().default(""),
  });

  app.post(
    "/api/v1/billing/topup",
    auth,
    rateLimitMiddleware,
    validateBody(TopupSchema),
    async (req, res) => {
    try {
      const { apiKeyId, apiKeyLabel } = req as AuthenticatedRequest;
      if (!apiKeyId) {
        res.status(401).json({ error: "Billing endpoints require an API key" });
        return;
      }
      const cfg = getConfig();
      if (!cfg.BILLING_PREPAID_ENABLED) {
        res.status(404).json({ error: "Prepaid billing is not enabled on this instance" });
        return;
      }
      const { amount, provider, customerPhone, customerName } = req.body;

      // Dogfood: collect the top-up through WariMCP's own payment pipeline,
      // on the operator's PSP account. Metadata marks it for crediting.
      const result = await initiatePayment(db, {
        provider: provider || cfg.BILLING_TOPUP_PROVIDER,
        amount,
        currency: "XOF",
        idempotencyKey: generateIdempotencyKey(),
        description: "WariMCP API credit top-up",
        customerName: customerName || apiKeyLabel || "API customer",
        customerEmail: "",
        customerPhone,
        returnUrl: "",
        notifyUrl: "",
        callbackUrl: "",
        metadata: { warimcp_topup: true, apiKeyId },
      });

      res.status(201).json({
        transactionId: result.transactionId,
        provider: result.provider,
        status: result.status,
        paymentUrl: result.paymentUrl,
        amountXof: amount,
        note: "Complete the checkout; credits are applied when the provider confirms payment.",
      });
    } catch (err) {
      const { status, body } = safeError(err);
      res.status(status).json(body);
    }
  });

  // NOTE: The manual-payment-collection feature (personal Wave/OM account +
  // SMS reconciliation) was removed 2026-06-12 — it was unlicensed payment
  // collection under BCEAO Instruction n°001-01-2024 and incompatible with the
  // BYOK no-custody posture. WariMCP only instructs licensed PSPs; it never
  // collects funds into an LTS-controlled account. Do not reintroduce it.

  // Webhook endpoints — NO auth, signature verification handled internally
  app.post("/api/v1/webhooks/:provider", async (req, res) => {
    try {
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf-8") : JSON.stringify(req.body);
      const body = Buffer.isBuffer(req.body) ? JSON.parse(rawBody) : req.body;
      const provider = req.params.provider;
      const signature =
        provider === "cinetpay"
          ? (req.headers["x-cp-signature"] as string | undefined)
          : (req.headers["wave-signature"] as string | undefined);

      const result = await handleProviderWebhook(
        db,
        provider,
        body,
        rawBody,
        signature
      );

      res.status(result.accepted ? 200 : 400).json(result);
    } catch (err) {
      res.status(500).json({ error: "Webhook processing error" });
    }
  });

  // Global error sanitization — prevent provider internals from leaking
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      if (err instanceof HttpError) {
        console.error(`[provider-error] ${err.message}`);
        res.status(err.status >= 500 ? 502 : err.status).json({
          error: "Payment provider error",
          code: "PROVIDER_ERROR",
        });
        return;
      }
      console.error(`[error] ${err.message}`);
      res.status(500).json({ error: "Internal server error" });
    }
  );

  const server = app.listen(port, () => {
    console.error(`WariMCP HTTP server listening on port ${port}`);
  });

  return server;
}
