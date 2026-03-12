import crypto from "node:crypto";
import { eq, and } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { apiKeys } from "../../db/schema.js";

export function createAuthMiddleware(db: PostgresJsDatabase) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers["x-api-key"] as string | undefined;

    if (!apiKey) {
      res.status(401).json({ error: "Missing X-Api-Key header" });
      return;
    }

    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

    const [key] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.active, true)))
      .limit(1);

    if (!key) {
      res.status(403).json({ error: "Invalid API key" });
      return;
    }

    // Update last used timestamp (fire-and-forget)
    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, key.id))
      .catch(() => {});

    // Attach key info to request
    (req as any).apiKeyLabel = key.label;
    (req as any).apiKeyPermissions = key.permissions;
    (req as any).apiKeyRateLimit = key.rateLimitPerMinute;

    next();
  };
}
