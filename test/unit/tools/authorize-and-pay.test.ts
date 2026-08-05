// test/unit/tools/authorize-and-pay.test.ts
// Env preamble required by Zod config schema before any import resolves.
process.env.WARIMCP_MODE = "mock";
process.env.WARIMCP_TRANSPORT = "http";
process.env.WARIMCP_PORT = "3000";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

import { describe, it, expect } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { canonicalMandateBytes } from "../../../src/bridge/authorization.js";
import { handleAuthorizeAndPay } from "../../../src/tools/authorize-and-pay.js";

// Minimal in-memory db stub: idempotency check returns empty, writes are no-ops.
// Adaptation: brief calls handleAuthorizeAndPay without db; the actual handler
// requires db (same as initiatePayment). We pass a stub so the mock provider
// path succeeds without a real Postgres connection.
function makeStubDb() {
  const rows: Array<Record<string, unknown>> = [];
  const stub = {
    select: () => stub,
    from: () => stub,
    where: () => stub,
    limit: () => Promise.resolve([]), // idempotency check: no existing tx
    insert: () => stub,
    values: () => stub,
    returning: () => Promise.resolve([{
      id: "00000000-0000-0000-0000-000000000001",
      provider: "mock",
      status: "pending",
      paymentUrl: null,
    }]),
    update: () => stub,
    set: () => stub,
  };
  return stub as unknown as PostgresJsDatabase;
}

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
const mandate = {
  amount: 500,
  currency: "XOF",
  merchantRef: "pilot-1",
  expiresAtMs: Date.now() + 60_000,
  nonce: "once-1",
};
const signature = sign(null, canonicalMandateBytes(mandate), privateKey).toString("base64");

it("verifies then pays via the mock provider", async () => {
  const db = makeStubDb();
  const r = await handleAuthorizeAndPay(db, {
    mandate,
    signature,
    agentPublicKeyPem: pem,
    provider: "mock",
    customerPhone: "00000001",
    returnUrl: "https://x/r",
    notifyUrl: "https://x/n",
  });
  expect(r.authorized).toBe(true);
  expect(r.payment?.providerReference).toBeTruthy();
});

it("refuses to touch any provider on bad signature", async () => {
  const db = makeStubDb();
  const r = await handleAuthorizeAndPay(db, {
    mandate: { ...mandate, amount: 9_999_999 },
    signature,
    agentPublicKeyPem: pem,
    provider: "mock",
    customerPhone: "00000001",
    returnUrl: "https://x/r",
    notifyUrl: "https://x/n",
  });
  expect(r.authorized).toBe(false);
  expect(r.reason).toBe("bad_signature");
  expect(r.payment).toBeUndefined();
});
