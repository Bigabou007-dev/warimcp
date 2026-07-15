# WariMCP

WariMCP is an MCP (Model Context Protocol) server that gives AI agents and REST clients a unified interface to West African payment providers. It exposes 10 providers through a single API — payments, payouts, refunds, webhooks — with FedaPay as the recommended primary and Hub2 as the recommended secondary. Runs as an MCP stdio server (for Claude/Cursor/Windsurf), an Express HTTP API, or both simultaneously.

## Quick Start

```bash
git clone https://github.com/Bigabou007-dev/warimcp.git
cd warimcp
npm install
cp .env.example .env   # edit with your credentials
npm run db:migrate      # set up PostgreSQL schema
npm run db:seed-api-key # generate your first API key
npm run dev             # starts MCP + HTTP on port 3000
```

Requires Node >= 22 and PostgreSQL 16+.

## Providers

10 providers are available in the codebase. The recommended production setup is **FedaPay + Hub2**.

| Provider | Key | Region | Methods | Currencies | Status |
|---|---|---|---|---|---|
| **FedaPay** | `fedapay` | CI, SN, BJ, TG, BF, ML, NE, GW | MTN, Orange, Moov, Wave, Card | XOF, XAF, GNF | **Recommended Primary** — live keys, true aggregator |
| **Hub2** | `hub2` | CI, SN, ML, BF, TG, BJ, NE, CM | Mobile Money | XOF, XAF | **Recommended Secondary** — pending sandbox access |
| CinetPay | `cinetpay` | CI, SN, ML, BF, TG, BJ + 6 more | Mobile Money, Card, Wallet | XOF, XAF, CDF, GNF | Requires RCCM |
| Wave | `wave` | CI, SN, ML, BF, UG, TZ | Wave wallet | XOF | Requires RCCM |
| Flutterwave | `flutterwave` | CI, SN, NG, GH, KE + 4 more | Mobile Money, Card, Bank | XOF, XAF, NGN, GHS, KES, USD, EUR | Available |
| KKiaPay | `kkiapay` | CI, SN, BJ, BF, ML, TG, NE, GW | MTN, Orange, Wave, Card | XOF, XAF | Available |
| Moneroo | `moneroo` | CI, SN, BJ, BF + 10 more | MTN, Orange, Wave, Moov, Card, Bank | XOF, XAF, GNF, CDF, NGN, GHS, KES, USD, EUR | Available |
| MTN MoMo | `mtn` | CI, GH, UG, RW, BJ, CM, CG | MTN Mobile Money | EUR | Available |
| PAPSS | `papss` | CI, KE, NG, GH | Bank Transfer | XOF, KES, NGN, GHS | Future |
| Mock | `mock` | All | All | All | Testing only |

Set `WARIMCP_MODE=mock` to route all providers through the mock provider (no API keys needed).

## Billing: API keys, x402 pay-per-call, or prepaid mobile-money credits

WariMCP has three billing doors on the HTTP API:

1. **`X-Api-Key`** (default) — account holders, as before. Generate keys with `npm run db:seed-api-key`.
2. **x402 pay-per-call** (optional) — with `X402_ENABLED=true`, requests **without** an API key can pay per call in **USDC on Base** via the [x402 protocol](https://x402.org). No account, no key — a human dev or an AI agent gets a `402` challenge, signs a USDC payment, and the request settles automatically. Priced per operation: writes (initiate/refund/payout/link) at `X402_PRICE_WRITE` (default $0.02), reads (verify/list) at `X402_PRICE_READ` (default $0.005). With `X402_ACCEPT_EURC=true`, **EURC** is offered as a second settlement asset — the XOF is euro-pegged (655.957/EUR), so EURC pricing carries zero FX drift for a WAEMU operator.
3. **Prepaid mobile-money credits** (optional) — with `BILLING_PREPAID_ENABLED=true`, an API key can carry an XOF credit balance charged per call (`BILLING_PRICE_WRITE_XOF`/`BILLING_PRICE_READ_XOF`, defaults 15/3 XOF). Top-ups are collected **through WariMCP itself** on the operator's own PSP account: `POST /api/v1/billing/topup` returns a checkout URL (Orange Money/Wave/MTN…), and the provider's completion webhook credits the balance — idempotently, so replayed webhooks can never double-credit. `GET /api/v1/billing/balance` shows the balance. Keys **without** a credit account behave exactly as before. This door means a developer with no card and no crypto can pay for the API with mobile money.

## Provider failover

If the requested provider rejects a payment initiation with a **4xx** (payment provably never created), WariMCP fails over through `WARIMCP_FAILOVER_CHAIN` (comma-separated, default `fedapay`), skipping unconfigured providers. **5xx/network errors never fail over** — the payment may already exist at that provider, and retrying elsewhere would risk a double charge; the chain also stops if a failover candidate fails ambiguously. Every attempt is written to the audit log.

```bash
X402_ENABLED=true
X402_PAY_TO=0xYourWallet          # receives the USDC
X402_NETWORK=eip155:8453          # Base mainnet (eip155:84532 = Base Sepolia for testing)
```

Rules of the road:
- A present-but-invalid API key is **rejected (403)**, never silently downgraded to the payment flow.
- With `X402_ENABLED=false` (default), behavior is identical to previous releases (missing key → 401).
- Facilitator sync happens at boot with background retries — an unreachable facilitator never crashes the gateway; API-key traffic is unaffected and priced requests error until a sync succeeds.
- The per-call fee is a **software/API fee paid in USDC to your wallet** — WariMCP still never touches the mobile-money funds themselves (BYOK, no custody).

## API Endpoints

All payment/payout endpoints require an `X-Api-Key` header **or an x402 payment** (see Billing above). Generate keys with `npm run db:seed-api-key`.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | No | Health check |
| `GET` | `/api/v1/providers` | No | List all providers and their config status |
| `POST` | `/api/v1/payments/initiate` | Yes | Initiate a payment (returns checkout URL) |
| `GET` | `/api/v1/payments/:id` | Yes | Verify payment status |
| `POST` | `/api/v1/payments/:id/refund` | Yes | Full or partial refund |
| `GET` | `/api/v1/payments` | Yes | List transactions (filterable by provider, status) |
| `POST` | `/api/v1/payment-links` | Yes | Generate a shareable payment link |
| `POST` | `/api/v1/payouts/initiate` | Yes | Disburse to mobile money or bank |
| `GET` | `/api/v1/payouts/:id` | Yes | Verify payout status |
| `POST` | `/api/v1/webhooks/:provider` | No | Inbound webhook receiver (signature-verified) |

## MCP Tools

When registered as an MCP server, WariMCP exposes these tools to AI agents:

| Tool | Description |
|---|---|
| `list_providers` | List all providers, their config status, and supported rails |
| `initiate_payment` | Start a payment via any provider — returns a checkout URL |
| `verify_payment` | Check the status of a payment by transaction ID |
| `refund_payment` | Issue a full or partial refund |
| `list_transactions` | List recent transactions with provider/status filters |
| `generate_payment_link` | Create a shareable payment link |
| `initiate_payout` | Disburse funds to a mobile money wallet or bank account |
| `verify_payout` | Check the status of a payout |

### MCP Registration

```json
{
  "mcpServers": {
    "warimcp": {
      "command": "node",
      "args": ["/path/to/warimcp/dist/index.js"],
      "env": {
        "WARIMCP_TRANSPORT": "stdio",
        "DATABASE_URL": "postgresql://warimcp:yourpass@localhost:5432/warimcp",
        "FEDAPAY_SECRET_KEY": "sk_live_..."
      }
    }
  }
}
```

## Security

- **Helmet** with Content-Security-Policy (default-src 'self', no inline scripts)
- **Timing-safe HMAC verification** for CinetPay and Wave webhooks (`crypto.timingSafeEqual`)
- **HMAC-SHA256 signed webhook relay** — outbound relays include `X-WariMCP-Signature` header
- **API key auth** with SHA-256 hashed storage, per-key permissions, and per-key rate limits
- **Token bucket rate limiting** — 60 req/min default per API key
- **Error sanitization** — provider errors are caught and rewritten; internal details never leak to clients
- **Non-root Docker user** — container runs as dedicated `warimcp` user (UID 1001)
- **Zod validation** on all inputs with strict schemas (amount bounds, phone format, UUID checks)

## No Custody (Bring Your Own Keys)

WariMCP holds no funds and ships no credentials. It only **instructs** licensed payment service providers; money settles directly into the account that the keys belong to — never an intermediary account. Each operator runs their own instance with their own PSP credentials and is **the merchant of record, responsible for their own licensing and regulatory compliance**.

> An earlier "manual payment collection" feature (which routed funds into a personal mobile-money account with SMS reconciliation) was removed in 2026-06 as incompatible with this no-custody posture. Do not reintroduce custody of third-party funds.

## Configuration

All configuration is via environment variables (see `.env.example`):

```env
# Mode: mock | sandbox | live
WARIMCP_MODE=mock

# Transport: stdio | http | both
WARIMCP_TRANSPORT=both
WARIMCP_PORT=3000

# Database
DATABASE_URL=postgresql://warimcp:changeme@localhost:5432/warimcp

# Primary — FedaPay
FEDAPAY_SECRET_KEY=
FEDAPAY_PUBLIC_KEY=

# Secondary — Hub2
HUB2_API_KEY=

# Other providers (configure as needed)
CINETPAY_API_KEY=
CINETPAY_SITE_ID=
WAVE_API_KEY=
WAVE_WEBHOOK_SECRET=
FLUTTERWAVE_SECRET_KEY=
FLUTTERWAVE_PUBLIC_KEY=
KKIAPAY_PUBLIC_KEY=
KKIAPAY_PRIVATE_KEY=
KKIAPAY_SECRET=
MONEROO_SECRET_KEY=
MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY=
MTN_MOMO_API_USER=
MTN_MOMO_API_KEY=
MTN_MOMO_ENVIRONMENT=sandbox
MTN_MOMO_CALLBACK_URL=
PAPSS_API_KEY=

# Webhooks
WARIMCP_WEBHOOK_BASE_URL=
WARIMCP_RELAY_SECRET=
```

## Docker Deployment

```bash
# Set DB_PASSWORD in .env, then:
docker compose up -d
```

Runs two containers on the `npm_proxy` network:
- **warimcp** — Node 22 Alpine, non-root, 512 MB limit, health-checked at `/health`
- **warimcp_db** — PostgreSQL 16 Alpine, 256 MB limit, persistent volume

The HTTP transport is used in Docker (`WARIMCP_TRANSPORT=http`). For MCP stdio access, run the server directly with `node dist/index.js`.

## Roadmap

**Phase 1 (current):** FedaPay as primary aggregator + Hub2 as secondary. All 10 provider adapters implemented. No-custody, bring-your-own-keys posture.

**Phase 2:** CinetPay + Wave activation once RCCM is filed. Full webhook verification for all active providers. Automatic provider fallback (FedaPay -> Hub2 -> CinetPay).

**Phase 3:** PAPSS pan-African corridor (CI to KE/NG/GH). Multi-currency settlement. Bulk payouts.

## License

[MIT](LICENSE)
