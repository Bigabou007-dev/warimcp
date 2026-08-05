# Track 4 — WhatsApp Payments + Reconciliation for Small Merchants
## Pre-gate product spec

**Date:** 2026-08-05 · **Status:** pre-gate draft, awaiting gate chain
**Grounded in:** design spec (Track 4 section), research appendix (2026-08-05),
demo artifact (2026-08-05). This spec elaborates; it does NOT override the design spec.

---

## 1. Problem statement

75% of online transactions in Côte d'Ivoire occur through social-media sellers
(WhatsApp / IG / FB), not e-commerce sites (U.S. Trade.gov Country Commercial Guide).
The dominant checkout today is "send to my Wave number and screenshot me."
This exposes merchants to fake screenshots and produces ~2h/day of manual
reconciliation (both HIGH-confidence, cross-confirmed — research appendix §Merchant pain).
No platform or PSP owns an integrated WhatsApp + XOF mobile-money flow in French:
global BSPs (HelloDuty, WATI) are USD-priced, English-first, no Wave/OM rails;
PayDunya / FedaPay / CinetPay offer shareable links, not in-chat checkout
(research appendix §WhatsApp chatbot/BSP landscape).

---

## 2. Product shape (v1)

A scoped WhatsApp business bot — compliant with Meta's Jan 2026 rule restricting
bots to orders, support, and bookings — that lets a merchant:

1. Take orders in-chat (order intake via conversation).
2. Collect payment in-chat via Hub2 (licensed rail; no personal-account collection,
   ever — BCEAO Instruction 001-01-2024 hard removal is in the codebase as of 2026-06-12).
3. Receive a webhook-confirmed payment receipt without leaving WhatsApp.
4. Get a daily reconciliation summary message (settled transactions, total, provider
   reference per line — replaces the 2h manual tally).

The payment leg uses the `authorize_and_pay` bridge proven in Track 2:
`order intake → authorize_and_pay → webhook confirmation → reconciliation row`.
The chat transport is a WhatsApp Business API connection (Meta verification required;
BSP fallback if verification is delayed — see gate chain §7).

---

## 3. Merchant flow (step by step)

```
Customer → Bot:  "Je veux 2 boubous taille L et 1 ceinture"
Bot → Customer:  "Récapitulatif: 2× Boubou L (8 000 XOF) + 1× Ceinture (2 000 XOF)
                  = 20 000 XOF. Confirmer? (Oui/Non)"
Customer:        "Oui"
Bot:             Calls authorize_and_pay (provider=hub2, amount=20000, currency=XOF)
                 → Hub2 returns paymentUrl
Bot → Customer:  "Cliquez ici pour payer: [Hub2 payment link]"
                 (or Mobile Money prompt, depending on Hub2 flow type)
Hub2 webhook:    payment.completed → reconciliation row written (merchantRef, amount,
                 status=completed, providerReference, timestamp)
Bot → Customer:  "Paiement reçu ✔ Ref: HUB2-XXXX. Votre commande est confirmée."

--- 23:59 each day ---
Bot → Merchant:  Daily summary: "Aujourd'hui: 7 ventes, 84 000 XOF encaissés.
                  Détails: [liste lignes]. Règlement Hub2 J+1."
```

No personal-account collection in any step. Settlement is Hub2 → merchant directly.
LTS never touches funds (no-custody invariant — design spec §Track 4).

---

## 4. Onboarding via Hub2 KYB

Each merchant onboards as their own merchant of record via Hub2's KYB link.
Hub2 handles identity verification, RCCM validation, and settlement account setup.
LTS acts as the referring integrator — not as the payment processor.

⚠️ **Terms pending Laurraine confirmation** — the exact KYB-referral mechanics,
commission rate, and whether per-merchant sub-accounts fit LTS's current single-merchant
Hub2 agreement must be verified before any pilot promise or pricing is finalized.
(Design spec open question #1: "Hub2 KYB-referral mechanics + commission rate (Laurraine).")

Required merchant documents (KYB baseline, subject to Hub2 confirmation):
- RCCM (or equivalent semi-formal registration)
- Mobile money account (Wave / MTN / Orange)
- Business phone number for WhatsApp Business API

Addressable segment v1 = merchants who can pass Hub2 KYB (semi-formal).
The 95% fully-informal segment (MicroSave Abidjan 2019: 95% of informal merchants had
zero formal merchant payment acceptance) is out of scope for v1 — see §8 Non-goals.

---

## 5. Pricing draft (anchored — subject to Hub2 terms confirmation)

**Revenue model: Hub2 referral commission + monthly SaaS fee.**

Market anchors (all from research appendix):
- Chariow (no-code shop, CIV/SEN/BFA): **15% commission per sale** — willingness-to-pay
  ceiling for the social-commerce segment.
- Local agency range (Pixl Studio / freelancer Paul Maxime Dossou): **15,000–80,000 FCFA/mo**
  for WhatsApp chatbot builds with mobile money — this is the "do it yourself" substitute cost.
- MTN MoMo API integration burden: **400,000–900,000 FCFA + 1–3 weeks KYC** — the
  integration cost WariMCP abstracts per operator.
- Hub2 payment-aggregator fee: **1.8–2.5%** (research appendix §PSP comparison).

**Draft pricing tiers (ASSUMPTION — requires Hub2 terms + owner validation):**

| Tier | Monthly fee | Commission | Included volume |
|---|---|---|---|
| Starter | 15,000 FCFA/mo | Hub2 referral rate (tbd) | Up to 200 tx/mo |
| Growth | 35,000 FCFA/mo | Hub2 referral rate (tbd) | Unlimited tx |

Rationale: Starter sits at the bottom of the agency range (15k) and well below
Chariow's 15%/sale model. Growth at 35k is mid-range. Commission on top = aligned
incentives (LTS earns when merchants earn). Exact referral rate = Laurraine confirms.

**Hard rule:** no published pricing, no pilot payment collection until Hub2 terms confirmed
AND ARTCI declaration filed (Loi 2024-352). See gate chain §7.

---

## 6. Pilot plan

**Target:** 2–3 Abidjan merchants from the owner's network or warm introductions.

**Segment criteria:** semi-formal (RCCM-eligible or willing to obtain it); active
WhatsApp seller; current checkout = Wave/screenshot; volume ≥ 30 transactions/month
(enough to feel the reconciliation pain).

**Sequence:**
1. **Sandbox phase** (pre-gate): configure demo flow with sandbox Hub2 credentials;
   run pilot merchants through a scripted walkthrough; collect friction feedback on
   the order → payment → reconciliation loop. No real money moves.
2. **Live cutover** (post-gate, per design spec gate chain): only after RCCM emission,
   Hub2 terms confirmed, Meta verification or BSP fallback operational, and ARTCI
   declaration filed. `/lts-pre-deploy` matrix entry added before first production deploy.
3. **Success signal:** ≥ 2 merchants complete 10+ sandbox transactions without
   hand-holding; at least 1 commits to live pilot. This is primary demand validation —
   the research explicitly flagged that quoted WhatsApp-commerce statistics are
   citation-laundered (research appendix §B); talking to actual merchants is the only
   reliable signal.

**Pilot is not a soft launch.** It does not constitute commercial service and does not
trigger ARTCI obligations until a fee is charged.

---

## 7. Gate chain (external clocks — non-negotiable order)

Per design spec Track 4:

1. **RCCM emission** — signing done 2026-08-04; emission pending.
2. **Meta Business Verification** — current WhatsApp Agent blocker; BSP route (HelloDuty-class)
   is the fallback if verification is delayed past pilot start.
3. **Hub2 KYB terms confirmed** (Laurraine) — referral mechanics + per-merchant sub-account
   eligibility. Pre-gate work (this spec, flow design, pilot shortlist) can proceed in parallel.
4. **ARTCI prior declaration** (Loi 2024-352) — required before charging customers commercially;
   files as soon as RCCM lands.
5. **`/lts-pre-deploy` matrix entry** added for Track 4 before first production deploy.
6. **`/lts-board-review`** before any public launch or final pricing.

No live payment collection until gates 1–4 are cleared. BCEAO 001-01-2024 liability
flag remains OFF until then (ROADMAP.md §Phase 2).

---

## 8. Meta-rules compliance note

Meta's January 2026 rule change banned general-purpose chatbots on the WhatsApp Business
Platform — only scoped business bots (orders, support, bookings) are permitted.

Track 4's bot is scoped to: order intake, payment collection, booking confirmation,
and reconciliation summaries. It does not offer generic conversational AI, news,
entertainment, or non-commerce queries. This is the form Meta permits and that LTS
will implement.

Meta also launched native AI agents for WhatsApp Business globally (June 2026, TechCrunch,
token-priced) — Meta now sells the conversation layer. This confirms the design spec's
conclusion: the durable open layer in WAEMU WhatsApp commerce is the payment/orchestration
side, not a chatbot SaaS. Track 4's value proposition is the licensed XOF rail + reconciliation,
not the conversation wrapper.

---

## 9. Non-goals v1

The following are explicitly out of scope for v1 — do not build, promise, or pilot:

- **Personal-account collection** — hard-removed 2026-06-12 under BCEAO 001-01-2024;
  violates the no-custody invariant; reintroducing this is a regulatory breach, not a feature.
- **Fully-informal merchant segment** — the 95% who cannot pass Hub2 KYB; their onboarding
  path does not exist in v1. Do not build a USSD or alternative collection path to serve them
  here (USSD substrate is DÔGÔ's decision, not WariMCP's — design spec killed list).
- **USSD channel** — DÔGÔ's scope; out of scope for WariMCP v1.
- **Multi-currency / cross-border** — XOF only in v1; cross-border routing is a later track.
- **Recurring payments / subscriptions** — Wave has no recurring API; scoping out removes
  a provider constraint.
- **Fully automated AI conversation** — the scoped bot handles order/payment; open-ended NLP
  for arbitrary merchant inventory or negotiation is not in v1 scope.
- **A standalone merchant dashboard** (web) — the reconciliation surface v1 is a daily
  WhatsApp summary message. A web dashboard is a post-pilot decision.

---

## 10. Technical requirements inherited from the spike

Three gaps identified during the Track 2 spike must be resolved before production. They
are product requirements for Track 4, not implementation details to defer.

### Gap 1 — Mandate carries no customer identity
**Source:** `src/tools/authorize-and-pay.ts` line 73 — `KNOWN GAP (spike): phone stands in
for customer name. Production: the mandate should carry customer identity.`

**Requirement:** The mandate schema must include `customerName` (required) and
`customerEmail` (optional) as first-class fields before any live merchant transaction.
Hub2 requires a non-empty `customerReference` (`POST /payment-intents` trap, design spec
§Track 1). Using `customerPhone` as a name stand-in will fail Hub2's validation on
real intents. The Track 4 spec owns this requirement; Track 1 owns the adapter trap.

### Gap 2 — Trusted-key management is env-based (global)
**Source:** `src/config.ts` — `WARIMCP_TRUSTED_AGENT_KEYS` is a single environment variable
holding all trusted public keys; `src/tools/authorize-and-pay.ts` reads it via `getConfig()`.

**Requirement:** Production with multiple merchants requires a per-merchant key registry:
each merchant's authorized agent key(s) stored separately, with the ability to rotate or
revoke a single merchant's key without redeploying or touching other merchants' configs.
The implementation shape (DB table, secrets manager, or per-merchant env partition) is a
Track 4 build decision; the requirement is fixed.

### Gap 3 — Nonce store is in-memory
**Source:** `src/tools/authorize-and-pay.ts` lines 8 and 90 — `const seenNonces = new Set<string>();`
with the comment "production moves this to a DB-backed unique index on nonces."

**Requirement:** Production nonce deduplication must be a DB-backed unique index
(or equivalent persistent store), not an in-memory Set. The in-memory store resets on every
process restart — a server restart between mandate issuance and payment execution would allow
replay of any mandate issued before the restart. This is a security requirement, not a
performance concern.

---

## 11. Open questions (carried forward)

1. Hub2 KYB-referral mechanics + exact commission rate — Laurraine (blocks pricing finalization).
2. Per-merchant sub-account eligibility under LTS's current Hub2 agreement — Laurraine.
3. Meta verification timeline post-RCCM; BSP choice (HelloDuty vs. other) if delayed.
4. Pilot merchant recruitment channel — owner's network vs. cold outreach.
5. Product name for Track 4 (not needed before pilot end).
6. CinetPay: the research appendix flags the unresolved September 2025 cyberattack ($1.2M+
   owed to merchants as of Feb 2026). LTS's market rule (lts-playbook §PROD-1) lists CinetPay
   as approved — owner review required before any client CinetPay integration.
