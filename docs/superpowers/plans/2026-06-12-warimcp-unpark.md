# WariMCP Un-Park Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.
> Task 1 is COMPLETE on branch `worktree-warimcp-unpark` (see status below).

**Goal:** Remove WariMCP's single regulatory exposure (manual-payment-collection),
then make it useful as the internal payment layer for LTS products.

**Architecture:** Wari orchestrates *above* a BCEAO-licensed PSP (FedaPay) — a
no-custody posture that needs no license. The only feature that broke this
(personal-account collection) is feature-flagged OFF by default.

**Tech Stack:** Node/TypeScript, Express 5, Zod, Drizzle, Vitest, MCP SDK.

**Source:** `ROADMAP.md` (2026-05-19, AutoResearch). No board-review decision
dossier → plan-coverage validator N/A.

**Reframe verdict:** The "needs a lot of regulatory stuff" framing was wrong for
internal use. BCEAO Instruction 001-01-2024 regulates *holding* third-party funds;
software instructing licensed PSPs does not. `src/manual-payments/` was the only
code path putting customer funds into an LTS personal account. Flag it OFF →
regulatory exposure removed for internal use. Commercial scale remains gated on
the I2 avocat opinion (DEFERRED, financial hard-stop).

**Decisions captured 2026-06-12:**
- **Posture → BYOK self-host, "as legally safe as possible."** WariMCP is pure
  software that instructs licensed PSPs; holds no funds, ships no credentials.
  Each operator runs their own instance with their own keys = their own merchant
  of record. **Do NOT run one shared hosted instance for third parties' money** —
  current code is single-key-per-deployment (not per-API-call); a shared instance
  = LTS becomes merchant-of-record for others' funds = custody/commercial-license
  trap (I2 territory).
- I4 distribution → **npm publish** as a self-host BYOK tool (needs a `bin` entry
  + `npm publish`); ships zero credentials.
- Provider strategy → internally LTS will use **Hub2 in the future** (partnership
  in progress); Hub2 adapter's "coming in Phase 2" is honest — do not remove it.
  Until the Hub2 adapter exists, LTS's own internal instance bridges on **FedaPay**
  (the only working adapter).

---

## Task 1 — HARD-REMOVE manual-collection ✅ DONE (supersedes the flag-off)

**Security hard-stop — approved 2026-06-12.** Originally flag-gated; on
2026-06-12 the owner chose full **hard-removal** instead — consistent with the
board's day-old Marché L1 custody ruling (whis: "DO-NOT-PROCEED if the adapter
ships behind a flippable flag" / "only if custody adapter hard-removed") and the
BYOK no-custody posture (a personal-account custody feature is dead code under
BYOK).

**Removed:**
- `src/manual-payments/` — entire directory deleted (sms-webhook, payment-page,
  reference-generator, index).
- `src/server/http.ts` — all manual-payment imports + the route mounts removed;
  replaced with a "do not reintroduce" comment.
- `src/config.ts` — all `MANUAL_PAYMENT_*` vars removed.
- `src/server/middleware/rate-limit.ts` — dead `smsRateLimitMiddleware` removed.
- `.env.example` + `README.md` — manual-payment sections removed; README gains a
  "No Custody (Bring Your Own Keys)" section + operator-responsibility statement.
- `test/integration/no-manual-payment-routes.test.ts` — regression test asserting
  `/pay/:ref` and `/api/sms-webhook` return 404 (guards against reintroduction).

**Verification:** `npm run build` exit 0; `npm run test` green.

**Remaining for Task 1:** board review + deploy gate (`/lts-pre-deploy warimcp` —
not yet a registered key) BEFORE any production deploy. (Merged to `main` +
repo made public 2026-06-12.)

---

## Task 2 — I4: MCP registry listing (ARTIFACTS BUILT — publish gated — BYOK self-host tool)

**Framing:** publish as a self-host BYOK tool — the npm package ships zero
credentials; each operator supplies their own PSP keys. The registry entry points
at the npm package, not an LTS-hosted instance.

**Hard dependency:** Task 1 merged first (so the published package is safe by
default) + repo made **public** (currently private — separate explicit decision).

- [x] a. Verified the *live* publish process (June 2026): schema `2025-12-11`;
  flow = `npm publish` → `mcp-publisher init` → `mcp-publisher login github` →
  `mcp-publisher publish`. npm-package fields are camelCase (`registryType`,
  `identifier`, `transport`). Ownership = `mcpName` in `package.json` must equal
  `server.json` `name`.
- [x] b. Prerequisites confirmed: repo **public**, MIT (`license` in package.json).
- [x] c. `bin` entry added (`warimcp` → `dist/index.js`) + `#!/usr/bin/env node`
  shebang on `src/index.ts` (tsc preserves it). **`npm publish` still PENDING** (gated).
- [x] d. ~~`/.well-known/mcp/server.json`~~ — **N/A** (corrected): current spec is
  `server-card.json` (draft SEP) for *remote* HTTP servers; not needed for a stdio
  npm server.
- [x] e. `server.json` authored at repo root (`io.github.bigabou007-dev/warimcp`,
  npm package, stdio transport, honest env vars). ⚠️ confirm exact username casing
  via `mcp-publisher init` at publish time.
- [ ] f. **PENDING (gated/outward):** `npm publish` then register via `mcp-publisher`
  to the official registry. GitHub's curated catalog syncs downstream (no separate
  self-serve submission).
- [x] g. dev.to write-up drafted (`docs/blog/2026-06-12-warimcp-devto-draft.md`) +
  README npx install snippet. (Publishing the post is gated — brand-facing.)
- [ ] h. Honesty pass on `list_providers` — deferred (Hub2 future provider stays
  prominent; not blocking the listing).
- [x] i. **Operator-responsibility disclaimer** added — README "No Custody (Bring
  Your Own Keys)" section.

**Remaining (all gated/outward — need owner + board review per rule 1.10):**
`npm publish --access public` → `mcp-publisher login github` → `mcp-publisher
publish`; publish the dev.to post. Confirm npm name `warimcp` is available (or scope
it) at publish time.

---

## Task 3 — I5: wallet-discipline design doc ✅ DONE (design only)

Written to `docs/superpowers/specs/2026-06-12-warimcp-wallet-discipline.md`.
Backward-compatible schema fields (`fundsSource`, `agentWalletSignature`,
`walletProvider`) + pooled-wallet rejection, specified but NOT implemented.
Implementation triggers only on I1 (USDC ingest) revival.

---

## Note (not built this round) — first real consumer wiring

Moi by DNC (live, `[DELIVERED]`) is the realistic first consumer to route spa
payments through `warimcp → FedaPay`, generating the first genuine `transactions`
rows. **Blocked on reconciling the FedaPay key-status discrepancy:** `RECOVERY.md`
says "awaiting FedaPay sandbox keys"; `ROADMAP.md`/MEMORY say FedaPay is live. Must
confirm working live keys before this. (Marché is `[DORMANT]`.)

---

## Explicitly deferred (not re-litigated)

I1 (USDC ingest), I3 (partnership outreach), I7 (Onafriq), I8 (ARTCI), I9 (Loi
2023-901), I10 (pricing) — DEFERRED per ROADMAP + user instruction. I2 (~1.5k EUR
avocat) — gated on commercial scale, financial hard-stop. I6 (Pretium watch) is
PROCEED-monitoring in the ROADMAP (monthly), not part of this build list.
