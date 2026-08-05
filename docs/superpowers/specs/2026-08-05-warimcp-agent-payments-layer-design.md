# WariMCP — Agent-Payments Layer for WAEMU: Design

**Date:** 2026-08-05 · **Status:** awaiting owner review
**Provenance:** wide-net reevaluation session 2026-08-05. Evidence base:
`docs/research/2026-08-05-reevaluation-research.md` (6 research reports,
5 adversarial fact-checks). Supersedes the direction question left open by
`docs/superpowers/plans/2026-06-12-warimcp-unpark.md` (whose Tasks 1–3
remain done/valid).

## Thesis

WariMCP stops being "an aggregator with 10 adapters" and becomes **the
agent-payments layer for WAEMU**: a working engine proven on Hub2 +
FedaPay (Track 1), an agentic interface implementing the emerging global
standards over local rails (Track 2), sold two ways — B2B into
social-commerce platforms that have merchants but no payment depth
(Track 3), and directly to small merchants as an in-WhatsApp payment +
reconciliation product (Track 4).

Verified basis (see research appendix): no funded player builds
agent-native payment rails for WAEMU; BCEAO PI-SPI is live with no AI
layer; 75% of CIV online transactions run through social sellers
(Trade.gov); the merchant pain is screenshot-verification checkout and
~2h/day manual reconciliation; Meta commoditized the chat layer (native
AI agents, June 2026) — the payment layer is the open slot.

## Decisions ratified by owner (2026-08-05)

- Scope = Tracks 0–4 below, in order. Track 4 confirmed as a full track.
- **License: `main` stays MIT.** The `x402-billing` FSL relicense branch
  stays unmerged. Monetization = partner deals, Hub2 referral commission,
  SaaS fees — none undermined by MIT core. Revisit only if hosted billing
  is productized later.
- **Publish (old I4 outward steps) deferred** until the Track 2 demo
  exists, so the published story is the new positioning. Then board
  review → npm + MCP registry + dev.to.
- Parked: simulator-as-product (#2; internal test mocks only), Odoo
  connector (#3), standards seat (#7 — owner may do ad hoc), licensing
  outreach (#8), Moi by DNC wiring (#9), x402 productization (#10).
- Killed (do not relitigate without new evidence): humanitarian CVA,
  standalone payout aggregation, chatbot-SaaS form of the WhatsApp play,
  USSD substrate (DÔGÔ's decision, not WariMCP's).

## Track 0 — Repo coherence (prerequisite, ~1 session)

Local `main` diverged from `origin/main` (kaizen committed dep updates to
a stale main that predates PR #1's manual-payments hard-removal).

1. Merge `origin/main` INTO local `main` (merge, never rebase/force-push
   — DEV rules); resolve the kaizen-vs-kaizen package-lock conflicts;
   result must contain the hard-removal (verify `src/manual-payments/`
   absent, `no-manual-payment-routes` regression test green).
2. Merge `feat/i4-mcp-registry` (registry artifacts kept, publish steps
   NOT run).
3. Leave `x402-billing-local` and its worktree untouched.
4. Record the license decision in `README.md` (one line) and this spec.

**Acceptance:** one clean `main`; `npm run build` exit 0; full test suite
green; branch state documented.

## Track 1 — Hub2 adapter, ported not invented (~1–2 sessions)

Port proven shapes from `~/automation/projects/lagoon-website/backend/lib/hub2.js`
(read-only source) into `src/providers/hub2.ts` per the `base.ts`
provider contract, replacing the "coming in Phase 2" throw.

Empirical traps become regression tests (from Hub2 vendor-shape memory,
board `1111316df0`):
- `POST /payment-intents` requires non-empty `customerReference`.
- Webhook env check discriminates on `event.mode`, never `event.test`
  (sandbox sends `test: false`).
- Sandbox MSISDNs are bare 8 digits (`00000001`); real CIV numbers are
  rejected with `invalid_sandbox_msisdn`.
- Wave attempts carry `mobileMoney.workflow: "redirection"`; redirect URL
  read from `nextAction.url`; `onSuccessRedirectionUrl` +
  `onFailedRedirectionUrl` required; `onFinishRedirectionUrl` is not a
  real field. Sandbox never issues a Wave redirect URL — Wave-redirect
  path is live-only, out of scope for this track's verification.
- Webhook registration is API-only; Hub2 returns the secret at
  registration.

**Verification (two layers, because mock-only tests hid real shapes
before):** (a) contract tests against an internal Hub2 mock in CI —
test infrastructure, not the parked simulator product; (b) one real
Hub2 **sandbox** smoke: intent → webhook capture → status roundtrip,
recorded.

**Acceptance:** green suite + recorded sandbox roundtrip. No live keys
in any test path.

## Track 2 — Agentic bridge spike (timeboxed ~1 week)

The thinnest honest "agent layer PI-SPI lacks": an MCP flow where an
agent presents a signed payment authorization and WariMCP verifies it,
then executes over Hub2/FedaPay **sandbox** rails.

- Authorization model: AP2-mandate-style verification, x402
  compatibility noted in design comments. Implements the I5
  wallet-discipline spec
  (`docs/superpowers/specs/2026-06-12-warimcp-wallet-discipline.md`):
  `fundsSource`, `agentWalletSignature`, `walletProvider`, pooled-wallet
  rejection.
- **Timebox rule:** if AP2's spec fights the no-custody posture by day 3,
  stop and reassess — do not force it.
- Demo vertical = Track 4's merchant scenario: a scoped WhatsApp business
  conversation (orders flow) where the customer authorizes and pays
  in-chat via licensed rails, webhook-confirmed, appearing in a minimal
  reconciliation view. (Until Meta verification lands, the demo may run
  against a simulated WhatsApp transport — the payment leg is real
  sandbox.)

**Acceptance:** recorded end-to-end demo — conversation → authorization
→ sandbox payment → webhook confirmation → reconciliation row. This
recording is the reusable asset for Tracks 3 and 4.

## Track 3 — Partner motion (gated on Track 2 demo)

Sell the layer B2B: "in-chat payment orchestration for your merchants —
one integration, Wave/OM/MTN/Hub2 underneath."

- Target order: **Yelen** (Abidjan, pre-seed, documented payment gap) →
  **LAfricaMobile** (Dakar BSP, €4.3M) → **UPWAW**.
- Artifacts: one-page offer (French, house voice rules, file-first) +
  Track 2 demo video. Prepared under the LTS NDA/IP framework
  (clause pénale, CCJA arbitration) — NDA before technical detail.
- Exposure discipline (owner's in-house-build fear): show outcomes
  (demo), hold internals (adapter code, quirk inventory, regulatory
  dossier).
- **Hard gates:** `/lts-board-review` before ANY outreach; owner sends
  all messages personally.

## Track 4 — Direct product: WhatsApp payments + reconciliation for small merchants

**Shape:** a scoped WhatsApp business bot (orders/support — compliant
with Meta's Jan 2026 rules) that lets a merchant take an order and
collect payment in-chat via **Hub2**, with per-merchant reconciliation
(the verified pain: screenshot checkout, ~2h/day manual books, fake
screenshots).

**Onboarding & money flow (no-custody invariant):** each merchant
onboards via **Hub2's KYB link as their own merchant of record**;
settlement Hub2 → merchant. LTS never holds funds.
⚠️ VERIFY with Laurraine before pricing: exact KYB-referral mechanics,
commission rate, and whether per-merchant sub-accounts fit LTS's current
single-merchant Hub2 agreement (the memory notes per-client merchant
infra was explicitly a "future track" — this is that track).

**Revenue:** Hub2 referral commission + monthly SaaS fee. Market
anchors: Chariow charges 15%/sale; Abidjan agencies charge 15–80k
FCFA/month; integration burden merchants avoid = 400–900k FCFA + weeks
of KYC per operator.

**Regulatory invariants (non-negotiable):**
- NO personal-account collection, ever — that is the feature hard-removed
  2026-06-12 under BCEAO Instruction 001-01-2024. Licensed rails only.
- Addressable segment v1 = merchants who can pass Hub2 KYB (semi-formal).
  The fully-informal mass (MicroSave: 95% lack formal acceptance) is
  explicitly out of scope for v1.
- **ARTCI prior declaration (Loi 2024-352) required before charging
  customers commercially** — files as soon as RCCM lands (existing I8).

**Gate chain (external clocks):** RCCM (signing done 2026-08-04, emission
pending) → Meta business verification (current WhatsApp Agent blocker;
BSP route is the fallback) → Hub2 KYB terms confirmed → ARTCI declaration
→ `/lts-pre-deploy` matrix entry added BEFORE first production deploy →
`/lts-board-review` before launch/pricing.

**Pre-gate work (can start now):** product spec, WhatsApp flow design,
commission/pricing model draft, pilot recruitment shortlist (2–3 Abidjan
merchants), reconciliation data model.

**Pilot:** 2–3 real Abidjan merchants, sandbox first; live cutover only
through the deploy gates. Pilot doubles as the primary demand validation
the research demanded (quoted stats in this space are citation-laundered).

## Cross-track engineering posture

- TDD: failing contract test first for every provider trap.
- All provider calls idempotent (UUIDv4 keys); webhook handlers
  signature-verified + deduplicated (MoMo duplicate-webhook reality).
- Sandbox keys only in code paths run by tests/demos; the live FedaPay
  keys in `.env` remain untouched absent a deliberate cutover decision.
- Node/TS, Express 5, Zod, Drizzle, Vitest, MCP SDK (existing stack).

## Risks (stated plainly)

| Risk | Level | Mitigation |
|---|---|---|
| Agent-payments demand in WAEMU is early (Kronos $0 local) | MED | Track 2 timeboxed; Tracks 1/4 have standalone value regardless |
| Hub2 ships its own MCP server (Stripe precedent) | MED | Move Tracks 1–2 promptly; partnership posture, not race |
| Partner conversations seed in-house builds | MED | Demo-first, NDA-first, show-outcomes-hold-internals |
| Meta verification stays blocked | MED | BSP fallback (HelloDuty-class); demo runs on simulated transport meanwhile |
| Hub2 KYB/commission terms differ from assumption | MED | Verify with Laurraine before any pricing or pilot promise |
| Solo bandwidth vs 13/09 label deadline + incorporation chain | HIGH | Strict track order; every boundary is a safe pause point; Track 3 outreach is opportunistic, not scheduled |
| Track 3 vs Track 4 channel conflict (selling to platforms while selling direct) | LOW-MED | Different segments v1; board review sequences go-to-market |

## Open questions (carried into planning)

1. Hub2 KYB-referral mechanics + commission rate (Laurraine).
2. Meta verification timeline post-RCCM; BSP choice if delayed.
3. Pilot merchant recruitment channel (owner's network vs. cold).
4. Product name for Track 4 (not needed before pilot).
