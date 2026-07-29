# USSD / SMS Citizen Channel — Côte d'Ivoire Discovery Brief

**Owner:** Bigabou (LTS) · **Regulatory owner:** Whis · **Date:** 2026-06-20
**Status:** DISCOVERY — gates the build decision; no engineering committed yet.
**Substrate of record:** Wari MCP (`~/automation/projects/warimcp`, MIT, Node ≥22 / Express / Drizzle+Postgres 16)

---

## 1. Why this brief exists

A cited build-vs-adopt study (2026-06-20) concluded: **build a lean SMS/USSD flow engine on the Wari MCP scaffold; do NOT adopt RapidPro or Glific.** Three findings drove it:

- **RapidPro & Glific are both AGPL-3.0** — disallowed for LTS client-delivered code.
- **RapidPro removed native USSD from core in v5.0**, and its canonical adapter (Africa's Talking) **does not offer USSD in Côte d'Ivoire** (SMS/short-code only). Both community USSD-adapter repos are abandoned (dsmagic stale since 2022; mista-io CI-churn only).
- Therefore *adopting* RapidPro does not remove the hard part: you build the CIV operator USSD adapter either way.

The **only external critical-path unknown** is operator USSD provisioning. Everything else (session state machine, flow runner) is internal work LTS controls. This brief is the input to the **Orange CI Business** conversation and the **ARTCI** code request, and it defines the gate before any production build.

---

## 2. What we need FROM Orange CI Business (`business.orange.ci`)

Request the **enterprise USSD onboarding pack** and confirm each of the following — these are the questions that de-risk the build:

**Provisioning & commercials**
- USSD short-code creation cost + monthly maintenance. *Baseline to confirm: ~500,000 FCFA HT (code creation + maintenance) + ~200,000 FCFA HT integration ([business.orange.ci USSD API](https://business.orange.ci/fr/telephonie/mobile/api-ussd.html)) — single-page source, treat as unconfirmed until sales verifies.*
- **Lead time** from contract to live short-code. ⚠️ **Unknown — no primary source found. This is the single biggest schedule risk; get it in writing.**
- Is there a **sandbox / test short-code** before production?

**API spec (the technical unknowns that shape the engine)**
- Request/response wire format (HTTP callback shape).
- Session semantics: `CON` (continue) / `END` (terminate) convention, **session timeout** (USSD norm ~180 s), max concurrent sessions, retry behaviour.
- Per-screen character limit, menu depth limit, and **encoding** — confirm UTF-8 / French accented characters render on feature phones (GSM-7 vs UCS-2).

**Billing model**
- Per-session pricing tiers. *Baseline to confirm: 25 → 4 FCFA/session, tiered by volume (same source).*
- Who pays — **free-to-user** vs reverse-billed? (Decisive for a *citizen* service: it must be free to the end user.)
- Settlement / reconciliation cadence.

**Scope & onboarding**
- Confirm the code is **Orange-only** — MTN CI and Moov CI require **separate contracts and separate codes** (a USSD code on one operator does not roam to the others).
- KYC / contract / legal-entity requirements for LTS. ⚠️ **LTS RCCM is still pending** — confirm whether provisioning can start pre-RCCM or is blocked on it. If blocked, this moves to the critical path.

---

## 3. ARTCI step (parallel, free) — owner: Whis

Per **ARTCI Decision n°2023-966 (19 Oct 2023), USSD codes are allocated free of charge** to support mobile financial services ([Agence Ecofin](https://www.agenceecofin.com/actualites-numerique/0611-123191-cote-d-ivoire-l-artci-favorise-l-acces-aux-codes-ussd-pour-le-developpement-des-services-financiers-mobiles)). Apply via the **Guichet Unique (Marcory)** using the *Demande de numéro SVA à canal USSD* form ([ARTCI form page](https://www.artci.ci/index.php/services/plan-de-numerotation/507-demande-de-numero-sva-a-canal-ussd.html)).

So **total USSD cost = free regulatory code (ARTCI) + paid per-operator provisioning (Orange/MTN/Moov)**.
⚠️ Gate: LTS's own RCCM/ARTCI status is pending — confirm the regulatory request can proceed, and whether it must precede or can run alongside the Orange conversation.

---

## 4. Verified market facts (no aggregator shortcut exists)

| Vendor | USSD in CIV | Note | Source |
|---|---|---|---|
| Africa's Talking | **No** (SMS/short-code only) | The canonical RapidPro USSD adapter — useless here | [AT country list](https://help.africastalking.com/en/articles/2727792-which-countries-are-africa-s-talking-products-in) |
| Bizao | **Defunct** | Compulsory liquidation, Paris court 27 May 2025; site hijacked — do not browse | [LaunchBase Africa](https://launchbaseafrica.com/2025/06/18/french-court-orders-compulsory-liquidation-of-ivorian-founded-fintech-bizao/) |
| Julaya / InTouch (GTP) | No | **Payments** aggregators, not messaging | — |
| Infobip / Twilio | No USSD | SMS/CPaaS only | [Twilio CI](https://www.twilio.com/en-us/guidelines/ci/sms) |

**Implication:** there is no turnkey single-integration USSD aggregator confirmed live in CIV. USSD = direct operator contracts. **SMS**, by contrast, *is* aggregator-friendly (Orange SMS API / Infobip / local providers) and is the easier first channel if USSD lead time proves long.

---

## 5. Parallel internal prototype (buildable now, zero external dependency)

While the Orange/ARTCI conversations run, prototype the **80/20 core** on the Wari MCP scaffold:

- **Session state machine** (per-MSISDN, short-lived, Redis or Postgres-backed).
- **One mock flow** — e.g. "ID verification" — as a JSON/YAML node graph (menu → prompt → branch → action).
- **A mock USSD adapter** that simulates `CON`/`END` request/response locally (swap for the real Orange adapter once the spec lands).

Reuse from Wari MCP: the **provider-adapter pattern** (`src/`), the **signature-verified webhook receivers** (`POST /api/v1/webhooks/:provider`, `/api/sms-webhook`), API-key auth, Drizzle/Postgres. This proves the engine works before a single FCFA is spent on provisioning.

**Effort (order-of-magnitude, calibrate to LTS velocity):** state machine + flow runner ≈ 2–3 wk; operator adapter ≈ 1–2 wk (calendar-dominated by sandbox access); basic flow-authoring UI ≈ 1–2 wk, deferrable.

---

## 6. Decision gate — do NOT start the production build until ALL three:

1. **Orange CI quote + USSD API spec in hand** (§2 answered).
2. **A committed pilot or product pulling it** — e.g. a DÔGÔ revival — so this doesn't become another parked asset (Wari MCP is parked precisely for lack of live traffic).
3. **`/lts-board-review` passed** — this is a strategic/architectural commitment (SOS rule 1.10).

**Carry-over liability:** Wari MCP's `manual-payments/` SMS-scraping feature is a **BCEAO Instruction 001-01-2024** liability and must stay **feature-flagged OFF**. Reuse the adapter/webhook/MCP *scaffolding* — not that feature.

---

## 7. Open questions / explicitly unverified

- **USSD provisioning lead time in CIV** — no primary source; the top schedule risk.
- **MTN CI / Moov CI USSD pricing** — not public; needs account-manager quotes.
- **Orange FCFA figures** — rest on a single Orange page; confirm with sales (MEDIUM-HIGH).
- **Build-effort estimates** — order-of-magnitude, not commitments.

---

## 8. Next action

**Bigabou:** contact `business.orange.ci` → request the enterprise USSD onboarding pack + sandbox access + the API spec (§2). **Whis (parallel):** confirm LTS RCCM/ARTCI prerequisite and open the ARTCI SVA-USSD code request (§3). Log the decision context in AppFlowy Decision Journal once a direction is ratified.
