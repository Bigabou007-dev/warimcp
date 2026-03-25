import express from "express";
import helmet from "helmet";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { rateLimitMiddleware, smsRateLimitMiddleware } from "./middleware/rate-limit.js";
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
import { smsWebhookRouter } from "../manual-payments/sms-webhook.js";
import { paymentPageRouter } from "../manual-payments/payment-page.js";
import { expireStaleReferences } from "../manual-payments/reference-generator.js";

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

export function createHttpServer(db: PostgresJsDatabase, port: number) {
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

  const auth = createAuthMiddleware(db);

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
    auth,
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

  app.get("/api/v1/payments/:id", auth, async (req, res) => {
    try {
      const parsed = VerifyPaymentSchema.parse({ transactionId: req.params.id });
      const result = await verifyPayment(db, parsed.transactionId);
      res.json(result);
    } catch (err) {
      const { status, body } = safeError(err);
      res.status(status).json(body);
    }
  });

  app.post("/api/v1/payments/:id/refund", auth, rateLimitMiddleware, async (req, res) => {
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

  app.get("/api/v1/payments", auth, async (req, res) => {
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
    auth,
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
    auth,
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

  app.get("/api/v1/payouts/:id", auth, async (req, res) => {
    try {
      const parsed = VerifyPayoutSchema.parse({ payoutId: req.params.id });
      const result = await verifyPayout(db, parsed.payoutId);
      res.json(result);
    } catch (err) {
      const { status, body } = safeError(err);
      res.status(status).json(body);
    }
  });

  // Manual payment routes — no auth (public-facing)
  app.use("/api/sms-webhook", smsRateLimitMiddleware, smsWebhookRouter);
  app.use("/pay", paymentPageRouter);

  // Clean up stale payment references every 5 minutes
  setInterval(() => {
    const removed = expireStaleReferences();
    if (removed > 0) {
      console.error(`[manual-payments] Expired ${removed} stale reference(s)`);
    }
  }, 5 * 60 * 1000);

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
