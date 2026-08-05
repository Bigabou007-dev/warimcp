// test/unit/tools/authorize-and-pay.test.ts
// Env preamble required by Zod config schema before any import resolves.
process.env.WARIMCP_MODE = "mock";
process.env.WARIMCP_TRANSPORT = "http";
process.env.WARIMCP_PORT = "3000";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

import { describe, it, expect, beforeEach } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { resetConfig } from "../../../src/config.js";
import { canonicalMandateBytes, type PaymentMandate } from "../../../src/bridge/authorization.js";
import { handleAuthorizeAndPay } from "../../../src/tools/authorize-and-pay.js";
import { AuthorizeAndPaySchema } from "../../../src/tools/definitions.js";

// Minimal in-memory db stub: idempotency check returns empty, writes are no-ops.
// Adaptation: brief calls handleAuthorizeAndPay without db; the actual handler
// requires db (same as initiatePayment). We pass a stub so the mock provider
// path succeeds without a real Postgres connection.
// Every method call is recorded in callLog so tests can prove zero db
// interaction on rejection. failOnInsert simulates a db failure mid-payment.
function makeStubDb(opts: { failOnInsert?: boolean } = {}) {
  const callLog: string[] = [];
  const stub = {
    select: () => { callLog.push("select"); return stub; },
    from: () => { callLog.push("from"); return stub; },
    where: () => { callLog.push("where"); return stub; },
    limit: () => { callLog.push("limit"); return Promise.resolve([]); }, // idempotency check: no existing tx
    insert: () => { callLog.push("insert"); return stub; },
    values: () => { callLog.push("values"); return stub; },
    returning: () => {
      callLog.push("returning");
      if (opts.failOnInsert) return Promise.reject(new Error("db down"));
      return Promise.resolve([{
        id: "00000000-0000-0000-0000-000000000001",
        provider: "mock",
        status: "pending",
        paymentUrl: null,
      }]);
    },
    update: () => { callLog.push("update"); return stub; },
    set: () => { callLog.push("set"); return stub; },
  };
  return { db: stub as unknown as PostgresJsDatabase, callLog };
}

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const pem = publicKey.export({ type: "spki", format: "pem" }).toString();

function signedMandate(nonce: string, key = privateKey): { mandate: PaymentMandate; signature: string } {
  const mandate: PaymentMandate = {
    amount: 500,
    currency: "XOF",
    merchantRef: "pilot-1",
    expiresAtMs: Date.now() + 60_000,
    nonce,
  };
  const signature = sign(null, canonicalMandateBytes(mandate), key).toString("base64");
  return { mandate, signature };
}

const baseArgs = {
  provider: "mock",
  customerPhone: "00000001",
  returnUrl: "https://x/r",
  notifyUrl: "https://x/n",
};

const { mandate, signature } = signedMandate("once-1");

// Trust anchor comes from server config, never caller input — inject the test
// keypair via the config-cache pattern (env + resetConfig) before each test.
beforeEach(() => {
  process.env.WARIMCP_TRUSTED_AGENT_KEYS = pem;
  resetConfig();
});

it("verifies then pays via the mock provider", async () => {
  const { db } = makeStubDb();
  const r = await handleAuthorizeAndPay(db, { mandate, signature, ...baseArgs });
  expect(r.authorized).toBe(true);
  expect(r.payment?.providerReference).toBeTruthy();
});

it("refuses to touch any provider on bad signature", async () => {
  const { db, callLog } = makeStubDb();
  const r = await handleAuthorizeAndPay(db, {
    mandate: { ...mandate, amount: 9_999_999 },
    signature,
    ...baseArgs,
  });
  expect(r.authorized).toBe(false);
  expect(r.authorized === false && r.reason).toBe("bad_signature");
  expect(r.payment).toBeUndefined();
  expect(callLog).toEqual([]); // zero db interaction on rejection
});

it("rejects a replayed nonce on the second successful call", async () => {
  const { mandate: m, signature: s } = signedMandate("replay-1");
  const first = await handleAuthorizeAndPay(makeStubDb().db, { mandate: m, signature: s, ...baseArgs });
  expect(first.authorized).toBe(true);

  const second = await handleAuthorizeAndPay(makeStubDb().db, { mandate: m, signature: s, ...baseArgs });
  expect(second.authorized).toBe(false);
  expect(second.authorized === false && second.reason).toBe("replayed");
  expect(second.payment).toBeUndefined();
});

it("does NOT consume the nonce when the payment path throws — retry succeeds", async () => {
  const { mandate: m, signature: s } = signedMandate("retry-1");

  // First attempt: db insert fails → handler throws; nonce must NOT be consumed.
  const failing = makeStubDb({ failOnInsert: true });
  await expect(handleAuthorizeAndPay(failing.db, { mandate: m, signature: s, ...baseArgs }))
    .rejects.toThrow(/db down/);

  // Retry with a working db: must pass verification again (NOT "replayed") and succeed.
  const retry = await handleAuthorizeAndPay(makeStubDb().db, { mandate: m, signature: s, ...baseArgs });
  expect(retry.authorized).toBe(true);
  expect(retry.payment?.providerReference).toBeTruthy();
});

describe("trusted-key allowlist (fail closed)", () => {
  it("rejects with no_trusted_keys_configured when the allowlist is empty — no db interaction", async () => {
    process.env.WARIMCP_TRUSTED_AGENT_KEYS = "";
    resetConfig();
    const { db, callLog } = makeStubDb();
    const { mandate: m, signature: s } = signedMandate("empty-allowlist-1");
    const r = await handleAuthorizeAndPay(db, { mandate: m, signature: s, ...baseArgs });
    expect(r.authorized).toBe(false);
    expect(r.authorized === false && r.reason).toBe("no_trusted_keys_configured");
    expect(callLog).toEqual([]);
  });

  it("rejects a mandate signed by a NON-allowlisted key with bad_signature", async () => {
    const rogue = generateKeyPairSync("ed25519");
    const { mandate: m, signature: s } = signedMandate("rogue-1", rogue.privateKey);
    const { db, callLog } = makeStubDb();
    const r = await handleAuthorizeAndPay(db, { mandate: m, signature: s, ...baseArgs });
    expect(r.authorized).toBe(false);
    expect(r.authorized === false && r.reason).toBe("bad_signature");
    expect(callLog).toEqual([]);
  });
});

describe("mandate schema bounds (parity with initiate_payment)", () => {
  const validInput = {
    mandate: { ...mandate, nonce: "schema-1" },
    signature,
    ...baseArgs,
  };

  it("accepts a mandate within bounds", () => {
    expect(() => AuthorizeAndPaySchema.parse(validInput)).not.toThrow();
  });

  it("rejects mandate amount 0 at schema parse", () => {
    expect(() =>
      AuthorizeAndPaySchema.parse({ ...validInput, mandate: { ...validInput.mandate, amount: 0 } })
    ).toThrow();
  });

  it("rejects negative mandate amount at schema parse", () => {
    expect(() =>
      AuthorizeAndPaySchema.parse({ ...validInput, mandate: { ...validInput.mandate, amount: -500 } })
    ).toThrow();
  });

  it("rejects mandate amount above the 5,000,000 cap at schema parse", () => {
    expect(() =>
      AuthorizeAndPaySchema.parse({ ...validInput, mandate: { ...validInput.mandate, amount: 5_000_001 } })
    ).toThrow();
  });
});
