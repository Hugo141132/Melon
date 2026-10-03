# VPS Deployment & Rollback Runbook: JagoanHosting Nebula General Purpose

> **Task Reference:** `TASK-1011` / `TASK-1012 Tier 2`  
> **Target Host:** JagoanHosting Nebula General Purpose VPS (Fixed IP `38.103.171.46`, Subdomain `monitoring.melonmadura.my.id`)  
> **Deployment Directory:** `/opt/kebun-melon`  
> **Topology:** Docker Compose v2 (`web`, `iot-gateway`, `caddy:2.9-alpine` reverse proxy)  
> **External Dependencies:** Supabase PostgreSQL (Singapore `ap-southeast-1`), EMQX Cloud (Singapore `asia-southeast1`)  
> **Hosting Decision:** JagoanHosting Nebula General Purpose is **FIXED** for both initial deployment and final production release.  
> **Scope:** Initial VPS Deployment Preparation & Verification (Pre-Production / Staging Verification on Nebula VPS)

---

## 1. Architectural Principles & Verified Host Baseline

1. **Fixed VPS Model & Provisioned Host Baseline:**
   - **Host Specification:** Initially provisioned with Rocky Linux, reinstalled to **Ubuntu 26.04.1 LTS** (kernel `7.0.0-38-generic`, `x86_64`, ~1909 MiB RAM; swapfile pending / 0 swap observed at last check).
   - **Container Runtime:** Docker Engine `29.8.2`, Docker Compose `v5.6.0` active.
   - **OS Hardening & Firewall:** UFW active with only TCP `22`, `80`, `443` permitted. User `deploy` provisioned with sudo access; SSH key-based authentication verified after disabling root login, password authentication, and keyboard-interactive authentication.
   - **Off-VPS Image Builds:** All container image builds (`next build`, `tsc`, `prisma generate`) **must be executed off-VPS** (workstation/CI) for `--platform linux/amd64` to prevent OOM/CPU spikes on Nebula. Only identifiable release tags (e.g. `kebun-melon-web:0.1.0-init`) are transferred and loaded.
2. **External Persistence & Messaging:**
   - Supabase PostgreSQL (Singapore `ap-southeast-1`) and EMQX Cloud remain 100% external. Zero database or MQTT broker services run on the VPS host.
   - Initial deployment targets **Singapore Staging** (`ihgoxqdncepbcrqkchxu`), `APP_ENV=staging`, `NODE_ENV=production`, `RETENTION_ENABLED=false`, 1-minute authentication expiry (`AUTH_RESET_TOKEN_EXPIRY_MINUTES=1`, `AUTH_VERIFY_TOKEN_EXPIRY_MINUTES=1`), and approved `ENABLE_FAUCET_CONTROL=true` policy.
   - Mumbai is permanently retired with zero active fallback. (Cloud-project deletion remains unverified).
3. **Gateway Ownership Handover (Strict Single-Consumer Rule):**
   - Because all gateways subscribe to the same hardware topics (`melon/sensor-tanah/...`, `melon/sensor-air/...`, `irigasi/melon/...`), **only ONE active gateway may run at any time**.
   - Any local development or staging gateway (`kebun-melon-staging-gateway`) **must be stopped** immediately before launching the VPS gateway.
4. **Current Status & Operator Evidence (Initial Deployment):**
   - Container images `kebun-melon-web:0.1.0-init` and `kebun-melon-gateway:0.1.0-init` loaded into VPS Docker.
   - Operator reports successful container-status (healthy), website delivery, `/health`, and `/ready` checks. (Labeled as operator-reported evidence; independent measurements, physical valve tests, and local 5 pre-commit CI gates remain unverified for this step).

---

## 2. Prerequisite Host Verification (Operator Step)

Run these checks from your workstation or directly on the VPS host.

### 2.1 DNS Resolution & SSH Reachability Check
```powershell
# From workstation: Check authoritative DNS pointing to VPS
Resolve-DnsName -Name monitoring.melonmadura.my.id -Server 1.1.1.1

# Verify SSH reachability (Port 22)
Test-NetConnection -ComputerName 38.103.171.46 -Port 22
```

### 2.2 Host OS Hardening, Swap & Deploy Directory (On VPS)
Connect via SSH (`ssh deploy@38.103.171.46`) and verify/configure:
```bash
# 1. Verify UFW Firewall allows only SSH, HTTP, HTTPS
sudo ufw status verbose

# 2. Verify or create 2 GB swapfile (Buffer against memory spikes on Nebula)
free -m
# If swap is 0:
# sudo fallocate -l 2G /swapfile
# sudo chmod 600 /swapfile
# sudo mkswap /swapfile
# sudo swapon /swapfile
# echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 3. Create deploy directory and set ownership
sudo mkdir -p /opt/kebun-melon/docker/caddy
sudo chown -R $USER:$USER /opt/kebun-melon

# 4. Verify Docker Engine & Docker Compose v2
docker --version
docker compose version
```

---

## 3. Off-VPS Image Build & Transfer Procedure

Execute on local development machine (outside the VPS):

### 3.1 Build Identifiable Container Images (Platform-Locked)
Always enforce `--platform linux/amd64` when building on Windows or macOS workstations to guarantee binary architecture compatibility on the Nebula Linux x86_64 host:
```powershell
# Build Web standalone image with explicit platform and version tag
docker build --platform linux/amd64 -t kebun-melon-web:0.1.0-init -f apps/web/Dockerfile .

# Build IoT Gateway image with explicit platform and version tag
docker build --platform linux/amd64 -t kebun-melon-gateway:0.1.0-init -f apps/iot-gateway/Dockerfile .
```

### 3.2 Export & Transfer Images Directly (Windows-Reliable)
To avoid PowerShell binary corruption from piping `| gzip`, write directly to disk with `docker save -o`:
```powershell
# Export both images to a tar archive directly
docker save -o melon-images-0.1.0-init.tar kebun-melon-web:0.1.0-init kebun-melon-gateway:0.1.0-init

# Secure copy archive to VPS deploy directory
scp melon-images-0.1.0-init.tar deploy@38.103.171.46:/opt/kebun-melon/

# Copy orchestration files and environment template to VPS
scp docker-compose.prod.yml deploy@38.103.171.46:/opt/kebun-melon/
scp docker/caddy/Caddyfile deploy@38.103.171.46:/opt/kebun-melon/docker/caddy/
scp .env.production.example deploy@38.103.171.46:/opt/kebun-melon/
```

### 3.3 Load Images on VPS Host
On VPS host (`/opt/kebun-melon`):
```bash
cd /opt/kebun-melon
docker load -i melon-images-0.1.0-init.tar
rm melon-images-0.1.0-init.tar
docker images | grep kebun-melon
```

---

## 4. Environment Configuration & Database Pre-Start Check

On the VPS host (`/opt/kebun-melon`):

```bash
# 1. Create .env.production from template
cp /opt/kebun-melon/.env.production.example /opt/kebun-melon/.env.production
chmod 600 /opt/kebun-melon/.env.production

# 2. Populate secrets via text editor (nano/vim)
nano /opt/kebun-melon/.env.production
```

### 4.1 Database Target Identification & Configuration Alignment
* **Targeting Singapore Staging (Pre-Production Verification):**
  - Set `APP_ENV=staging` in `.env.production`.
  - Set `DATABASE_URL` to verified **Singapore Staging** pooler (`aws-0-ap-southeast-1.pooler.supabase.com:6543`, project ref `ihgoxqdncepbcrqkchxu`).
  - **CRITICAL RETENTION WARNING:** When `RETENTION_ENABLED=true`, `iot-gateway` schedules an automatic retention cleanup job 10 seconds after boot (`setTimeout(..., 10000)`), deleting telemetry rows older than `RETENTION_RAW_DAYS` (default 90 days). **Set `RETENTION_ENABLED=false`** during initial verification to protect existing staging database records from automated deletion!
* **Targeting Dedicated Production:**
  - Set `APP_ENV=production` in `.env.production`.
  - Set `DATABASE_URL` to your production Supabase project ref (`aws-0-ap-southeast-1.pooler.supabase.com:6543`).
* **Authentication Expiry Policy:**
  - Enforce `AUTH_RESET_TOKEN_EXPIRY_MINUTES=1` and `AUTH_VERIFY_TOKEN_EXPIRY_MINUTES=1` per latest security governance.
* **Invariants:**
  - Both Web and IoT Gateway connect to `DATABASE_URL` (port 6543 Transaction Pooler, `?pgbouncer=true`).
  - `DIRECT_URL` (port 5432 Session Pooler) is used exclusively for migrations executed from the workstation or bastion, not by container runtime.
  - `ENABLE_FAUCET_CONTROL=true` operational policy is preserved.

### 4.2 Apply Pending Database Migrations (Run from Local Workstation or Bastion)
Before starting web containers, deploy migrations via `DIRECT_URL` (Port 5432):
```powershell
# From local workstation with target database credentials set in DIRECT_URL:
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
```

---

## 5. Gateway Ownership Handover (Strict Single-Consumer Rule)

> **SAFETY INVARIANT:** The existing gateway (local or staging) **must remain running** throughout all preparation, build, transfer, and configuration steps (Sections 1 through 4) so that field telemetry and scheduled irrigations are not interrupted.  
> **STOP THE OLD GATEWAY ONLY IMMEDIATELY BEFORE STARTING THE VPS STACK.**

### 5.1 Handover Execution Sequence
```bash
# STEP 1: On local machine or staging host, STOP only the conflicting gateway
docker compose -f docker-compose.staging.yml stop iot-gateway
# (Or terminate local dev gateway if running: Ctrl+C / kill tsx)

# STEP 2: Verify in EMQX Cloud dashboard that the previous gateway client has disconnected.

# STEP 3: Immediately start the VPS stack (Section 6).
```

### 5.2 Rollback Ownership Definition
If the VPS IoT Gateway fails to start, crashes, or fails its health check within 60 seconds of launch:
1. Immediately run `docker compose -f docker-compose.prod.yml stop iot-gateway` on the VPS.
2. **Reclaim ingestion ownership** by restarting the known-good staging/local gateway:
   `docker compose -f docker-compose.staging.yml start iot-gateway`
3. This guarantees zero prolonged telemetry blackout during initial deployment failures.

---

## 6. Stack Startup & Verification

On the VPS host (`/opt/kebun-melon`):

```bash
# 1. Start Caddy reverse proxy, Web, and Gateway (Compose loads .env.production automatically)
docker compose --env-file .env.production -f docker-compose.prod.yml up -d

# 2. Inspect container status (all must show Up (healthy))
docker compose -f docker-compose.prod.yml ps

# 3. Monitor startup logs
docker compose -f docker-compose.prod.yml logs -f --tail=50
```

### 6.1 Post-Startup Smoke Tests (Run from Workstation)
```powershell
# 1. Test HTTPS Handshake & Security Headers
curl.exe -s -i -I https://monitoring.melonmadura.my.id/health

# 2. Verify Public Static Asset Delivery
curl.exe -s -o NUL -w "%{http_code} %{content_type} %{size_download}\n" https://monitoring.melonmadura.my.id/logo1.webp

# 3. Verify Internal Webhook Blocking (Must return HTTP 403 Forbidden)
curl.exe -s -i -X POST https://monitoring.melonmadura.my.id/api/v1/internal/realtime/publish

# 4. Verify SSE Stream Non-Buffering (Check headers X-Accel-Buffering, Cache-Control)
curl.exe -s -i -N https://monitoring.melonmadura.my.id/api/v1/realtime/stream
```

---

## 7. Emergency Rollback Plan

If an unexpected failure or regression occurs during initial deployment:

### Scenario A: Application Container Failure (Quick Rollback)
```bash
# On VPS host (/opt/kebun-melon):
# Stop production stack
docker compose -f docker-compose.prod.yml down

# If a previous working tag exists (e.g. 0.1.0-previous):
export WEB_IMAGE=kebun-melon-web:0.1.0-previous
export GATEWAY_IMAGE=kebun-melon-gateway:0.1.0-previous
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

### Scenario B: Emergency Reversion to Staging Handover
If the VPS stack must be temporarily taken offline:
```bash
# 1. Stop VPS containers immediately
docker compose -f docker-compose.prod.yml down

# 2. Re-enable local/staging IoT gateway to resume ingestion
docker compose -f docker-compose.staging.yml start iot-gateway

# 3. Fix-Forward Directive:
# Never attempt database rollback to Mumbai. All diagnostic and data repair actions
# follow the Fix-Forward policy in Singapore PostgreSQL.
```

---

## 8. Practical Website Update Procedure (Prosedur Pembaruan Website)

Use this routine procedure whenever changes to the frontend web application (UI, server actions, route handlers, translations, components) are ready for promotion to the VPS.

### 8.1 Step 1: Pre-Commit Code Review, Migrations & CI Verification (Workstation)
All changes are prepared and committed strictly on the `main` branch:
1. **Migration Review:** Check if the update alters `packages/database/prisma/schema.prisma`.
   - If **NO schema change:** No database migration is required.
   - If **SCHEMA CHANGED:** Create migration locally (`npx prisma migrate dev --name ...`) and apply to target database prior to container launch using `DIRECT_URL` (Port 5432).
2. **Execute Mandatory Pre-Commit Quality Gates (Workstation PowerShell):**
   ```powershell
   npm run test:coverage
   npm run test:integration
   npm run check:quality
   npm run test
   npm run test:e2e
   ```
3. **Commit & Push to Remote:**
   ```powershell
   git add <modified-files>
   git commit -m "feat(web): describe updates cleanly"
   git push origin main
   ```
4. **CI Verification:** Check GitHub Actions web interface to ensure all remote CI workflows pass before deploying.

### 8.2 Step 2: Build & Package Only the Changed Service Image (Workstation)
Build the new image off-VPS using a **unique identifiable tag** (never rely on `latest`):
```powershell
# Example: updating web service to release tag v0.1.1-ui
docker build --platform linux/amd64 -t kebun-melon-web:0.1.1-ui -f apps/web/Dockerfile .

# Export single image directly to tar archive
docker save -o web-update-0.1.1-ui.tar kebun-melon-web:0.1.1-ui

# Transfer image archive to VPS
scp web-update-0.1.1-ui.tar deploy@38.103.171.46:/opt/kebun-melon/
```

### 8.3 Step 3: Load New Image on VPS Host
Connect to VPS and load the container image:
```bash
# Connect via SSH
ssh deploy@38.103.171.46

# Navigate to deploy directory
cd /opt/kebun-melon

# Load image into Docker Engine
docker load -i web-update-0.1.1-ui.tar
rm web-update-0.1.1-ui.tar

# Verify image is loaded with proper tag
docker images | grep kebun-melon-web
```

### 8.4 Step 4: Environment & Secrets Preservation Invariant
> **CRITICAL RULE:** **NEVER overwrite live `/opt/kebun-melon/.env.production` with `.env.production.example`.**  
The live `.env.production` contains secret database passwords, auth tokens, and session keys that must be preserved.

To update the image tag used by Compose:
* **Option A (Shell Variable Override - Recommended):** Set `WEB_IMAGE` inline when running Compose.
* **Option B (File Edit):** Update `WEB_IMAGE=kebun-melon-web:0.1.1-ui` inside `.env.production` without touching secret values.

### 8.5 Step 5: Web-Only In-Place Recreate (Zero Gateway Interruption)
For a web-only update, recreate **only the web service** using `--no-deps`. This preserves the running `iot-gateway` container and its active EMQX MQTT connection without interruption:
```bash
# Recreate only the web container with new tag
WEB_IMAGE=kebun-melon-web:0.1.1-ui docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-deps web

# DO NOT use `docker compose down` (causes full outage).
# NEVER use `docker compose down -v` (destroys TLS certs and persistent data!).
```

*(Note for IoT Gateway Updates: If the gateway image is being updated, verify no in-flight valve commands are active, stop the old gateway, and recreate with `GATEWAY_IMAGE=kebun-melon-gateway:<tag> docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-deps iot-gateway`).*

### 8.6 Step 6: Post-Update Verification Hierarchy
Perform layered verification from lowest to highest:
```powershell
# 1. Container Health Check (On VPS)
docker compose -f docker-compose.prod.yml ps web

# 2. Public Liveness Probe (From Workstation)
curl.exe -s -i https://monitoring.melonmadura.my.id/health

# 3. Static Asset & Cache Check
curl.exe -s -o NUL -w "%{http_code}\n" https://monitoring.melonmadura.my.id/logo1.webp

# 4. Gateway Readiness Probe (On VPS internal or via authenticated API)
curl.exe -s http://localhost:3001/health

# 5. Authenticated UI & SSE Verification (Operator in Browser)
# Open https://monitoring.melonmadura.my.id in browser:
# - Log in with Owner/Admin credentials
# - Verify updated UI / components render cleanly
# - Verify real-time telemetry updates arrive over EventSource (SSE)
```

### 8.7 Step 7: When Do Ancillary Components Need Action?
* **When does Caddy need validation / reload / recreation?**
  - **Web UI updates only:** **NO ACTION NEEDED.** Caddy automatically proxies traffic to `web:3000`. No reload, recreation, or restart required.
  - **Caddyfile or domain changes:** Validate first (`docker run --rm -v /opt/kebun-melon/docker/caddy/Caddyfile:/etc/caddy/Caddyfile caddy:2.9-alpine caddy validate --config /etc/caddy/Caddyfile`), then reload gracefully:
    `docker compose -f docker-compose.prod.yml exec reverse-proxy caddy reload --config /etc/caddy/Caddyfile`
* **When does Staging need updating?**
  - Staging (`docker-compose.staging.yml`) should be updated and tested whenever significant frontend or gateway changes require verification before releasing to the VPS.
* **When is a Database Migration actually necessary?**
  - Only when Prisma schema models, tables, columns, indexes, or enums are added or changed. Pure frontend visual, text, component, or algorithm changes do **not** require migrations.

### 8.8 Step 8: Safe Web Rollback Routine
If the new web release displays runtime errors or fails health checks:
```bash
# On VPS (/opt/kebun-melon):
# Immediately roll back to the previous known-good tag (e.g. 0.1.0-init)
WEB_IMAGE=kebun-melon-web:0.1.0-init docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-deps web

# Verify rollback container is healthy
docker compose -f docker-compose.prod.yml ps web
```
> **DOWNTIME & ROLLBACK NOTE:** Recreating containers causes a brief (~2–5 second) sub-second container swap. True zero-downtime rolling deploys require multi-replica blue/green routing not present on a single-node small VPS. Image rollback rolls back application code only; it does **not** roll back database schema changes.

