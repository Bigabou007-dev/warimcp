import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth.js";

const buckets = new Map<string, { tokens: number; lastRefill: number }>();

const DEFAULT_RATE = 60; // per minute
const WINDOW_MS = 60_000;

// Clean up old buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > WINDOW_MS * 5) {
      buckets.delete(key);
    }
  }
}, 300_000).unref();

export function rateLimitMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-api-key"] as string || "anonymous";
  const limit = req.apiKeyRateLimit || DEFAULT_RATE;
  const now = Date.now();

  let bucket = buckets.get(apiKey);
  if (!bucket) {
    bucket = { tokens: limit, lastRefill: now };
    buckets.set(apiKey, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  const refill = Math.floor((elapsed / WINDOW_MS) * limit);
  if (refill > 0) {
    bucket.tokens = Math.min(limit, bucket.tokens + refill);
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) {
    res.status(429).json({ error: "Rate limit exceeded" });
    return;
  }

  bucket.tokens--;
  next();
}
