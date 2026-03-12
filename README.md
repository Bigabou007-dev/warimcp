# WariMCP

> **The AI-native payment layer for West Africa**

[![npm version](https://img.shields.io/npm/v/warimcp.svg?style=flat-square)](https://www.npmjs.com/package/warimcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/Bigabou007-dev/warimcp/blob/main/CONTRIBUTING.md)

---

## Overview

WariMCP is an **MCP (Model Context Protocol) server** that gives AI agents and LLMs a unified, production-ready interface to all major West African payment rails.

Instead of integrating CinetPay, Wave, Hub2/Ecobank, and PAPSS one by one — WariMCP exposes them all through a single, consistent API that any Claude, GPT, or custom AI agent can call natively.

**Built for:**
- AI agents that need to initiate, track, or refund payments in West Africa
- Developers building fintech products across UEMOA and pan-African corridors
- Agencies that need a white-label payment middleware layer

---

## Supported Payment Rails

| Provider | Region | Coverage | Phase |
|---|---|---|---|
| **CinetPay** | UEMOA | Orange Money, MTN, Wave, Moov, Visa/MC | Phase 1 |
| **Wave** | Côte d'Ivoire, Sénégal | Wave mobile wallet | Phase 1 |
| **Hub2 / Ecobank** | UEMOA (unified) | 200M+ mobile wallets, single API | Phase 2 |
| **PAPSS** | Pan-African | CI ↔ Kenya corridor, 160+ banks, local currency | Phase 3 |

---

## Installation

```bash
npm install warimcp
```

### Environment Variables

Copy `.env.example` and fill in your credentials:

```bash
cp .env.example .env
```

```env
CINETPAY_API_KEY=your_cinetpay_api_key
CINETPAY_SITE_ID=your_cinetpay_site_id
WAVE_API_KEY=your_wave_api_key
HUB2_API_KEY=your_hub2_api_key
PAPSS_API_KEY=your_papss_api_key
WARIMCP_PORT=3000
WARIMCP_ENV=development
```

---

## Usage

### As an MCP Server (Claude / Cursor / Windsurf)

Add to your `.claude.json` or MCP config:

```json
{
  "mcpServers": {
    "warimcp": {
      "command": "node",
      "args": ["/path/to/warimcp/src/index.js"],
      "env": {
        "CINETPAY_API_KEY": "...",
        "CINETPAY_SITE_ID": "..."
      }
    }
  }
}
```

### As a Node.js Module

```js
const warimcp = require('warimcp');

const result = await warimcp.initiatePayment({
  provider: 'cinetpay',
  amount: 5000,
  currency: 'XOF',
  customer: { name: 'Kofi Atta', phone: '+2250700000000' },
  description: 'Invoice #001',
  return_url: 'https://yourapp.com/payment/callback'
});
```

---

## MCP Tools

WariMCP exposes the following tools to AI agents:

| Tool | Description |
|---|---|
| `initiate_payment` | Start a payment via any supported rail |
| `check_status` | Poll the status of a transaction |
| `refund` | Issue a full or partial refund |
| `list_transactions` | List recent transactions with filters |
| `generate_payment_link` | Create a shareable payment link |

---

## Roadmap

### Phase 1 — CinetPay + Wave (March 2026)
- [x] Project scaffold + MCP server
- [ ] CinetPay provider: `initiate_payment`, `check_status`, `refund`
- [ ] Wave provider: `initiate_payment`, `check_status`
- [ ] Webhook handler (payment confirmation)
- [ ] Master log / queue for Always-On reliability
- [ ] npm publish (`npm install warimcp`)

### Phase 2 — Hub2 / Ecobank Unified Gateway (60 days)
- [ ] Hub2 provider integration (single API → full UEMOA)
- [ ] Unified routing layer (auto-select best rail by country/wallet)
- [ ] `list_transactions` across providers
- [ ] Hosted dashboard (transaction monitor)

### Phase 3 — PAPSS Pan-African Corridor (Q3 2026)
- [ ] PAPSS integration (CI ↔ Kenya + 160 banks)
- [ ] Multi-currency settlement engine
- [ ] Enterprise middleware API (AI Bookkeeper, Bulk Payment Agent)
- [ ] Partnership program (Hub2, CinetPay, Orange Ventures)

---

## Contributing

PRs, issues, and discussions are welcome. Please open an issue before submitting major changes.

1. Fork the repo
2. Create your branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push: `git push origin feat/your-feature`
5. Open a Pull Request

---

## License

[MIT](LICENSE) — Built by [Bigabou](https://github.com/Bigabou007-dev) in Abidjan, Côte d'Ivoire.
