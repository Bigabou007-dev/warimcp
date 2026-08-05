# WariMCP Agent-Payments Layer — Implementation Plan (Tracks 0–2 + Track 4 pre-gate)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the repo, replace the Hub2 stub with a sandbox-verified adapter ported from lagoon-website's proven shapes, and build the timeboxed agentic-bridge spike ending in a recorded demo.

**Architecture:** Existing provider-adapter pattern (`src/providers/base.ts` `BaseProvider` interface) gains a real `Hub2Provider` (intent → attempt flow, ApiKey/MerchantId/Environment headers). A new `src/bridge/` module verifies signed agent payment authorizations (I5 wallet-discipline spec) before any provider call. Demo drives the full loop against Hub2 sandbox.

**Tech Stack:** Node ≥22 / TypeScript, Express 5, Zod, Vitest, MCP SDK, `node:crypto`.

## Global Constraints (from spec — apply to every task)

- License: `main` stays MIT; `x402-billing-local` branch and its worktree are NEVER merged or touched.
- No publish steps (`npm publish`, `mcp-publisher`, dev.to) — deferred post-demo, board-gated.
- NO personal-account collection code, ever (BCEAO 001-01-2024; hard-removed 2026-06-12). `test/integration/no-manual-payment-routes.test.ts` must stay green.
- Sandbox keys only in test/demo paths. The live `FEDAPAY_*` values in `.env` must not be used by any task.
- Webhook env check discriminates on `event.mode`, NEVER `event.test` (Hub2 sandbox sends `test: false`).
- Git: merge only, no rebase of shared branches, no force-push, no AI co-author lines.
- Track 2 timebox: if AP2-style mandate verification conflicts with the no-custody posture by day 3, STOP and report to owner instead of forcing.

---

## Phase A — Track 0: Repo coherence

### Task 1: Merge origin/main into local main

**Files:**
- Modify: git state only (expected conflicts: `package.json`, `package-lock.json`)

**Interfaces:**
- Produces: a local `main` containing origin/main's manual-payments hard-removal + local kaizen/docs commits.

- [ ] **Step 1: Preconditions**

Run: `cd ~/automation/projects/warimcp && git status --short`
Expected: clean (docs commit dec48a1 already made). If dirty, stop and report.

- [ ] **Step 2: Merge**

```bash
git fetch origin
git merge origin/main --no-edit
```

If conflicts: they should be limited to `package.json` / `package-lock.json` (kaizen bumped deps on both sides). Resolve `package.json` by keeping, for each conflicting dependency line, the HIGHER semver of the two sides. Then regenerate the lockfile instead of hand-merging it:

```bash
git checkout --theirs package-lock.json 2>/dev/null || true
npm install
git add package.json package-lock.json
git commit --no-edit
```

Any conflict OUTSIDE those two files: stop and report the file list — do not improvise.

- [ ] **Step 3: Verify the hard-removal survived the merge**

```bash
test ! -d src/manual-payments && echo OK-removed
grep -rn "MANUAL_PAYMENT" src/ && echo "FAIL: config remnants" || echo OK-config
```

Expected: `OK-removed`, `OK-config`.

- [ ] **Step 4: Build + full test suite**

Run: `npm run build && npm test`
Expected: build exit 0; all tests pass, including `test/integration/no-manual-payment-routes.test.ts`.

- [ ] **Step 5: Push (normal push — merge means no force needed)**

```bash
git push origin main
```

### Task 2: Merge the i4 registry artifacts (no publish)

**Files:**
- Modify: git state (`feat/i4-mcp-registry` → `main`); then `README.md`

**Interfaces:**
- Produces: `server.json` at repo root; `mcpName` + `bin` in `package.json`. NOT published.

- [ ] **Step 1: Merge**

```bash
git merge feat/i4-mcp-registry --no-edit
```

Conflict risk: `README.md`, `package.json`, `docs/superpowers/plans/`. Resolve keeping BOTH sides' content (README sections are additive; for `package.json` keep the branch's `mcpName`/`bin` fields plus main's newer dep versions). Nothing here may trigger a publish.

- [ ] **Step 2: Record the license decision**

Add to `README.md`, directly under the license badge/mention:

```markdown
> **License policy (2026-08-05):** WariMCP core is and stays MIT. Commercial
> offerings (partner integrations, hosted services) are separate layers and do
> not change the license of this repository.
```

- [ ] **Step 3: Verify + commit + push**

Run: `npm run build && npm test && node -e "const p=require('./package.json'); if(!p.mcpName||!p.bin) process.exit(1)" && test -f server.json && echo OK`
Expected: OK.

```bash
git add README.md
git commit -m "docs: record MIT license policy on main"
git push origin main
```

---

## Phase B — Track 1: Hub2 adapter

Reference for all shapes: `~/automation/projects/lagoon-website/backend/lib/hub2.js` (READ-ONLY — never modify that repo). Vendor facts verified 2026-05-10..29 against api.hub2.io.

### Task 3: Hub2 config keys

**Files:**
- Modify: `src/config.ts` (Zod schema — follow the existing `HUB2_API_KEY` line's style)
- Modify: `.env.example`
- Test: `test/unit/providers/hub2-config.test.ts`

**Interfaces:**
- Produces: `getConfig().HUB2_MERCHANT_ID: string`, `getConfig().HUB2_BASE_URL: string` (default `"https://api.hub2.io"`), `getConfig().HUB2_WEBHOOK_SECRET: string`. (`HUB2_API_KEY` already exists.)

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/providers/hub2-config.test.ts
import { describe, it, expect } from "vitest";
import { getConfig } from "../../../src/config.js";

describe("hub2 config", () => {
  it("defaults HUB2_BASE_URL and empty merchant/webhook fields", () => {
    const c = getConfig();
    expect(c.HUB2_BASE_URL).toBe("https://api.hub2.io");
    expect(typeof c.HUB2_MERCHANT_ID).toBe("string");
    expect(typeof c.HUB2_WEBHOOK_SECRET).toBe("string");
  });
});
```

- [ ] **Step 2: Run** `npx vitest run test/unit/providers/hub2-config.test.ts` — Expected: FAIL (fields undefined).
- [ ] **Step 3: Implement** — add to the config Zod object, next to `HUB2_API_KEY`:

```ts
HUB2_MERCHANT_ID: z.string().default(""),
HUB2_BASE_URL: z.string().default("https://api.hub2.io"),
HUB2_WEBHOOK_SECRET: z.string().default(""),
```

Add the same three names to `.env.example` under the existing HUB2 line, values empty, with a comment `# Hub2: sandbox key via dashboard; Environment header follows WARIMCP_MODE`.

- [ ] **Step 4: Run test** — Expected: PASS.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(hub2): config keys for merchant, base url, webhook secret"`

### Task 4: Hub2 pure helpers — status map + MSISDN normalizer

**Files:**
- Modify: `src/providers/hub2.ts` (add exported helpers above the class)
- Test: `test/unit/providers/hub2-helpers.test.ts`

**Interfaces:**
- Produces: `normalizeHub2Status(s: string): "pending"|"processing"|"completed"|"failed"` (throws `Error` with message starting `Unknown Hub2 status` on unmapped input); `normalizeMsisdnForHub2(input: string): string`.

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/providers/hub2-helpers.test.ts
import { describe, it, expect } from "vitest";
import { normalizeHub2Status, normalizeMsisdnForHub2 } from "../../../src/providers/hub2.js";

describe("normalizeHub2Status", () => {
  it("maps Hub2 wire statuses to WariMCP vocabulary", () => {
    expect(normalizeHub2Status("payment_required")).toBe("pending");
    expect(normalizeHub2Status("processing")).toBe("processing");
    expect(normalizeHub2Status("succeeded")).toBe("completed");
    expect(normalizeHub2Status("successful")).toBe("completed");
    expect(normalizeHub2Status("failed")).toBe("failed");
    expect(normalizeHub2Status("expired")).toBe("failed");
  });
  it("throws on unknown wire status (never silently passes through)", () => {
    expect(() => normalizeHub2Status("mystery")).toThrow(/Unknown Hub2 status/);
  });
});

describe("normalizeMsisdnForHub2", () => {
  it("strips +225 E.164 to bare local", () => {
    expect(normalizeMsisdnForHub2("+2250777210927")).toBe("0777210927");
  });
  it("passes CIV local through", () => {
    expect(normalizeMsisdnForHub2("0777210927")).toBe("0777210927");
  });
  it("passes 8-digit sandbox magic through untouched", () => {
    expect(normalizeMsisdnForHub2("00000001")).toBe("00000001");
  });
});
```

- [ ] **Step 2: Run** — Expected: FAIL (not exported).
- [ ] **Step 3: Implement** in `src/providers/hub2.ts`:

```ts
const HUB2_STATUS_MAP: Record<string, "pending" | "processing" | "completed" | "failed"> = {
  payment_required: "pending",
  processing: "processing",
  succeeded: "completed",
  successful: "completed",
  failed: "failed",
  expired: "failed",
};

export function normalizeHub2Status(s: string): "pending" | "processing" | "completed" | "failed" {
  const mapped = HUB2_STATUS_MAP[s];
  if (mapped === undefined) {
    throw new Error(`Unknown Hub2 status: "${s}" — add to HUB2_STATUS_MAP if Hub2 introduced a new wire value`);
  }
  return mapped;
}

export function normalizeMsisdnForHub2(input: string): string {
  const trimmed = input.replace(/\s+/g, "");
  if (/^\+225\d{10}$/.test(trimmed)) return trimmed.slice(4);
  if (/^225\d{10}$/.test(trimmed)) return trimmed.slice(3);
  return trimmed.replace(/^\+/, "");
}
```

- [ ] **Step 4: Run test** — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "feat(hub2): status map + msisdn normalizer with trap tests"`

### Task 5: Hub2Provider.initiatePayment (intent → attempt)

**Files:**
- Modify: `src/providers/hub2.ts` (replace the stub class body; keep class name `Hub2Provider`)
- Test: `test/unit/providers/hub2-initiate.test.ts`

**Interfaces:**
- Consumes: `getConfig()` (Task 3 fields), helpers (Task 4), `withRetry` from `./retry.js`, `HttpError` from `../utils/http-error.js` (same imports as `fedapay.ts`).
- Produces: `Hub2Provider.initiatePayment(input: PaymentInitiateInput): Promise<PaymentInitiateResult>` where `providerReference` = Hub2 intent id, `paymentUrl` = Wave redirect URL or `""`. Provider selection: `input.metadata?.provider` (`"mtn" | "orange" | "moov" | "wave"`), default `"mtn"`. `customerReference` sent as `input.customerEmail || input.customerPhone` — MUST be non-empty (throw fast, empirical Hub2 400).

Wire shapes (verified from lagoon-website + vendor Postman):
- `POST {base}/payment-intents` body `{ amount, currency: "XOF", purchaseReference, customerReference }` → `{ id, token, status }`. Headers server-mode: `ApiKey`, `MerchantId`, `Environment` (`"sandbox" | "live"` from `WARIMCP_MODE === "live" ? "live" : "sandbox"`), `Content-Type: application/json`.
- `POST {base}/payment-intents/{id}/payments` headers token-mode: `Authorization: Bearer {token}`, `Environment` — ApiKey/MerchantId MUST NOT be sent in token mode. Body `{ token, paymentMethod: "mobile_money", country: "CI", provider, mobileMoney: { msisdn, [onSuccessRedirectionUrl, onFailedRedirectionUrl] } }`.
- Wave: both redirect URLs REQUIRED and must be https (use `input.returnUrl` for both — the return page polls status). `onFinishRedirectionUrl` is NOT a real field — never send it.
- Redirect URL in response: read `payments[0].nextAction.url` with top-level `nextAction.url` fallback.

- [ ] **Step 1: Write the failing test** (mock `global.fetch` with `vi.stubGlobal`; follow `test/unit/providers/mock.test.ts` conventions):

```ts
// test/unit/providers/hub2-initiate.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hub2Provider } from "../../../src/providers/hub2.js";

const baseInput = {
  amount: 1000, currency: "XOF", idempotencyKey: "idem-1",
  description: "test order", customerName: "Test", customerEmail: "t@example.com",
  customerPhone: "00000001", returnUrl: "https://example.com/return",
  notifyUrl: "https://example.com/notify", metadata: { provider: "mtn" },
};

function mockFetchSequence(responses: Array<{ status?: number; json: unknown }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let i = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses[Math.min(i++, responses.length - 1)];
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200 });
  }));
  return calls;
}

beforeEach(() => {
  process.env.HUB2_API_KEY = "sk_test";
  process.env.HUB2_MERCHANT_ID = "m_test";
});
afterEach(() => vi.unstubAllGlobals());

describe("Hub2Provider.initiatePayment", () => {
  it("creates intent then attempts payment; returns intent id as providerReference", async () => {
    const calls = mockFetchSequence([
      { json: { id: "pi_1", token: "tok_1", status: "payment_required" } },
      { json: { status: "processing", payments: [{ id: "pay_1", nextAction: null }] } },
    ]);
    const r = await new Hub2Provider().initiatePayment(baseInput);
    expect(r.providerReference).toBe("pi_1");
    expect(r.status).toBe("processing");
    const intentBody = JSON.parse(String(calls[0].init.body));
    expect(intentBody).toMatchObject({ amount: 1000, currency: "XOF", customerReference: "t@example.com" });
    const h0 = calls[0].init.headers as Record<string, string>;
    expect(h0.ApiKey).toBe("sk_test");
    expect(h0.MerchantId).toBe("m_test");
    expect(h0.Environment).toBe("sandbox");
    const h1 = calls[1].init.headers as Record<string, string>;
    expect(h1.Authorization).toBe("Bearer tok_1");
    expect(h1.ApiKey).toBeUndefined();          // token mode: no ApiKey/MerchantId
    const attemptBody = JSON.parse(String(calls[1].init.body));
    expect(attemptBody.mobileMoney.msisdn).toBe("00000001");
  });

  it("throws fast when customerReference would be empty", async () => {
    mockFetchSequence([{ json: {} }]);
    await expect(new Hub2Provider().initiatePayment({ ...baseInput, customerEmail: "", customerPhone: "" }))
      .rejects.toThrow(/customerReference/);
  });

  it("wave: sends https redirect URLs and returns redirect as paymentUrl", async () => {
    const calls = mockFetchSequence([
      { json: { id: "pi_2", token: "tok_2", status: "payment_required" } },
      { json: { status: "processing", payments: [{ id: "pay_2", nextAction: { type: "redirect", url: "https://wave.example/x" } }] } },
    ]);
    const r = await new Hub2Provider().initiatePayment({ ...baseInput, metadata: { provider: "wave" } });
    const attemptBody = JSON.parse(String(calls[1].init.body));
    expect(attemptBody.mobileMoney.onSuccessRedirectionUrl).toBe("https://example.com/return");
    expect(attemptBody.mobileMoney.onFailedRedirectionUrl).toBe("https://example.com/return");
    expect(attemptBody.mobileMoney.onFinishRedirectionUrl).toBeUndefined();
    expect(r.paymentUrl).toBe("https://wave.example/x");
  });

  it("wave: rejects non-https returnUrl before calling Hub2", async () => {
    const calls = mockFetchSequence([{ json: { id: "pi_3", token: "tok_3", status: "payment_required" } }]);
    await expect(new Hub2Provider().initiatePayment({
      ...baseInput, returnUrl: "http://insecure.example/r", metadata: { provider: "wave" },
    })).rejects.toThrow(/https/);
    expect(calls.length).toBeLessThan(2);      // attempt call never made
  });
});
```

- [ ] **Step 2: Run** — Expected: FAIL (stub throws "coming in Phase 2").
- [ ] **Step 3: Implement** — replace the stub methods. Structure mirrors `fedapay.ts` (private `baseUrl()`, `serverHeaders()`, `tokenHeaders(token)`, `withRetry` + `AbortSignal.timeout(30_000)` + `HttpError` on non-OK). `isConfigured()` = `!!(HUB2_API_KEY && HUB2_MERCHANT_ID)`; `info()` sets `configured: this.isConfigured()`. `initiatePayout`/`verifyPayout` throw `new Error("Hub2 payouts not supported in v1")`. Environment value: `getConfig().WARIMCP_MODE === "live" ? "live" : "sandbox"`.
- [ ] **Step 4: Run test file, then full suite** — Expected: all PASS (registry tests must still pass with the now-configurable Hub2 provider).
- [ ] **Step 5: Commit** `git commit -am "feat(hub2): real initiatePayment — intent+attempt with trap tests"`

### Task 6: Hub2Provider.verifyPayment

**Files:**
- Modify: `src/providers/hub2.ts`
- Test: `test/unit/providers/hub2-verify.test.ts`

**Interfaces:**
- Produces: `verifyPayment(providerReference: string): Promise<PaymentVerifyResult>` via `GET {base}/payment-intents/{id}` (server-mode headers). NOTE: this endpoint shape is the one thing not exercised by lagoon-website — Task 7's sandbox smoke confirms it; if the smoke shows a different read path, fix here and note it in the smoke log.

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/providers/hub2-verify.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hub2Provider } from "../../../src/providers/hub2.js";

beforeEach(() => {
  process.env.HUB2_API_KEY = "sk_test";
  process.env.HUB2_MERCHANT_ID = "m_test";
});
afterEach(() => vi.unstubAllGlobals());

it("maps succeeded intent to completed with amount/currency", async () => {
  vi.stubGlobal("fetch", vi.fn(async () =>
    new Response(JSON.stringify({ id: "pi_1", status: "succeeded", amount: 1000, currency: "XOF" }), { status: 200 })));
  const r = await new Hub2Provider().verifyPayment("pi_1");
  expect(r.status).toBe("completed");
  expect(r.amount).toBe(1000);
  expect(r.currency).toBe("XOF");
  expect(r.paymentMethod).toBe("HUB2");
});
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** (GET + `normalizeHub2Status`; `refunded` is unreachable from the map — contract's `"refunded"` arm stays unused for Hub2 v1). **Step 4: Run** — PASS. **Step 5: Commit** `git commit -am "feat(hub2): verifyPayment"`

### Task 7: Hub2 webhook verifier + sandbox smoke

**Files:**
- Create: `src/webhooks/verify-hub2.ts`
- Modify: `src/webhooks/handler.ts` (mirror the existing `verify-wave.ts` wiring — read both files first and follow the established dispatch pattern exactly)
- Create: `scripts/smoke-hub2-sandbox.ts`
- Test: `test/unit/providers/hub2-webhook.test.ts`

**Interfaces:**
- Produces: `verifyHub2Webhook(rawBody: string, signatureHeader: string | undefined, opts: { secret: string, expectedMode: "sandbox" | "live", nowMs: number }): { ok: boolean, reason?: string }`. HMAC-SHA256 over `"{t}.{rawBody}"` with timing-safe compare; tolerated skew ±300s; **mode check reads `event.mode === opts.expectedMode` and MUST NOT read `event.test`** (F1 regression: Hub2 sandbox sends `test:false`).

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** `verify-hub2.ts` (parse `t=...,v1=...` header; `timingSafeEqual` on hex buffers of equal length; skew check; JSON-parse body defensively; mode check last so reasons are specific). Wire into `handler.ts` following the wave/cinetpay dispatch pattern, using `getConfig().HUB2_WEBHOOK_SECRET` and expectedMode from `WARIMCP_MODE`.
- [ ] **Step 4: Run full suite** — PASS. **Step 5: Commit** `git commit -am "feat(hub2): webhook signature+mode verification (event.mode, never event.test)"`
- [ ] **Step 6: Sandbox smoke (manual, requires HUB2 sandbox key + merchant id in `.env`)** — write `scripts/smoke-hub2-sandbox.ts`: create intent (magic msisdn `00000001`, amount 100 XOF) → attempt (provider `mtn`) → poll `verifyPayment` up to 60s → print each raw response. Run with `npx tsx scripts/smoke-hub2-sandbox.ts`, save output to `docs/research/2026-08-XX-hub2-sandbox-smoke.md`, commit. If the GET endpoint 404s, fix Task 6's path per the observed API and record the correction. A real CIV msisdn will be rejected (`invalid_sandbox_msisdn`) — that rejection is itself a useful negative check to record.

---

## Phase C — Track 2: Agentic bridge spike (TIMEBOX ~1 week)

### Task 8: I5 wallet-discipline schema fields

**Files:**
- Modify: `src/tools/definitions.ts` (Zod schemas for `initiate_payment`, `generate_payment_link`, `initiate_payout`)
- Modify: `src/server/mcp.ts` (mirror the same field additions in `server.tool(...)` registrations)
- Test: `test/unit/tools/wallet-discipline.test.ts`

**Interfaces:**
- Produces (exact I5 spec fields): optional `fundsSource: z.enum(["fiat","usdc"]).default("fiat")`, optional `agentWalletSignature: z.string()`, optional `walletProvider: z.string()`; `.superRefine` rejecting usdc without both extra fields. Fiat callers unaffected.

- [ ] **Step 1: Write the failing test**

```ts
// test/unit/tools/wallet-discipline.test.ts
import { describe, it, expect } from "vitest";
import { initiatePaymentSchema } from "../../../src/tools/definitions.js";

describe("I5 wallet discipline on initiate_payment", () => {
  const fiatInput = { provider: "mock", amount: 1000, currency: "XOF", description: "d",
    customerName: "n", customerEmail: "e@x.com", customerPhone: "00000001" };
  it("fiat callers unaffected (fundsSource defaults to fiat)", () => {
    const parsed = initiatePaymentSchema.parse(fiatInput);
    expect(parsed.fundsSource).toBe("fiat");
  });
  it("usdc without agentWalletSignature is rejected", () => {
    expect(() => initiatePaymentSchema.parse({ ...fiatInput, fundsSource: "usdc", walletProvider: "phantom" }))
      .toThrow(/agentWalletSignature is required when fundsSource is usdc/);
  });
  it("usdc without walletProvider is rejected", () => {
    expect(() => initiatePaymentSchema.parse({ ...fiatInput, fundsSource: "usdc", agentWalletSignature: "sig" }))
      .toThrow(/walletProvider is required when fundsSource is usdc/);
  });
});
```

NOTE: if `definitions.ts` exports schemas under different names, adapt the import to the actual export (read the file first); the assertion content is fixed.

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** per I5 spec §2–3 (`.superRefine` with those exact error messages) on the three fund-moving schemas; mirror in `mcp.ts`. **Step 4: Run full suite** — PASS. **Step 5: Commit** `git commit -am "feat(i5): wallet-discipline schema fields + conditional validation"`

### Task 9: Agent authorization module (mandate verification)

**Files:**
- Create: `src/bridge/authorization.ts`
- Test: `test/unit/bridge/authorization.test.ts`

**Interfaces:**
- Produces:

```ts
export interface PaymentMandate {
  amount: number; currency: string; merchantRef: string;
  expiresAtMs: number; nonce: string;
}
export function verifyMandate(
  mandate: PaymentMandate,
  signatureB64: string,
  publicKeyPem: string,
  opts: { nowMs: number; seenNonces: Set<string> },
): { ok: true } | { ok: false; reason: "bad_signature" | "expired" | "replayed" }
export function canonicalMandateBytes(m: PaymentMandate): Buffer  // stable key-order JSON
```

Ed25519 via `node:crypto` (`verify(null, bytes, keyObject, sig)`). AP2-mandate-style: the agent's key signs the canonical mandate; WariMCP verifies and never holds keys or funds (no-custody preserved — TIMEBOX CHECKPOINT: if implementing this forces anything custody-shaped, stop and report).

- [ ] **Step 1: Write the failing test**

```ts
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
});
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** (canonical bytes = JSON of `[amount, currency, merchantRef, expiresAtMs, nonce]` array — array form makes key order structurally stable; check expiry first, then nonce, then signature? NO — check signature FIRST so an attacker cannot probe expiry/replay state with unsigned input, then expiry, then replay; on success caller adds nonce to the set). **Step 4: Run** — PASS. **Step 5: Commit** `git commit -am "feat(bridge): ed25519 mandate verification (sig-first, expiry, replay)"`

### Task 10: MCP tool `authorize_and_pay`

**Files:**
- Create: `src/tools/authorize-and-pay.ts`
- Modify: `src/tools/definitions.ts` (schema), `src/server/mcp.ts` (registration)
- Test: `test/unit/tools/authorize-and-pay.test.ts`

**Interfaces:**
- Consumes: `verifyMandate` (Task 9); provider registry's existing lookup (same call the `initiate_payment` tool handler uses — read `src/tools/initiate-payment.ts` and mirror its provider resolution + result formatting exactly).
- Produces: MCP tool `authorize_and_pay` — input `{ mandate: PaymentMandate, signature: string, agentPublicKeyPem: string, provider: string, customerPhone: string, customerEmail?: string, returnUrl: string, notifyUrl: string }`; behavior: verify mandate → on failure return the reason WITHOUT calling any provider → on success call `initiatePayment` with `idempotencyKey = mandate.nonce` (mandate nonce doubles as idempotency key — replay-safe by construction) and `metadata: { provider, mandateMerchantRef: mandate.merchantRef }`.

- [ ] **Step 1: Write the failing test** — mock the provider (use the existing `mock` provider, following `initiate-payment` tool tests if present, else invoke the handler directly):

```ts
// test/unit/tools/authorize-and-pay.test.ts
import { describe, it, expect } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { canonicalMandateBytes } from "../../../src/bridge/authorization.js";
import { handleAuthorizeAndPay } from "../../../src/tools/authorize-and-pay.js";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
const mandate = { amount: 500, currency: "XOF", merchantRef: "pilot-1", expiresAtMs: Date.now() + 60_000, nonce: "once-1" };
const signature = sign(null, canonicalMandateBytes(mandate), privateKey).toString("base64");

it("verifies then pays via the mock provider", async () => {
  const r = await handleAuthorizeAndPay({
    mandate, signature, agentPublicKeyPem: pem, provider: "mock",
    customerPhone: "00000001", returnUrl: "https://x/r", notifyUrl: "https://x/n",
  });
  expect(r.authorized).toBe(true);
  expect(r.payment?.providerReference).toBeTruthy();
});

it("refuses to touch any provider on bad signature", async () => {
  const r = await handleAuthorizeAndPay({
    mandate: { ...mandate, amount: 9_999_999 }, signature, agentPublicKeyPem: pem, provider: "mock",
    customerPhone: "00000001", returnUrl: "https://x/r", notifyUrl: "https://x/n",
  });
  expect(r.authorized).toBe(false);
  expect(r.reason).toBe("bad_signature");
  expect(r.payment).toBeUndefined();
});
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** handler + schema + registration (module-level `const seenNonces = new Set<string>()` is sufficient for the spike; note in a comment that production moves this to the DB). **Step 4: Run full suite** — PASS. **Step 5: Commit** `git commit -am "feat(bridge): authorize_and_pay MCP tool"`

### Task 11: Demo — merchant scenario, recorded

**Files:**
- Create: `scripts/demo-agent-payment.ts` (drives the scenario end-to-end)
- Create: `docs/demo/2026-08-XX-agent-payment-demo.md` (transcript + narrative)

- [ ] **Step 1: Script the scenario** — `demo-agent-payment.ts` prints a narrated WhatsApp-style conversation (simulated transport — Meta verification pending) for the Track-4 merchant story: customer orders 2 items → agent computes total → agent constructs + signs mandate (keypair generated in-script) → calls `authorize_and_pay` against **Hub2 sandbox** (fallback: FedaPay sandbox if Hub2 sandbox credentials are still pending; fallback: `mock` provider, clearly labeled) → polls `verify_payment` → prints the confirmation + a reconciliation line (`list_transactions` output for the merchant ref).
- [ ] **Step 2: Run against sandbox** — `npx tsx scripts/demo-agent-payment.ts | tee /tmp/demo-run.txt`. Expected: authorized=true, payment reaches `processing`/`completed` on sandbox, reconciliation row printed.
- [ ] **Step 3: Record** — `script -q -c "npx tsx scripts/demo-agent-payment.ts" docs/demo/demo-terminal.txt` (or asciinema if installed); write the narrative doc around the transcript.
- [ ] **Step 4: Commit** `git add scripts/demo-agent-payment.ts docs/demo/ && git commit -m "feat(demo): recorded agent-payment demo — merchant scenario"`
- [ ] **Step 5: Report to owner** — demo recording is the Track-2 acceptance artifact; Tracks 3–4 outreach/launch remain gated (board review; RCCM/Meta/Hub2-terms/ARTCI chain per spec).

### Task 12: Track 4 pre-gate product spec (docs only)

**Files:**
- Create: `docs/superpowers/specs/2026-08-XX-track4-whatsapp-merchant-product.md`

- [ ] **Step 1: Write the product spec** covering, with concrete content (not headings alone): the merchant WhatsApp flow (order intake → `authorize_and_pay` → confirmation → daily reconciliation summary message); onboarding via Hub2 KYB link (marked "terms pending Laurraine confirmation"); pricing draft (commission + SaaS fee, anchored to Chariow 15%/sale and 15–80k FCFA/mo agency range from the research appendix); pilot plan (2–3 Abidjan merchants, sandbox-first, live only after the spec's gate chain); Meta-rules compliance note (scoped business bot); explicit non-goals v1 (no personal-account collection, no fully-informal segment, no USSD).
- [ ] **Step 2: Commit** `git add docs/superpowers/specs/ && git commit -m "docs(track4): pre-gate product spec"`

---

## Not in this plan (gated, from the design spec)

Track 3 partner outreach (board review + owner sends), publish chain (post-demo + board review), Track 4 build (RCCM → Meta → Hub2 terms → ARTCI → pre-deploy matrix entry → board review), live cutover of any provider.
