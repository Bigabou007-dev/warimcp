// test/unit/bridge/authorization.test.ts
import { describe, it, expect } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { verifyMandate, canonicalMandateBytes, type PaymentMandate } from "../../../src/bridge/authorization.js";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
const now = 1_700_000_000_000;
const mandate: PaymentMandate = { amount: 1000, currency: "XOF", merchantRef: "m-1", expiresAtMs: now + 60_000, nonce: "n-1" };
const goodSig = sign(null, canonicalMandateBytes(mandate), privateKey).toString("base64");

describe("verifyMandate", () => {
  it("accepts a valid, unexpired, fresh mandate", () => {
    expect(verifyMandate(mandate, goodSig, pem, { nowMs: now, seenNonces: new Set() })).toEqual({ ok: true });
  });
  it("rejects tampered amount", () => {
    const r = verifyMandate({ ...mandate, amount: 9999 }, goodSig, pem, { nowMs: now, seenNonces: new Set() });
    expect(r).toEqual({ ok: false, reason: "bad_signature" });
  });
  it("rejects expired mandate", () => {
    const r = verifyMandate(mandate, goodSig, pem, { nowMs: now + 120_000, seenNonces: new Set() });
    expect(r).toEqual({ ok: false, reason: "expired" });
  });
  it("rejects replayed nonce", () => {
    const seen = new Set(["n-1"]);
    expect(verifyMandate(mandate, goodSig, pem, { nowMs: now, seenNonces: seen })).toEqual({ ok: false, reason: "replayed" });
  });
  it("rejects at the exact expiry instant (inclusive boundary: nowMs === expiresAtMs is expired)", () => {
    const r = verifyMandate(mandate, goodSig, pem, { nowMs: mandate.expiresAtMs, seenNonces: new Set() });
    expect(r).toEqual({ ok: false, reason: "expired" });
  });
  it("returns bad_signature (no throw) on malformed PEM", () => {
    const r = verifyMandate(mandate, goodSig, "not a pem", { nowMs: now, seenNonces: new Set() });
    expect(r).toEqual({ ok: false, reason: "bad_signature" });
  });
  it("returns bad_signature (no throw) on non-base64 signature with valid PEM", () => {
    const r = verifyMandate(mandate, "!!!not-base64!!!", pem, { nowMs: now, seenNonces: new Set() });
    expect(r).toEqual({ ok: false, reason: "bad_signature" });
  });
});
