# WariMCP × x402 — First Paid Call in 5 Minutes

WariMCP's HTTP API can be used **without an account**: any request that doesn't
carry an `X-Api-Key` can pay per call in **USDC on Base** via the
[x402 protocol](https://x402.org). This guide takes you from zero to a paid API
call — as a human developer or an AI agent.

## For server operators (enable the paid door)

```bash
# .env
X402_ENABLED=true
X402_PAY_TO=0xYourReceivingWallet     # USDC lands here
X402_NETWORK=eip155:84532             # Base Sepolia first; eip155:8453 = mainnet
X402_PRICE_WRITE=$0.02                # initiate / refund / payout / payment-link
X402_PRICE_READ=$0.005                # verify / list
```

Boot WariMCP. You should see:

```
[x402] facilitator synced — pay-per-call billing active
WariMCP x402 billing ENABLED — pay-per-call in USDC on eip155:84532 → 0xYour...
```

Sanity check — a keyless request now returns a **402 challenge** instead of 401:

```bash
curl -i http://localhost:3000/api/v1/payments -H "Accept: application/json"
# HTTP/1.1 402 Payment Required
# { "x402Version": 2, "accepts": [ { "scheme": "exact", "network": "eip155:84532", ... } ] }
```

API-key customers are unaffected — a valid `X-Api-Key` bypasses the paywall entirely.

## For buyers (make a paid call)

You need a wallet with a little USDC on Base (Sepolia test USDC works on
`eip155:84532` — grab some from the [Circle faucet](https://faucet.circle.com/)).

### JavaScript / TypeScript

```ts
import { wrapFetchWithPayment } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.BUYER_PRIVATE_KEY);
const fetchWithPay = wrapFetchWithPayment(fetch, account);

// The 402 → sign → retry dance happens automatically:
const res = await fetchWithPay("https://your-warimcp-host/api/v1/payments/initiate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    provider: "mock",              // use a real provider (fedapay, cinetpay…) in prod
    amount: 5000,
    currency: "XOF",
    idempotencyKey: `order-${Date.now()}`,
    description: "Test order",
    customerName: "Awa Kone",
    customerPhone: "+2250707070707",
  }),
});
console.log(await res.json());     // → checkout URL
```

### AI agents (MCP / Bazaar)

WariMCP's priced routes ship [Bazaar](https://docs.cdp.coinbase.com/x402/bazaar)
discovery metadata — agents browsing the x402 Bazaar can find WariMCP, read the
input schema, and pay for calls without any human setup. Point an x402-capable
agent at your host and it can initiate mobile-money payments and payouts in
West Africa autonomously.

## Test flow, end to end (Base Sepolia)

1. `X402_NETWORK=eip155:84532`, `WARIMCP_MODE=mock`, boot WariMCP.
2. Fund a throwaway buyer wallet with Sepolia test USDC (Circle faucet).
3. Run the buyer snippet above against `POST /api/v1/payments/initiate`.
4. Watch the settlement land at `X402_PAY_TO`, and the mock provider return a
   checkout URL.
5. Flip to `eip155:8453` + real provider keys when ready. Real USDC → off-ramp
   via Yellow Card / Binance P2P to Wave / Orange Money.

## Pricing model

| Operation | Env | Default |
|---|---|---|
| initiate payment / refund / payout / payment link | `X402_PRICE_WRITE` | $0.02 |
| verify / list | `X402_PRICE_READ` | $0.005 |

The x402 fee is a **software/API fee** paid to the operator's wallet. WariMCP
never holds the underlying mobile-money funds (BYOK, no custody) — the licensed
PSPs (FedaPay, CinetPay, Wave…) collect and settle those directly to the
merchant's own provider account.

## Troubleshooting

- **`Facilitator does not support exact on …`** — the facilitator sync hasn't
  succeeded yet. Check outbound network access to `X402_FACILITATOR_URL`; the
  gateway retries in the background (up to 10 attempts) and logs each attempt.
- **401 instead of 402** — `X402_ENABLED` isn't true, or you sent an
  `X-Api-Key` header (key auth always takes precedence).
- **403** — the API key you sent is invalid. Remove the header to use the paid
  door, or fix the key.
