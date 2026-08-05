// test/unit/providers/hub2-webhook.test.ts
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyHub2Webhook } from "../../../src/webhooks/verify-hub2.js";

const SECRET = "whsec_test";
function sign(body: string, t: number) {
  const sig = createHmac("sha256", SECRET).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${sig}`;
}

describe("verifyHub2Webhook", () => {
  const now = 1_700_000_000_000;
  it("accepts a valid signature and matching mode even when test:false", () => {
    const body = JSON.stringify({ mode: "sandbox", test: false, id: "evt_1" });
    const r = verifyHub2Webhook(body, sign(body, Math.floor(now / 1000)), { secret: SECRET, expectedMode: "sandbox", nowMs: now });
    expect(r.ok).toBe(true);
  });
  it("rejects mode mismatch (live event hitting sandbox handler)", () => {
    const body = JSON.stringify({ mode: "live", test: false });
    const r = verifyHub2Webhook(body, sign(body, Math.floor(now / 1000)), { secret: SECRET, expectedMode: "sandbox", nowMs: now });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/mode/);
  });
  it("rejects tampered body and stale timestamp", () => {
    const body = JSON.stringify({ mode: "sandbox" });
    expect(verifyHub2Webhook(body + " ", sign(body, Math.floor(now / 1000)), { secret: SECRET, expectedMode: "sandbox", nowMs: now }).ok).toBe(false);
    expect(verifyHub2Webhook(body, sign(body, Math.floor(now / 1000) - 3600), { secret: SECRET, expectedMode: "sandbox", nowMs: now }).ok).toBe(false);
  });
  it("rejects missing header", () => {
    expect(verifyHub2Webhook("{}", undefined, { secret: SECRET, expectedMode: "sandbox", nowMs: now }).ok).toBe(false);
  });
});
