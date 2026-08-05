import { eq, and } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { transactions, webhookEvents, auditLog } from "../db/schema.js";
import { verifyWaveWebhook, parseWaveEvent } from "./verify-wave.js";
import { verifyHub2Webhook, parseHub2Event } from "./verify-hub2.js";
import { relayWebhook } from "./relay.js";
import { getConfig } from "../config.js";
import type { RelayPayload } from "./relay.js";

interface WebhookResult {
  accepted: boolean;
  message: string;
}

export async function handleProviderWebhook(
  db: PostgresJsDatabase,
  provider: string,
  body: Record<string, unknown>,
  rawBody: string,
  signatureHeader?: string
): Promise<WebhookResult> {
  let signatureValid = false;
  let parsed: { providerReference: string; eventType: string; status: string };

  if (provider === "wave") {
    signatureValid = verifyWaveWebhook(rawBody, signatureHeader);
    parsed = parseWaveEvent(body);
  } else if (provider === "hub2") {
    const config = getConfig();
    const expectedMode = config.WARIMCP_MODE === "live" ? "live" : "sandbox";
    const result = verifyHub2Webhook(rawBody, signatureHeader, {
      secret: config.HUB2_WEBHOOK_SECRET,
      expectedMode,
      nowMs: Date.now(),
    });
    signatureValid = result.ok;
    parsed = parseHub2Event(body);
  } else {
    return { accepted: false, message: `Unknown provider: ${provider}` };
  }

  if (!signatureValid) {
    // Still log it but mark as invalid
    await db.insert(webhookEvents).values({
      provider,
      eventType: "unverified",
      rawPayload: body,
      signatureValid: false,
    });
    return { accepted: false, message: "Invalid webhook signature" };
  }

  // Find the matching transaction
  const [tx] = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.provider, provider),
        eq(transactions.providerReference, parsed.providerReference)
      )
    )
    .limit(1);

  // Store webhook event
  const [webhookEvent] = await db
    .insert(webhookEvents)
    .values({
      transactionId: tx?.id || null,
      provider,
      eventType: parsed.eventType,
      rawPayload: body,
      signatureValid: true,
      processed: !!tx,
    })
    .returning();

  if (!tx) {
    return {
      accepted: true,
      message: `Webhook received but no matching transaction for provider_ref: ${parsed.providerReference}`,
    };
  }

  // Update transaction status if changed
  if (parsed.status !== tx.status && (parsed.status === "completed" || parsed.status === "failed")) {
    await db
      .update(transactions)
      .set({
        status: parsed.status,
        updatedAt: new Date(),
        completedAt: parsed.status === "completed" ? new Date() : undefined,
      })
      .where(eq(transactions.id, tx.id));

    await db.insert(auditLog).values({
      transactionId: tx.id,
      action: "webhook_received",
      actor: `webhook:${provider}`,
      details: { eventType: parsed.eventType, newStatus: parsed.status },
    });
  }

  // Relay to callback URL if configured
  if (tx.callbackUrl) {
    const relayPayload: RelayPayload = {
      event: parsed.eventType,
      transactionId: tx.id,
      provider: tx.provider,
      amount: tx.amount,
      currency: tx.currency,
      status: parsed.status,
      metadata: (tx.metadata as Record<string, unknown>) || {},
      timestamp: new Date().toISOString(),
    };

    // Fire and forget — relay handles its own retries
    relayWebhook(db, webhookEvent.id, tx.callbackUrl, relayPayload).catch(() => {});
  }

  return { accepted: true, message: "Webhook processed" };
}
