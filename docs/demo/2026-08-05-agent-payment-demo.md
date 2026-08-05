# WariMCP Agent Payment Demo — 2026-08-05

**Track 2 acceptance artifact** — recorded merchant demo for the `authorize_and_pay` bridge.

## What this demo shows

An end-to-end merchant payment flow driven entirely by an AI agent:

1. **WhatsApp-style conversation** (simulated transport — Meta verification pending): customer orders two items, agent computes the total (20 000 XOF, within the schema bound of 100–5 000 000 XOF).
2. **Mandate construction + Ed25519 signing**: an ephemeral keypair is generated in-script; the public key is injected into `WARIMCP_TRUSTED_AGENT_KEYS` before config is read; the agent signs the mandate and sends only the signature to the payment bridge.
3. **`authorize_and_pay` call**: the bridge verifies the signature against the server-side allowlist (trust anchor never comes from caller input), checks expiry and replay, then calls `initiatePayment` with `idempotencyKey = nonce`.
4. **Reconciliation row**: the stored transaction row (merchantRef, amount, status, providerReference) is printed in `list_transactions` format.

## What is simulated vs real

| Layer | Status |
|---|---|
| WhatsApp transport | Simulated (Meta verification pending) |
| Database | In-memory stub (same shape as `test/unit/tools/authorize-and-pay.test.ts`) |
| Provider | `mock` — Hub2 / FedaPay sandbox creds not yet provisioned |
| Ed25519 keypair generation | **Real** — `node:crypto` `generateKeyPairSync("ed25519")` |
| Mandate signing + verification | **Real** — `canonicalMandateBytes` → `sign` → `verifyMandate` |
| `handleAuthorizeAndPay` logic | **Real** — production code path, no mocks at the function level |
| Nonce replay protection | **Real** — module-level `seenNonces` Set active |

## Swap point for sandbox / production

**Three changes are required to exercise a real provider — not one.**

```typescript
// In scripts/demo-agent-payment.ts:
const provider = "mock";  // <-- (1) change to "hub2" or "fedapay"
```

The script also hard-codes `process.env.WARIMCP_MODE = "mock"` and loads no `.env`,
so changing `provider` alone is not enough — `registry.ts` will still route to the
mock adapter regardless of the provider string. The full swap requires:

1. **Change `provider`** from `"mock"` to `"hub2"` (or `"fedapay"`).
2. **Set `WARIMCP_MODE=sandbox`** in the environment (the script currently forces
   `WARIMCP_MODE="mock"` at the top — remove or override that line).
3. **Load real sandbox credentials** into the environment (`HUB2_API_KEY`,
   `HUB2_MERCHANT_ID` for Hub2; or the FedaPay equivalent). The demo deliberately
   loads none, so without this step all provider calls will fail at the credential guard.

The `MOCK-` prefix on `providerReference` in the run transcript below is the
tell that the current recording is mock-only — no real network call was made.

Once Hub2 sandbox credentials are available, follow all three steps above and
re-run `npx tsx scripts/demo-agent-payment.ts` to produce a real sandbox transcript.

## Run evidence

Run command:
```
npx tsx scripts/demo-agent-payment.ts
```

Full terminal transcript is in `docs/demo/demo-terminal.txt` (recorded via `script -q -c`).

Summary of run:
- `authorized: true`
- `providerReference`: `MOCK-<uuid-prefix>` (deterministic mock format)
- `status`: `completed` (mock provider returns completed immediately)
- `paymentUrl`: `https://mock.warimcp.local/pay/MOCK-<uuid-prefix>` (the mock provider always returns a URL — verified in `src/providers/mock.ts`)
- `transactionId`: `00000000-0000-0000-0000-000000000042` (stub DB fixed UUID)
- Test suite: **78/78 passed** (`npx vitest run`) — demo added zero regressions

## Regulatory gate reminder

**BCEAO 001-01-2024**: The `authorized` flag must remain `false` in a production context until
the regulatory obligations documented in `ROADMAP.md §Phase 2` are cleared. This demo is
a technical acceptance artifact only. Tracks 3–4 (outreach / launch) remain gated on:
board review, RCCM filing, Hub2 terms acceptance, Meta verification, and ARTCI declaration.
