# WariMCP — Recovery Protocol

> **STATUS: PHASE1 — Parked awaiting sandbox keys** (per System Registry, MEMORY.md)
> **Last verified: 2026-05-14**
>
> WariMCP has no live data and no live traffic. Revival happens only when MTN / Moneroo / FedaPay sandbox keys are issued. Until then, this document is a forward-looking template — most steps below do NOT apply to a PHASE1 service because there is nothing to restore (no DB rows, no in-flight transactions, no NPM proxy host, no logs).
>
> When sandbox keys land, follow the steps below in order; they assume a fresh host with no prior WariMCP state.

**Target (post-revival):** Restore WariMCP to a fresh host in under 30 minutes.

## Prerequisites on Fresh Host
- Ubuntu 22.04+
- Docker + Docker Compose installed
- Nginx Proxy Manager running with `npm_proxy` network
- Sandbox API keys for MTN, Moneroo, FedaPay (none of these exist yet — this is the blocker)

## Step-by-Step Restore

> N.B. for PHASE1: steps 3 (DB restore) and 6 (queue reconciliation) do NOT apply — there is no backup dump to restore and no in-flight transactions to reconcile. Skip those steps until WariMCP has carried at least one live transaction.

### Step 1 — Restore Files (5 min)
```bash
# From backup archive (gdrive:vps-backups)
rclone copy gdrive:vps-backups/warimcp/latest.tar.gz /tmp/
cd /tmp && tar -xzf latest.tar.gz
mv warimcp ~/automation/projects/
```

### Step 2 — Restore Environment (2 min)
```bash
cd ~/automation/projects/warimcp
# .env is NOT in the archive — restore from your password manager or secure vault
cp /path/to/secure/.env .env
```

### Step 3 — Restore Database (10 min)
```bash
# Start only the DB container first
docker compose up -d warimcp_db

# Wait for postgres to be ready
sleep 10

# Restore from backup dump
docker compose exec -T warimcp_db psql -U warimcp warimcp < /tmp/warimcp_db_backup.sql
```

### Step 4 — Start Service (3 min)
```bash
docker compose up -d
docker compose logs -f warimcp   # confirm healthy
```

### Step 5 — Verify NPM Route (2 min)
- Log into Nginx Proxy Manager dashboard
- Confirm `warimcp` proxy host points to container:3000 on npm_proxy network
- Test payment status endpoint

### Step 6 — Queue Reconciliation (5 min)
```bash
# Check the master log for any in-flight transactions at time of failure
cat ~/automation/projects/warimcp/logs/queue.log | tail -50
# Re-process any PENDING transactions manually if needed
```

## Total Estimated Time: ~27 minutes

## Contacts
- CinetPay support: support@cinetpay.com
- Wave developer support: developers@wave.com
- Hub2: developers@hub2.io
