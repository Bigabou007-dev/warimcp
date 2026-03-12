import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { webhookEvents } from "../db/schema.js";
import { getConfig } from "../config.js";
import { withRetry } from "../providers/retry.js";

export interface RelayPayload {
  event: string;
  transactionId: string;
  provider: string;
  amount: number;
  currency: string;
  status: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

function signRelay(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export async function relayWebhook(
  db: PostgresJsDatabase,
  webhookEventId: string,
  callbackUrl: string,
  payload: RelayPayload
) {
  const config = getConfig();
  const body = JSON.stringify(payload);
  const signature = config.WARIMCP_RELAY_SECRET
    ? signRelay(body, config.WARIMCP_RELAY_SECRET)
    : "";

  try {
    await withRetry(
      async () => {
        const res = await fetch(callbackUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-WariMCP-Signature": signature,
            "X-WariMCP-Event": payload.event,
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) {
          const err = new Error(`Relay failed: HTTP ${res.status}`);
          (err as any).status = res.status;
          throw err;
        }
      },
      { maxRetries: 3, baseDelayMs: 2000 }
    );

    await db
      .update(webhookEvents)
      .set({ relayStatus: "relayed", processedAt: new Date() })
      .where(eq(webhookEvents.id, webhookEventId));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db
      .update(webhookEvents)
      .set({
        relayStatus: "failed",
        relayAttempts: 4, // 1 initial + 3 retries
        relayLastError: message,
      })
      .where(eq(webhookEvents.id, webhookEventId));
  }
}
