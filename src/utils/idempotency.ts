import crypto from "node:crypto";

export function generateIdempotencyKey(): string {
  return `idem_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function validateIdempotencyKey(key: string): string | null {
  if (!key || key.length < 6 || key.length > 128) {
    return "Idempotency key must be 6-128 characters";
  }
  return null;
}
