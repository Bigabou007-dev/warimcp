import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { getConfig } from "../../config.js";
import { chargeCredits } from "../../billing/credits.js";
import type { AuthenticatedRequest } from "./auth.js";

/**
 * Per-call prepaid charging — the express adapter over billing/credits.ts.
 *
 * Wired per-route in http.ts with an explicit price class ("write"/"read"),
 * AFTER auth. No-ops for:
 *  - x402-paid requests (no apiKeyId on the request)
 *  - keys without a credit account (subscription keys) — detected for free
 *    by the auth middleware's LEFT JOIN, so non-prepaid traffic pays zero
 *    extra DB round-trips.
 *
 * When a charge is due, it's a single conditional UPDATE (see
 * billing/credits.ts); since the account is known to exist, a null result
 * unambiguously means insufficient funds → 402 with a top-up pointer.
 */
export function createPrepaidChargeMiddleware(
  db: PostgresJsDatabase,
  kind: "write" | "read",
  deps: { charge?: typeof chargeCredits } = {}
): RequestHandler {
  const charge = deps.charge ?? chargeCredits;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cfg = getConfig();
      const { apiKeyId, hasCreditAccount } = req as AuthenticatedRequest;

      if (!cfg.BILLING_PREPAID_ENABLED || !apiKeyId || !hasCreditAccount) {
        return next();
      }

      const price =
        kind === "write" ? cfg.BILLING_PRICE_WRITE_XOF : cfg.BILLING_PRICE_READ_XOF;
      const reason = `charge:${req.method.toUpperCase()} ${req.path}`;
      const newBalance = await charge(db, apiKeyId, price, reason);

      if (newBalance === null) {
        res.status(402).json({
          error: "Insufficient credit",
          priceXof: price,
          topUp: "POST /api/v1/billing/topup",
        });
        return;
      }

      res.setHeader("X-Credit-Balance-XOF", String(newBalance));
      next();
    } catch (err) {
      next(err as Error);
    }
  };
}
