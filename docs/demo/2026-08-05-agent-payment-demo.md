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

**Single change: the `provider` value in `scripts/demo-agent-payment.ts`.**

```typescript
// In scripts/demo-agent-payment.ts:
const provider = "mock";  // <-- SWAP: "hub2" | "fedapay" once sandbox creds provisioned
```

No source edit is needed anywhere else — the provider value threads from the demo's
call argument through `handleAuthorizeAndPay` to `initiatePayment`/`getProvider`
unchanged, and `metadata.provider` in `src/tools/authorize-and-pay.ts` simply records
whatever value was passed.

Once Hub2 sandbox credentials land in `.env` (`HUB2_API_KEY`, `HUB2_MERCHANT_ID`), change
`provider` to `"hub2"` and re-run `npx tsx scripts/demo-agent-payment.ts`.

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
