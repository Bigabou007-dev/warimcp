---
title: "WariMCP — give your AI agent a payment rail for West African mobile money"
status: DRAFT (for review before publishing)
canonical_repo: https://github.com/Bigabou007-dev/warimcp
tags: mcp, ai, payments, africa
---

# WariMCP — give your AI agent a payment rail for West African mobile money

Stripe, PayPal, and Square all ship MCP servers now. None of them speak **WAEMU
mobile money** — the rails most people in Côte d'Ivoire, Senegal, Benin, and the
rest of francophone West Africa actually use (Orange Money, MTN MoMo, Moov, Wave).

**WariMCP** is a small, open-source MCP server that fills that gap. It gives an AI
agent (or any REST client) a single, typed interface to initiate payments and
payouts over West African mobile-money rails — through providers that are already
licensed to move the money.

## The one design decision that matters: no custody

WariMCP **holds no funds and ships no credentials.** It only *instructs* a licensed
payment service provider; the money settles directly into the account whose keys
you configure — never an intermediary account.

That's not a footnote, it's the whole posture. It means:

- You run your **own** instance with your **own** PSP keys (bring your own keys).
- You are the merchant of record, responsible for your own compliance.
- WariMCP-the-software never needs a payment license, because it never touches
  third-party money.

If you've looked at building payment tooling for the region, you know the
licensing question (in WAEMU, BCEAO Instruction n°001-01-2024) is the first wall
you hit. The no-custody design walks around it instead of through it.

## What it exposes

Eight MCP tools, all typed and validated:

| Tool | What it does |
|---|---|
| `list_providers` | Providers + their config status and supported rails |
| `initiate_payment` | Start a payment — returns a checkout URL |
| `verify_payment` | Check a payment's status |
| `refund_payment` | Full or partial refund |
| `list_transactions` | Recent transactions, filterable |
| `generate_payment_link` | A shareable payment link |
| `initiate_payout` | Disburse to a mobile-money wallet or bank |
| `verify_payout` | Check a payout's status |

## Try it in two minutes (no keys, no real money)

Add it to any MCP client (Claude Desktop, Cursor, Windsurf, VS Code) and run in
`mock` mode — every call returns deterministic test data:

```json
{
  "mcpServers": {
    "warimcp": {
      "command": "npx",
      "args": ["-y", "warimcp"],
      "env": { "WARIMCP_TRANSPORT": "stdio", "WARIMCP_MODE": "mock" }
    }
  }
}
```

To go live, set `WARIMCP_MODE=live`, point `DATABASE_URL` at a PostgreSQL
instance, and add **your own** FedaPay key. That's it — the money lands in your
FedaPay account.

## Honest status

This is early and deliberately narrow.

- **FedaPay** (a BCEAO-licensed payment institution) is the working live rail today.
- The other adapters in the repo are stubs or unconfigured. **Hub2** — a single
  API spanning mobile money, card, bank, and crypto across the region — is the
  next provider on the roadmap.
- It's MIT-licensed and runs as a stdio MCP server (plus an optional HTTP API).

## Links

- Repo: https://github.com/Bigabou007-dev/warimcp
- It's listed on the MCP Registry — search `warimcp`.

If you're building agents that need to move money in francophone West Africa,
give it a try and open an issue. Bring your own keys.
