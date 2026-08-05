import { createHmac, timingSafeEqual } from "node:crypto";

interface Hub2VerifyOpts {
  secret: string;
  expectedMode: "sandbox" | "live";
  nowMs: number;
}

interface Hub2VerifyResult {
  ok: boolean;
  reason?: string;
}

/**
 * Hub2 webhook verifier.
 *
 * Signature format: `t=<unix_seconds>,v1=<hex_hmac>`
 * HMAC payload: `"<t>.<rawBody>"` with HMAC-SHA256.
 *
 * IMPORTANT: mode check reads `event.mode` — NEVER `event.test`.
 * Hub2 sandbox sends `test: false`; relying on that field is the F1 regression.
 */
export function verifyHub2Webhook(
  rawBody: string,
  signatureHeader: string | undefined,
  opts: Hub2VerifyOpts
): Hub2VerifyResult {
  if (!signatureHeader) {
    return { ok: false, reason: "missing signature header" };
  }

  // Parse t=...,v1=... header
  const tMatch = signatureHeader.match(/(?:^|,)t=(\d+)(?:,|$)/);
  const v1Match = signatureHeader.match(/(?:^|,)v1=([0-9a-f]+)(?:,|$)/);

  if (!tMatch || !v1Match) {
    return { ok: false, reason: "malformed signature header" };
  }

  const t = parseInt(tMatch[1], 10);
  const v1 = v1Match[1];

  // Skew check ±300s
  const nowSeconds = Math.floor(opts.nowMs / 1000);
  if (Math.abs(nowSeconds - t) > 300) {
    return { ok: false, reason: "timestamp skew too large" };
  }

  // Compute expected HMAC-SHA256 over "{t}.{rawBody}"
  const expectedHex = createHmac("sha256", opts.secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");

  // Timing-safe compare — guard equal length first
  if (expectedHex.length !== v1.length) {
    return { ok: false, reason: "signature length mismatch" };
  }

  let sigValid: boolean;
  try {
    sigValid = timingSafeEqual(
      Buffer.from(expectedHex, "hex"),
      Buffer.from(v1, "hex")
    );
  } catch {
    return { ok: false, reason: "signature comparison failed" };
  }

  if (!sigValid) {
    return { ok: false, reason: "signature mismatch" };
  }

  // Defensively parse body to check mode
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "body is not valid JSON" };
  }

  // Mode check: read event.mode — NEVER event.test (F1 regression)
  if (event.mode !== opts.expectedMode) {
    return { ok: false, reason: `mode mismatch: got "${String(event.mode)}", expected "${opts.expectedMode}"` };
  }

  return { ok: true };
}

export function parseHub2Event(body: Record<string, unknown>) {
  const id = String(body.id || "");
  const type = String(body.type || body.event || "");

  let normalizedStatus: string;
  if (type === "payment.succeeded" || type === "payment.successful") normalizedStatus = "completed";
  else if (type === "payment.failed" || type === "payment.expired") normalizedStatus = "failed";
  else normalizedStatus = "pending";

  return {
    providerReference: id,
    eventType: `payment.${normalizedStatus}`,
    status: normalizedStatus,
  };
}
