import crypto from "node:crypto";
import { eq, and } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { apiKeys, creditAccounts } from "../../db/schema.js";

/** Extended request properties set by auth middleware */
export interface AuthenticatedRequest extends Request {
  apiKeyId?: string;
  apiKeyLabel?: string;
  apiKeyPermissions?: string[];
  apiKeyRateLimit?: number;
  /** Set from the same lookup query (LEFT JOIN) — costs no extra round-trip. */
  hasCreditAccount?: boolean;
}

export function createAuthMiddleware(db: PostgresJsDatabase) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const apiKey = req.headers["x-api-key"] as string | undefined;

    if (!apiKey) {
      res.status(401).json({ error: "Missing X-Api-Key header" });
      return;
    }

    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

    // LEFT JOIN credit_accounts so prepaid billing can tell whether this key
    // is prepaid without a second query on the hot path.
    const [row] = await db
      .select({ key: apiKeys, creditAccountId: creditAccounts.id })
      .from(apiKeys)
      .leftJoin(creditAccounts, eq(creditAccounts.apiKeyId, apiKeys.id))
      .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.active, true)))
      .limit(1);

    if (!row) {
      res.status(403).json({ error: "Invalid API key" });
      return;
    }
    const key = row.key;

    // Update last used timestamp (fire-and-forget)
    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, key.id))
      .catch(() => {});

    // Attach key info to request
    req.apiKeyId = key.id;
    req.apiKeyLabel = key.label;
    req.apiKeyPermissions = key.permissions ?? undefined;
    req.apiKeyRateLimit = key.rateLimitPerMinute ?? undefined;
    req.hasCreditAccount = row.creditAccountId !== null;

    next();
  };
}
