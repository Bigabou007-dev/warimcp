# WariMCP — Technical Documentation

## Architecture

WariMCP is a Node.js MCP (Model Context Protocol) server that exposes West African payment rails to AI agents. It runs as a containerized service behind Nginx Proxy Manager with an embedded PostgreSQL database for transaction logging.

```
AI Agent / LLM
      │
      ▼
  WariMCP MCP Server (Express + MCP SDK)
      │
      ├── router.js        → Selects the correct payment provider
      ├── tools.js         → MCP tool definitions
      ├── queue.js         → Master log / Always-On queue
      │
      ├── providers/
      │   ├── cinetpay.js  → CinetPay UEMOA gateway (Phase 1)
      │   ├── wave.js      → Wave mobile wallet (Phase 1)
      │   ├── hub2.js      → Hub2/Ecobank unified (Phase 2)
      │   └── papss.js     → PAPSS pan-African (Phase 3)
      │
      └── webhook.js       → Inbound payment confirmations
```

## Deployment

### Prerequisites
- Docker + Docker Compose
- Nginx Proxy Manager (shared `npm_proxy` network)
- `.env` file with all required keys

### First-Time Setup

```bash
# 1. Clone the repo
git clone https://github.com/Bigabou007-dev/warimcp.git
cd warimcp

# 2. Configure environment
cp .env.example .env
nano .env   # fill in API keys

# 3. Add DB password to .env
echo "DB_PASSWORD=$(openssl rand -hex 16)" >> .env

# 4. Start services
docker compose up -d

# 5. Verify
docker compose logs -f warimcp
```

### NPM Proxy Manager Route
- Container name: `warimcp`
- Internal port: `3000`
- Route via NPM — do NOT expose this port publicly

## Maintenance

### Logs
```bash
docker compose logs -f warimcp
docker compose logs -f warimcp_db
```

### Updates
```bash
git pull
docker compose up -d --build
```

### Restart
```bash
docker compose restart warimcp
```

## Security
- Service runs as non-root (`USER node`)
- Zero public ports — all traffic via NPM internal network
- API keys stored in `.env` only, never hardcoded
- DB credentials auto-generated at setup
