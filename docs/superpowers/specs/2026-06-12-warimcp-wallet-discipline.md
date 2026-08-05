# WariMCP — User-Signed Wallet Discipline (I5)

> **Status: DESIGN DOC ONLY — no code this round.** This document specifies the
> backward-compatible schema and validation contract that any future USDC work
> (ROADMAP item I1, currently DEFERRED) MUST satisfy. It is written *before* any
> USDC provider exists so the discipline is baked into the contract, not retrofitted.

**Author:** Bigabou · **Date:** 2026-06-12 · **Source:** ROADMAP.md I5 (PROCEED)

---

## 1. Problem & non-negotiable

When a payment's **funds source is USDC** (crypto-settled rather than fiat mobile
money), WariMCP must guarantee one architectural invariant carried over from
ROADMAP I1:

> **USDC must arrive at the partner/provider's wallet, never at an LTS-controlled
> or LTS-pooled wallet — however briefly.**

Aggregating USDC through an LTS wallet recreates exactly the custody problem that
the manual-payment-collection feature created for fiat (BCEAO Instruction
n°001-01-2024). The fix is the same in spirit: **never hold third-party funds.**
For USDC this means the agent/customer signs the transfer end-to-end to a
non-custodial destination; WariMCP only *instructs and observes*, never *holds*.

## 2. Backward-compatible schema additions

New **optional** fields, added to the relevant Zod schemas in
`src/tools/definitions.ts` and the matching `server.tool(...)` registrations in
`src/server/mcp.ts`. All default-absent → **existing fiat callers are unaffected.**

| Field | Type | Default | Required when |
|---|---|---|---|
| `fundsSource` | `enum("fiat" \| "usdc")` | `"fiat"` | always (defaulted) |
| `agentWalletSignature` | `string` | _(absent)_ | `fundsSource === "usdc"` |
| `walletProvider` | `string` | _(absent)_ | `fundsSource === "usdc"` |

Applies to the fund-moving tools: `initiate_payment`, `generate_payment_link`,
and (for disbursement symmetry) `initiate_payout`. Read-only tools
(`verify_payment`, `list_transactions`, `list_providers`, `verify_payout`,
`refund_payment`) are unchanged.

## 3. Conditional validation (design intent — not yet implemented)

Use Zod `.superRefine` on each affected schema:

- If `fundsSource === "usdc"` and `agentWalletSignature` is missing/empty →
  reject with a clear error (`agentWalletSignature is required when fundsSource is usdc`).
- If `fundsSource === "usdc"` and `walletProvider` is missing/empty →
  reject likewise.
- If `fundsSource === "fiat"` → both new fields ignored (no behaviour change).

## 4. Pooled-wallet rejection

Maintain a denylist of known LTS-controlled wallet addresses (config-driven).
Reject any USDC instruction whose resolved destination is on that denylist —
defence-in-depth so a misconfigured provider adapter cannot silently route USDC
into an LTS wallet. The denylist is the runtime enforcement of the §1 invariant.

## 5. Database impact

Additive, nullable columns only (e.g. `funds_source`, `wallet_provider`,
`agent_wallet_signature` on the transactions table). Existing rows remain valid
(NULL = legacy fiat). No destructive migration; fully backward compatible.

## 6. Why design-only now

- No USDC provider exists (I1 deferred; Hub2 — our intended strategic provider —
  already ships crypto in its single API, so USDC may arrive via Hub2 rather than
  a separate adapter). Defining the guardrail now means the eventual integration
  is constrained from day one rather than audited after the fact.
- Zero code surface touched this round → zero regression risk on the live FedaPay
  fiat rail.

## 7. Open design question (left unresolved deliberately)

Signature scheme for `agentWalletSignature`: provider-native attestation vs. a
generic message-signature standard (e.g. EIP-191). To be decided at I1 revival,
informed by whichever provider (likely Hub2) supplies the USDC rail and the I2
avocat opinion on USDC-ingest architecture.

---

## Implementation trigger

This doc becomes actionable only when I1 (USDC ingest) is revived. At that point,
the schema fields above are implemented **first**, with tests, **before** any
USDC provider adapter is wired — so no USDC code can ship without the discipline.
