# WariMCP — Recovery Protocol

**Target:** Restore WariMCP to a fresh host in under 30 minutes.

## Prerequisites on Fresh Host
- Ubuntu 22.04+
- Docker + Docker Compose installed
- Nginx Proxy Manager running with `npm_proxy` network

## Step-by-Step Restore

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
