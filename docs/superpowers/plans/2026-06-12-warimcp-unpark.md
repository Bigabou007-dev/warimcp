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
- I4 distribution → **npm publish** (needs a `bin` entry + `npm publish`).
- Provider strategy → **Hub2 is the strategic future provider** (partnership in
  progress); Hub2 adapter's "coming in Phase 2" is honest — do not remove it.

---

## Task 1 — Feature-flag manual-collection OFF ✅ DONE (branch `worktree-warimcp-unpark`)

**Security hard-stop — explicitly approved 2026-06-12.**

**Files changed:**
- `src/config.ts` — added `MANUAL_PAYMENT_COLLECTION_ENABLED` (string→bool, default
  `false`, only literal `"true"` enables; deliberately not `z.coerce.boolean()`).
- `src/server/http.ts` — `import { getConfig }`; wrapped the `/api/sms-webhook` +
  `/pay` mounts and the cleanup `setInterval` (now `.unref()`) in
  `if (getConfig().MANUAL_PAYMENT_COLLECTION_ENABLED) { ... }`.
- `.env.example` — documented `MANUAL_PAYMENT_COLLECTION_ENABLED=false` with the
  BCEAO warning.
- `test/integration/manual-payment-flag-off.test.ts` — proves fail-closed (404, no
  router HTML) by default.
- `test/integration/manual-payment-flag-on.test.ts` — proves mount works when
  `=true` (router HTML 404 + 422 on bad payload).

**Verification:** `npm run build` exit 0; `npm run test` 28/28 pass.

**Remaining for Task 1:** code review + board review + deploy gate
(`/lts-pre-deploy warimcp` — note: warimcp is not yet a registered pre-deploy key)
BEFORE any production deploy. Deploy must NOT set the flag in the live `.env`.

---

## Task 2 — I4: MCP registry listing (NOT STARTED — gated on Task 1 deployed)

**Hard dependency:** Task 1 merged + deployed first (don't publicise a build whose
default still mounts collection routes — though after Task 1, default is OFF).

- [ ] a. Verify the *live* publish process — `registry.modelcontextprotocol.io`
  docs + `mcp-publisher` CLI + current `server.json` schema (don't trust memory).
- [ ] b. Confirm prerequisites: GitHub repo `Bigabou007-dev/warimcp` is **public**;
  namespace ownership proof (GitHub OAuth); `LICENSE` file present.
- [ ] c. Add `bin` entry to `package.json` + a stdio entrypoint, then `npm publish`
  (distribution decision = npm).
- [ ] d. Serve `GET /.well-known/mcp/server.json` (no-auth, next to `/health`).
- [ ] e. Author `server.json` (name `io.github.Bigabou007-dev/warimcp`, `packages`
  pointing at the npm package). Validate fields against (a).
- [ ] f. Register: official MCP Registry (`mcp-publisher`) + GitHub MCP Registry.
- [ ] g. Write-up: dev.to post + README install snippet/badge.
- [ ] h. Honesty pass on `list_providers` so the public listing shows FedaPay as
  live and others as not-yet-configured — keep Hub2 prominent (future provider).

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
