# WariMCP — Roadmap

**Provenance:** Derived from the `tokenization_economy` research umbrella
(`~/automation/projects/tokenization_economy/threads/12-warimcp/`),
AutoResearch iteration 1, 2026-05-19. Full evidence + citations live in that
thread's `verdict.md`, `landscape.md`, `regulatory.md`, `customers.md`.

This document is the engineering-facing distillation. It is **not** a
commitment to build everything listed — it is a verdict matrix. Each item
carries PROCEED / DEFER / KILL with rationale.

---

## ⚠️ CRITICAL — disable before any real-money operation

### Manual-payment-collection feature is a regulatory liability

The manual-payment-collection feature (`src/manual-payments/`) routes customer
funds into a **personal Wave / Orange Money account** that LTS controls, with
SMS-scraping reconciliation, and no licensed PSP in the loop:

- `reference-generator.ts` — 1-99 XOF suffix matching, in-memory references.
- `sms-webhook.ts` — parses forwarded Wave/OM SMS, matches amount, marks paid.
- `payment-page.ts` — public `/pay/:ref` instructs the customer to send to the
  personal number.

**Assessment (from thread 12 `regulatory.md`):** This is textbook unlicensed
payment collection under **BCEAO Instruction n°001-01-2024 service (g)
payment initiation**. The "no-custody software vendor" posture does NOT apply
to this feature — the personal account *is* custody, however brief. It almost
certainly also breaches Wave / Orange Money personal-account T&Cs (a
contract-law exposure independent of BCEAO).

**Current exposure:** NONE today — WariMCP has zero live traffic (parked
PHASE1 per `RECOVERY.md`).

**Required action before WariMCP processes any real money again:**
feature-flag `/api/sms-webhook` and `/pay/:ref` **OFF** by default. This is a
~1-hour change. It does NOT need to wait for legal counsel — counsel is
unlikely to ever clear a personal-account collection scheme. The precise
legal characterisation is deferred to the CIV avocat engagement (item I2),
as scope item #1 — but the *disable* is not gated on that.

---

## Strategic reframe

The umbrella research re-positioned WariMCP honestly:

> **WariMCP is LTS internal infrastructure + a developer-tool calling card —
> not a venture-scale payments product.**

Why:
- **The lane is crowded.** Hub2 (single API for mobile money + bank + card +
  *cryptocurrency*, €1B annual throughput, 9 countries), Pretium (live
  USDC↔mobile-money in 6 countries), Bitnob (~1% in CIV), Yellow Card,
  Conduit — all occupy the WA payments-aggregation space.
- **WariMCP has zero live traffic** and only **1 live provider** (FedaPay);
  the other 9 adapters are stubs or unconfigured (the Hub2 adapter throws
  "coming in Phase 2").
- **Stripe / PayPal / Square already ship official payment MCP servers.**
  WariMCP is first *for WAEMU mobile money specifically* — a real but narrow
  first-mover claim.

The defensible position is therefore **internal use + a credible
developer-facing MCP tool**, not a payments startup. Glamorous improvements
(USDC ingest, big-name partnerships) are all DEFER. The real wins are cheap
and unglamorous.

---

## Improvement matrix (I1–I10)

| # | Improvement | Verdict | Notes |
|---|---|---|---|
| **I2** | CIV avocat opinion on Instruction 001-01-2024 | **PROCEED** | ≤1,500 EUR. Scope: (1) manual-payment-collection legality, (2) aggregator-API posture, (3) USDC-ingest architecture if I1 revives, (4) Loi 2023-901 pre-consultation. Gate for any commercial scale. |
| **I4** | List on MCP registries | **PROCEED** | Publish `/.well-known/mcp/server.json`; register on the official MCP Registry (registry.modelcontextprotocol.io) + GitHub MCP Registry; dev.to writeup. ~4hr, zero cost, zero regulatory risk. Real distribution to agent developers. |
| **I5** | User-signed-end-to-end wallet discipline | **PROCEED** | Backward-compatible schema addition to the MCP tool definitions: when funds source is USDC, require `agent_wallet_signature` + `wallet_provider`; reject calls that aggregate through an LTS-pooled wallet. Bake in BEFORE any USDC work. |
| **I6** | Track Pretium feature parity | **PROCEED** | Pretium ships live USDC↔mobile-money ingest + a consumer app + real revenue (40 customers, $6M processed). Monthly 10-30 min monitoring; watch for WAEMU entry. |
| **I1** | Add USDC ingest provider (Yellow Card / Conduit) | **DEFER** | `src/providers/base.ts` supports a no-custody USDC provider cleanly — Conduit is the cleaner fit (23 African countries incl. all WAEMU). But no customer needs it yet, and Hub2 + Pretium already ship it. **Build the integration spec, hold the code.** Architectural non-negotiable: USDC must arrive at the partner's wallet, never an LTS-controlled wallet. |
| **I3** | Deel / Remote / Bitwage partnership outreach | **DEFER** | Blocked until I1 ships a sandbox demo. An unlaunched MIT repo loses the procurement slot — Deel already chose MoonPay/Iron. Revisit once a live USDC→FCFA demo exists. |
| **I7** | Add Onafriq as meta-provider | **DEFER** | Would extend reach to 43+ African markets, but Onafriq white-label EMI terms are not public — needs commercial outreach. |
| **I8** | File ARTCI prior declaration | **DEFER** | Mandatory under Loi 2024-352 before any commercial operation, but gated on LTS RCCM (pending CNI processing). File as soon as RCCM lands. |
| **I9** | Apply for Loi 2023-901 Digital Startup label | **DEFER** | 3-year BIC + VAT exemption if labelized. Comité de Labellisation discretion + RCCM-gated. Fold the pre-consultation into the I2 avocat engagement. |
| **I10** | Pricing strategy | **DEFER — re-scope** | The seed thesis (price near/below Bitnob's ~1%) is **mathematically falsified**: FedaPay charges 2-3% pay-in, so the cost stack alone exceeds 1%. Re-scope to a flat SaaS markup on top of provider fees, justified by the unified API + MCP-native interface + multi-provider routing — NOT an FX undercut. |

---

## Execution sequence

### Now (next 30 days) — all cheap, no external dependency

1. **Disable manual-payment-collection** (feature-flag `/api/sms-webhook` +
   `/pay/:ref` OFF). ~1hr. Removes the single biggest liability.
2. **I4 — MCP registry listing.** Publish `server.json`, register on the
   official + GitHub MCP registries, write the dev.to post. ~4hr.
3. **I5 — user-signed-wallet discipline.** Write the design doc; add the
   backward-compatible schema fields to the MCP tool definitions.
4. **Tier D activation.** Wire **Moi by DNC** spa payments through WariMCP's
   live FedaPay rail. This is the cheapest real-usage signal available — no
   outreach, no USDC, no counsel — and it generates the first `transactions`
   rows + the "X processes payments via WariMCP" reference any future pitch
   needs. (Internal LTS use of LTS's own tool; standard merchant flow.)

### Next (gated)

5. **I2 — CIV avocat opinion** (~1,500 EUR). Engage when budget is approved.
   This is a financial-spend hard-stop — requires explicit go-ahead.
6. **I6 — Pretium watch.** Add to a monthly review cadence.

### Deferred (revive on trigger)

- **I1 USDC ingest** — revive when a named customer needs it OR Pretium
  enters WAEMU OR a Deel/Remote/Bitwage conversation opens.
- **I3 partnership outreach** — revive after I1 sandbox demo exists.
- **I7 Onafriq** — revive when commercial outreach is authorised.
- **I8 ARTCI + I9 Loi 2023-901** — revive when LTS RCCM is emitted.
- **I10 pricing** — re-scope as a flat-markup model when WariMCP approaches
  any paid customer.

---

## What NOT to add to WariMCP (umbrella KILL findings)

- **No p2p consumer remittance feature.** Thread 03 KILL — Sendwave / LemFi /
  Tether→LemFi own the lane; US MSB + EU PSD2 obligations block a CIV-only
  structure.
- **No agent-hosting / compute layer.** Thread 05 KILL — TAM $30-90k/yr
  UEMOA; TEE is a free hyperscaler primitive; no LTS seam.
- **No hardware / IoT payment rails.** Thread 11 DEFER 12 months — Robonomics
  effectively dead; <10 WA hardware operators.
- **No x402 facilitator role.** Running a WAEMU x402 facilitator almost
  certainly triggers BCEAO Instruction 001-01-2024 service (g) + PSP
  licensing (10M-100M XOF capital floor). Stay an *integrator* of Coinbase's
  x402 facilitator; never *be* the facilitator.

---

## Key facts the roadmap rests on

- **FedaPay is now BCEAO-licensed** (Établissement de Paiement, Décision
  n°142-04-2026, `EP.BN.004/2026`). WariMCP's live rail sits on a licensed
  PSP — "orchestration above a licensed entity" is a factually true claim
  for the FedaPay rail. FedaPay charges 2-3% pay-in.
- **BCEAO Instruction n°001-01-2024** (NOT 008-05-2015) is the binding
  payment-services instrument. No "fournisseur de services techniques"
  carve-out for no-custody software vendors. PI capital floor 10M-100M XOF.
- **Hub2** already covers crypto in its single API — treat as a supplier to
  wrap (the Hub2 adapter), not a competitor to out-flank.
- **MCP discovery in 2026** runs through the official MCP Registry
  (Anthropic + GitHub + Microsoft) + GitHub MCP Registry + VS Code MCP
  gallery; `/.well-known/mcp/server.json` is the auto-discovery mechanism.

---

## Full research

Everything above is distilled from:
`~/automation/projects/tokenization_economy/threads/12-warimcp/`
- `verdict.md` — the I1-I10 matrix with evidence + confidence
- `regulatory.md` — the manual-payment-collection assessment + Instruction
  001-01-2024 mapping
- `landscape.md` — Pretium / Hub2 / Bitnob / FedaPay competitive detail
- `customers.md` — Tier A-E customer analysis (Tier D = internal LTS is the
  activatable one)

Cross-thread context: `~/automation/projects/tokenization_economy/decisions.md`.
