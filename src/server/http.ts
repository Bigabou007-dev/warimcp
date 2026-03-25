import express from "express";
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
import { smsWebhookRouter } from "../manual-payments/sms-webhook.js";
import { paymentPageRouter } from "../manual-payments/payment-page.js";
import { expireStaleReferences } from "../manual-payments/reference-generator.js";

export function createHttpServer(db: PostgresJsDatabase, port: number) {
  const app = express();

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
        res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
      }
    }
  );

  app.get("/api/v1/payments/:id", auth, async (req, res) => {
    try {
      const parsed = VerifyPaymentSchema.parse({ transactionId: req.params.id });
      const result = await verifyPayment(db, parsed.transactionId);
      res.json(result);
    } catch (err) {
      res.status(err instanceof Error && err.message.includes("not found") ? 404 : 500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
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
      res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
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
      res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
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
        res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
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
        res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
      }
    }
  );

  app.get("/api/v1/payouts/:id", auth, async (req, res) => {
    try {
      const parsed = VerifyPayoutSchema.parse({ payoutId: req.params.id });
      const result = await verifyPayout(db, parsed.payoutId);
      res.json(result);
    } catch (err) {
      res.status(err instanceof Error && err.message.includes("not found") ? 404 : 500).json({
        error: err instanceof Error ? err.message : "Internal error",
      });
    }
  });

  // Manual payment routes — no auth (public-facing)
  app.use("/api/sms-webhook", smsWebhookRouter);
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
      const signature = req.headers["wave-signature"] as string | undefined;

      const result = await handleProviderWebhook(
        db,
        req.params.provider,
        body,
        rawBody,
        signature
      );

      res.status(result.accepted ? 200 : 400).json(result);
    } catch (err) {
      res.status(500).json({ error: "Webhook processing error" });
    }
  });

  const server = app.listen(port, () => {
    console.error(`WariMCP HTTP server listening on port ${port}`);
  });

  return server;
}
