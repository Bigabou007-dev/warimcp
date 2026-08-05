/**
 * Agent authorization module — Ed25519 mandate verification.
 *
 * No-custody invariant: this module verifies agent-signed mandates.
 * WariMCP never holds keys or funds; the agent's key signs; we verify.
 *
 * Check order (security-relevant):
 *   1. Signature — so unsigned input cannot probe expiry/replay state.
 *   2. Expiry — reject stale mandates.
 *   3. Replay — reject seen nonces.
 */

import { createPublicKey, verify } from "node:crypto";

export interface PaymentMandate {
  amount: number;
  currency: string;
  merchantRef: string;
  expiresAtMs: number;
  nonce: string;
}

/**
 * Canonical bytes for signing/verifying.
 * Array form guarantees stable key order without sorting.
 *
 * JSON.stringify of this array is injective for the
 * (number, string, string, number, string) tuple: strings are JSON-quoted
 * and escaped, so no two distinct mandates serialize to the same bytes.
 * Adding, removing, or reordering fields is a BREAKING CHANGE to the
 * signing contract — existing signatures would no longer verify.
 */
export function canonicalMandateBytes(m: PaymentMandate): Buffer {
  const arr = [m.amount, m.currency, m.merchantRef, m.expiresAtMs, m.nonce];
  return Buffer.from(JSON.stringify(arr), "utf8");
}

export function verifyMandate(
  mandate: PaymentMandate,
  signatureB64: string,
  publicKeyPem: string,
  opts: { nowMs: number; seenNonces: Set<string> },
): { ok: true } | { ok: false; reason: "bad_signature" | "expired" | "replayed" } {
  // Step 1: Verify signature FIRST — attacker must not probe expiry/replay with unsigned input.
  let sigValid: boolean;
  try {
    const keyObject = createPublicKey(publicKeyPem);
    const sigBytes = Buffer.from(signatureB64, "base64");
    const dataBytes = canonicalMandateBytes(mandate);
    sigValid = verify(null, dataBytes, keyObject, sigBytes);
  } catch {
    return { ok: false, reason: "bad_signature" };
  }

  if (!sigValid) {
    return { ok: false, reason: "bad_signature" };
  }

  // Step 2: Check expiry.
  if (opts.nowMs >= mandate.expiresAtMs) {
    return { ok: false, reason: "expired" };
  }

  // Step 3: Check replay.
  if (opts.seenNonces.has(mandate.nonce)) {
    return { ok: false, reason: "replayed" };
  }

  // Caller is responsible for adding the nonce to seenNonces on success.
  return { ok: true };
}
