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
4. **Current Status & Verified Host Baseline (Gateway `875f91b`, Web `ada891e`; operator-confirmed closeout — 2026-10-06):**
   - **Active Web Container:** Recreated and healthy with `kebun-melon-web:ada891e`, verified responding to internal health probe (`http://localhost:3000/health`).
   - **Active Gateway Container:** Operator confirms `kebun-melon-gateway:875f91b` running and healthy. Commit `875f91b` was pushed to `main` and GitHub CI passed; web remains `kebun-melon-web:ada891e`.
   - **Retention Runtime (operator-confirmed):** `RETENTION_ENABLED=true`, `RETENTION_TABLES=faucet_commands`. First scheduled cleanup completed at `2026-10-05T18:38:46.472Z` (`2026-10-06 01:38:46 WIB`); cutoff `2026-07-05T18:38:45.685Z`, `totalDeleted=0`, duration `787 ms`, interval `86400000 ms` (24 hours). Read-only preview found no eligible commands.
   - **Evidence Scope:** This confirms the live VPS application, not a separate staging application deployment. The staging database migration status below does not establish the state of `docker-compose.staging.yml`.
   - **Preserved Rollback Baseline:** Tagged `kebun-melon-web:rollback-baseline` and `kebun-melon-gateway:rollback-baseline` preserved in local Docker daemon.
   - **Reverse Proxy & HTTPS Restoration:** Container `kebun-melon-proxy` (`caddy:2.9-alpine`) was restarted after an unexpected shutdown (shutdown cause unknown; investigation pending if recurrence observed); HTTPS restored with valid TLS certificate.
   - **Database Migration Status:**
     - Staging Database (`ihgoxqdncepbcrqkchxu`): Migration `20261008103000_add_reading_location_annotations` is **PENDING OPERATOR DEPLOYMENT** via Staging `DIRECT_URL` (Port 5432).
     - Dev Database (`unbyxlkrzqlafolxcypi`): Migration `20261008103000_add_reading_location_annotations` created and tested with DEV fixtures; reservoir migration `20261003230000` remains separate and pending in dev.
   - **Verified Post-Deployment Smoke Test Acceptance:**
     - Public HTTPS probe to `https://monitoring.melonmadura.my.id/health` returns HTTP 200 with valid TLS certificate.
     - Web and Gateway container status: `healthy`.
     - Faucet command history table server-side pagination (10 rows/page, terminal status filter preservation) verified operational.
     - Event-driven command history refresh via SSE verified functional without continuous polling.
     - Owner approval workflow (top toast notifier, dynamic sidebar badge, bilingual Resend email dispatch) verified functional.
   - **TASK-0503 / TASK-0504 Deployment & Rollout Guidance:**
     - **Migration Deployment (Staging):** Run non-interactively using Staging `DIRECT_URL` prior to container recreation:
       `$env:DATABASE_URL = "<STAGING_POOLED_URL>"; $env:DIRECT_URL = "<STAGING_DIRECT_URL>"; npm run db:migrate:deploy --workspace=packages/database` (or `scripts/cutover/deploy_singapore_staging_migrations.ps1`).
     - **Container Image Status:** Web container image incorporating the single-chart UI and reading-bound annotations is **PENDING OPERATOR BUILD OFF-VPS** after CI gates pass. Specific tag (e.g. `kebun-melon-web:0.2.0-annotated` or commit SHA tag) must be compiled off-VPS with `--platform linux/amd64`.
     - **Rollout Command (Staging):** `docker compose -f docker-compose.staging.yml up -d --remove-orphans web`
     - **Rollout Command (Production):** `WEB_IMAGE=kebun-melon-web:<tag> docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-deps web`
     - **Rollback Command (Production):** `WEB_IMAGE=kebun-melon-web:ada891e docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-deps web`
     - **Zero Architectural Impact on Gateway & Caddy:** IoT Gateway MQTT ingestion is completely unaffected (new DB columns are nullable). Caddy reverse proxy (`Caddyfile`) requires zero changes; SSE streaming at `/api/v1/realtime/stream*` and port 3000 proxying remain identical.
   - **Remaining Unverified / Separate Deployment Items:**
     - Actual deletion and tombstone insertion with aged real data remain unverified; the successful zero-row scheduled run does not exercise those paths.
     - Physical valve hardware actuation prerequisites remain blocked on physical hardware (`TASK-0414`).
     - Memory/latency profiling under production load remains unmeasured; a single `787 ms` zero-row run establishes no performance guarantee.
     - Staging application status (`docker-compose.staging.yml`) must be verified independently.
     - GitHub CI for `875f91b` passed per operator confirmation. None of the five reserved CI commands is necessary for this documentation-only closeout; lightweight documentation checks suffice. No staging/VPS, Docker, database, or reverse-proxy update is required.

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

### 3.3 Load Images on VPS Host (Exact Archive Path & Verification)
On VPS host (`/opt/kebun-melon`):

> **SAFETY INVARIANTS (ARCHIVE INTEGRITY & REMOVAL):**
> 1. **No Wildcard Operations:** Never use wildcard commands like `docker load -i *.tar` or `rm -f *.tar`. Wildcards can expand unpredictably, load unintended stale archives, or delete untracked archives.
> 2. **Explicit Release Tag & Archive Path:** Always define the explicit VPS release tag before referencing the archive path. For the TASK-0917 upgrade, use `0.2.0-retention` consistently across all steps.
> 3. **Explicit Abort on Load Failure:** Check that `docker load` completes with exit code 0. If `docker load` fails, abort immediately and preserve the archive—even if expected image tags already exist from prior attempts.
> 4. **Verified Image Inspection:** Verify both expected image tags exist in Docker Engine before any optional removal of that specific archive.

```bash
cd /opt/kebun-melon

# 1. Define target VPS release tag and exact archive path (TASK-0917 upgrade tag)
RELEASE_TAG="0.2.0-retention"
ARCHIVE_PATH="/opt/kebun-melon/melon-images-${RELEASE_TAG}.tar"

# 2. Check archive exists before proceeding
if [ ! -f "${ARCHIVE_PATH}" ]; then
  echo "ERROR: Release archive not found at ${ARCHIVE_PATH}" >&2
  exit 1
fi

# 3. Load image archive into Docker Engine and EXPLICITLY ABORT on failure
# Must abort immediately before checking existing images or removing archive
if ! docker load -i "${ARCHIVE_PATH}"; then
  echo "ERROR: 'docker load -i ${ARCHIVE_PATH}' failed with non-zero exit status!" >&2
  echo "PRESERVING archive ${ARCHIVE_PATH} for diagnostics. Aborting immediately." >&2
  exit 1
fi

# 4. Verify both expected image tags exist before any optional archive removal
EXPECTED_WEB="kebun-melon-web:${RELEASE_TAG}"
EXPECTED_GATEWAY="kebun-melon-gateway:${RELEASE_TAG}"

if ! docker image inspect "${EXPECTED_WEB}" >/dev/null 2>&1 || \
   ! docker image inspect "${EXPECTED_GATEWAY}" >/dev/null 2>&1; then
  echo "ERROR: Required images (${EXPECTED_WEB} or ${EXPECTED_GATEWAY}) not found in Docker daemon!" >&2
  echo "PRESERVING archive ${ARCHIVE_PATH} for diagnostics. Aborting immediately." >&2
  exit 1
fi

echo "Verification PASSED: Both ${EXPECTED_WEB} and ${EXPECTED_GATEWAY} are present."
# Optional: safely remove only this specific verified archive (never wildcard rm *.tar)
rm -f "${ARCHIVE_PATH}"
```

---

## 4. Environment Configuration & Database Pre-Start Check

On the VPS host (`/opt/kebun-melon`):

```bash
# 1. Create .env.production from template (initial setup only)
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
* **External ML Supabase Configuration (TASK-0413 / DEC-MON-090):**
  - Web container requires `EXTERNAL_ML_SUPABASE_URL` and at least ONE valid key (`EXTERNAL_ML_SUPABASE_SECRET_KEY` or `EXTERNAL_ML_SUPABASE_PUBLISHABLE_KEY`) in `.env.production` to retrieve AI predictions and recommendations for soil and water quality monitoring. Both keys are not simultaneously mandatory.
  - If absent, `ExternalPredictionClient.isConfigured()` evaluates to `false`, causing `/api/v1/devices/[deviceId]/predictions/latest` to return `null` / `UNAVAILABLE`.
  - To avoid secret disclosure in shell history, prompt for keys interactively using `read -s`:
    ```bash
    read -r -s -p "Enter EXTERNAL_ML_SUPABASE_KEY (Publishable or Secret): " ML_KEY; echo ""
    if [ -z "$ML_KEY" ]; then echo "ERROR: ML key cannot be empty. Aborting." >&2; exit 1; fi
    update_or_add_env .env.production EXTERNAL_ML_SUPABASE_URL "https://styjuynxuykvujnnqxos.supabase.co" || exit 1
    update_or_add_env .env.production EXTERNAL_ML_SUPABASE_PUBLISHABLE_KEY "$ML_KEY" || exit 1
    unset ML_KEY
    ```

### 4.2 Reliable Image Tag Configuration in .env.production (Update-or-Add Procedure)
> **CRITICAL RULE:** **NEVER overwrite live `/opt/kebun-melon/.env.production` with `.env.production.example`.**  
> The live `.env.production` contains secret database passwords, auth tokens, and session keys that must be preserved.
>
> **SAFETY INVARIANTS (UPDATE-OR-ADD PROCEDURE):**
> 1. **Avoid `sed ... || echo ...`:** In standard POSIX/bash, `sed -i` exits with code 0 even if no lines match. Consequently, `|| echo ...` never executes when a key is absent, leaving the key silently missing!
> 2. **Secure Temporary File from Start:** Create a uniquely named temporary file (`mktemp`) in the target directory, restrict its permissions immediately to `600`, clean it up on failure, and propagate non-zero exit codes. A final successful `chmod` must not mask a failed write or rename.
> 3. **Key Exists vs Missing:** If the key exists, update it in-place using awk (avoiding regex delimiter collisions). If absent, append it cleanly to the end of the file with a newline.
> 4. **Preserve Unrelated Settings:** Secrets (`DATABASE_URL`, `AUTH_SECRET`), operational toggles (`RETENTION_ENABLED=false`, `ENABLE_FAUCET_CONTROL=true`), and comments remain untouched.
> 5. **Avoid Exposing Secrets:** Do not print or cat the full file. Verify only the non-secret keys and resolved Compose image references.

```bash
# Define reliable update-or-add shell helper
update_or_add_env() {
  local file="${1:-.env.production}"
  local key="$2"
  local val="$3"

  if [ ! -f "$file" ] || [ ! -r "$file" ]; then
    echo "ERROR: Target file '$file' does not exist or is unreadable." >&2
    return 1
  fi

  local dir
  dir="$(dirname "$file")"

  # Create a uniquely named, secure temporary file in the same directory (same filesystem for atomic mv)
  local tmp_file
  tmp_file="$(mktemp "${dir}/.env.tmp.XXXXXXXXXX")" || {
    echo "ERROR: Failed to create temporary file in '$dir'." >&2
    return 1
  }

  # Enforce restrictive permissions on the temporary file immediately
  chmod 600 "$tmp_file" || {
    echo "ERROR: Failed to set restrictive permissions on temporary file." >&2
    rm -f "$tmp_file"
    return 1
  }

  # Perform update or append with key deduplication
  if grep -q "^${key}=" "$file"; then
    # Update existing key in-place using awk, removing any duplicate occurrences
    if ! awk -v k="$key" -v v="$val" '
      BEGIN { found = 0 }
      $0 ~ "^" k "=" {
        if (!found) { print k "=" v; found = 1 }
        next
      }
      { print }
      END { if (!found) print k "=" v }
    ' "$file" > "$tmp_file"; then
      echo "ERROR: awk failed while updating key '$key'." >&2
      rm -f "$tmp_file"
      return 1
    fi
  else
    # Copy existing content and append missing key
    if ! cp -p "$file" "$tmp_file"; then
      echo "ERROR: Failed to duplicate '$file' to temporary file." >&2
      rm -f "$tmp_file"
      return 1
    fi
    chmod 600 "$tmp_file" || { rm -f "$tmp_file"; return 1; }
    if [ -s "$tmp_file" ] && [ -n "$(tail -c1 "$tmp_file" 2>/dev/null)" ]; then
      echo "" >> "$tmp_file" || { rm -f "$tmp_file"; return 1; }
    fi
    echo "${key}=${val}" >> "$tmp_file" || {
      echo "ERROR: Failed to append key '$key' to temporary file." >&2
      rm -f "$tmp_file"
      return 1
    }
  fi

  # Atomically replace target file
  if ! mv -f "$tmp_file" "$file"; then
    echo "ERROR: Failed to atomically replace '$file' with '$tmp_file'." >&2
    rm -f "$tmp_file"
    return 1
  fi

  # Final permission enforcement on the replaced file
  if ! chmod 600 "$file"; then
    echo "ERROR: Failed to enforce 600 permissions on '$file'." >&2
    return 1
  fi

  return 0
}

# Capture previous web image tag to durable state file before update (persists across SSH sessions)
PREV_WEB_IMAGE=$(grep '^WEB_IMAGE=' .env.production 2>/dev/null | cut -d'=' -f2-)
if [ -n "$PREV_WEB_IMAGE" ]; then
  echo "$PREV_WEB_IMAGE" > /opt/kebun-melon/.prev_web_image
  chmod 600 /opt/kebun-melon/.prev_web_image
fi

# Apply release tags to .env.production (aborting on any update failure)
update_or_add_env .env.production WEB_IMAGE "kebun-melon-web:${RELEASE_TAG}" || { echo "ERROR: Failed to update WEB_IMAGE"; exit 1; }

# Step A: Verify keys in file without exposing secrets:
echo "--- Verified image keys in .env.production ---"
grep -E '^(WEB_IMAGE|GATEWAY_IMAGE)=' .env.production

# Step B: Verify resolved Compose image references and validate matching web image:
echo "--- Verified Compose resolved image references ---"
RESOLVED_IMAGES=$(docker compose --env-file .env.production -f docker-compose.prod.yml config --images) || { echo "ERROR: docker compose config failed"; exit 1; }
echo "$RESOLVED_IMAGES"
if ! echo "$RESOLVED_IMAGES" | grep -q "kebun-melon-web:${RELEASE_TAG}"; then
  echo "ERROR: Compose resolved image does not match target kebun-melon-web:${RELEASE_TAG}!" >&2
  exit 1
fi
```

### 4.3 Database Migration Assessment & Pending TASK-0917 Migration Status
> **CRITICAL DISTINCTION (DOCUMENTATION CHANGE VS FULL TASK-0917 RELEASE):**
> - **Documentation-Only Changes:** Updates to documentation, checklists, runbooks, or `.gitignore` require **ZERO database migrations and ZERO container updates**.
> - **Full TASK-0917 Release:** Although `packages/database/prisma/schema.prisma` has no DDL schema alterations, a reviewable data pruning migration (`20261003230000_reservoir_water_readings_latest_5_retention`) exists in `packages/database/prisma/migrations/` to trim historical excess reservoir readings beyond the latest 5 per device.
> - **Deployment Status:** The migration deployment status on Singapore Staging (`ihgoxqdncepbcrqkchxu`) and active VPS database remains **PENDING / UNKNOWN** until explicitly verified by the operator using database credentials. No live migration is executed automatically.
> - **Execution:** When the operator executes the full TASK-0917 release, deploy pending migrations from the local workstation or bastion via `DIRECT_URL` (Port 5432):
>   ```powershell
>   # From local workstation with target database credentials set in DIRECT_URL:
>   npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
>   ```

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

### 8.3 Step 3: Load New Image on VPS Host (Exact Archive Path & Verification)
Connect to VPS and load the container image:
```bash
# Connect via SSH
ssh deploy@38.103.171.46

# Navigate to deploy directory
cd /opt/kebun-melon

# 1. Define explicit release tag and exact archive path (no wildcards!)
RELEASE_TAG="0.1.1-ui"
ARCHIVE_PATH="/opt/kebun-melon/web-update-${RELEASE_TAG}.tar"

# 2. Check archive exists before loading
if [ ! -f "${ARCHIVE_PATH}" ]; then
  echo "ERROR: Release archive not found at ${ARCHIVE_PATH}" >&2
  exit 1
fi

# 3. Load image into Docker Engine and EXPLICITLY ABORT on failure
if ! docker load -i "${ARCHIVE_PATH}"; then
  echo "ERROR: 'docker load -i ${ARCHIVE_PATH}' failed with non-zero exit status!" >&2
  echo "PRESERVING archive ${ARCHIVE_PATH} for diagnostics. Aborting immediately." >&2
  exit 1
fi

# 4. Verify expected image tag exists before removing archive
EXPECTED_WEB="kebun-melon-web:${RELEASE_TAG}"
if ! docker image inspect "${EXPECTED_WEB}" >/dev/null 2>&1; then
  echo "ERROR: Image ${EXPECTED_WEB} missing from Docker daemon! Preserving ${ARCHIVE_PATH} for diagnostics." >&2
  exit 1
fi

echo "Verification PASSED: ${EXPECTED_WEB} is present in Docker Engine."
# Optional: safely remove only this specific verified archive
rm -f "${ARCHIVE_PATH}"
```

### 8.4 Step 4: Environment & Secrets Preservation Invariant
> **CRITICAL RULE:** **NEVER overwrite live `/opt/kebun-melon/.env.production` with `.env.production.example`.**  
The live `.env.production` contains secret database passwords, auth tokens, and session keys that must be preserved.

To update the image tag used by Compose:
* **Option A (Shell Variable Override - Recommended for one-off commands):** Set `WEB_IMAGE` inline when running Compose:
  ```bash
  WEB_IMAGE=kebun-melon-web:0.1.1-ui docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-deps web
  ```
* **Option B (Reliable File Edit via Update-or-Add Procedure):** Update `WEB_IMAGE` inside `.env.production` without touching secret values or file permissions:
  ```bash
  # Use tested update_or_add_env function (handles missing/existing keys, preserves 600 perms)
  update_or_add_env .env.production WEB_IMAGE "kebun-melon-web:0.1.1-ui"

  # Verify key without exposing secrets
  grep -E '^WEB_IMAGE=' .env.production

  # Verify resolved Compose image reference
  docker compose --env-file .env.production -f docker-compose.prod.yml config --images
  ```

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
* **When is a Cache Purge Required?**
  - **Caddy Reverse Proxy:** Operates as a pure reverse proxy without internal response caching. Static asset requests (`/favicon-*.png`, `/logo*.webp`) pass directly to the Next.js container.
  - **Conditional Purge Directive:** Purging caches is strictly conditional on evidence. Only execute a cache purge if an external edge CDN (e.g. Cloudflare) or intermediate proxy is confirmed active and serving stale cached responses (`cf-cache-status: HIT`). Never perform blind cache purges.
* **Why are On-VPS Builds Forbidden? (Off-VPS Image Build Rule)**
  - Building images directly on the Nebula VPS (`docker compose build` or `docker build`) is strictly prohibited. The host possesses ~1.9 GB of RAM. The Next.js production build (`next build` / Turbopack / Webpack compilation) requires significant memory and CPU, routinely triggering Linux OOM (Out-Of-Memory) killer terminations that take down active gateway and web services.
  - All container images MUST be compiled off-VPS on workstation or CI runners with `--platform linux/amd64`, packaged via `docker save -o`, transferred via SCP, and loaded with `docker load -i`.
* **When does Staging need updating?**
  - Staging (`docker-compose.staging.yml`) should be updated and tested whenever significant frontend or gateway changes require verification before releasing to the VPS.
* **When is a Database Migration actually necessary?**
  - Only when Prisma schema models, tables, columns, indexes, or data-pruning SQL migrations are deployed. Pure documentation or frontend visual/text changes do **not** require migrations.

### 8.8 Step 8: Safe Web Rollback Routine

If the new web release displays runtime errors or fails health checks:
```bash
# On VPS (/opt/kebun-melon):
# Read previously captured web image from durable state file:
ROLLBACK_IMAGE=$(cat /opt/kebun-melon/.prev_web_image 2>/dev/null)
if [ -z "$ROLLBACK_IMAGE" ]; then
  ROLLBACK_IMAGE="kebun-melon-web:0.2.0-retention"
fi
echo "Executing rollback to: ${ROLLBACK_IMAGE}"
update_or_add_env .env.production WEB_IMAGE "${ROLLBACK_IMAGE}" || exit 1
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-deps web

# Verify rollback container is healthy
docker compose --env-file .env.production -f docker-compose.prod.yml ps web
docker inspect --format '{{json .State.Health.Status}}' kebun-melon-web
```
> **DOWNTIME & ROLLBACK NOTE:** Recreating containers causes a brief (~2–5 second) sub-second container swap. True zero-downtime rolling deploys require multi-replica blue/green routing not present on a single-node small VPS. Image rollback rolls back application code only; it does **not** roll back database schema changes.

---

## 9. Comprehensive Deployment Checklist (Pre-Flight & Execution)

Use this checklist as the final operational gate before and during any VPS deployment.

### 9.1 Release Scope Distinction & Pre-Flight Gate Checklist
- [ ] **Release Scope Classification:**
  - **Documentation / Checklist Updates Only:** Requires **zero** database migrations and **zero** Docker container updates.
  - **Full TASK-0917 Release:** Transitions reservoir water retention to latest-5 per device across database, gateway, and web. Uses release tag `0.2.0-retention` consistently for archive, images, and Compose environment. Physical valve hardware actuation is **out of scope** and removed from TASK-0917 (strictly telemetry retention).
- [ ] **Database Migration Status (TASK-0917 Migration):**
  - Migration `20261003230000_reservoir_water_readings_latest_5_retention` exists in `packages/database/prisma/migrations/`.
  - Its deployment status on Singapore Staging (`ihgoxqdncepbcrqkchxu`) and active VPS database is **PENDING / UNKNOWN** until explicitly verified via credentialed query by the operator.
  - An unchanged `schema.prisma` does not eliminate this migration. Do NOT run live migrations during documentation review.
- [ ] **Branch Invariant:** You are strictly on the `main` branch (no feature branches or detached HEADs deployed to production).
- [ ] **Five Mandatory Quality Gates:** All 5 reserved pre-commit gates executed and passed on local workstation:
  - `npm run test:coverage`
  - `npm run test:integration`
  - `npm run check:quality`
  - `npm run test`
  - `npm run test:e2e`
- [ ] **Manual Git Operations:** Manually staged, committed, and pushed to `main`.
- [ ] **GitHub Actions CI Status:** Verified all remote CI workflows passed green on GitHub before initiating VPS deployment.
- [ ] **Caddy Reverse Proxy Requirement:**
  - Web UI or gateway application updates: **NO Caddy reload or recreation needed.** Caddy proxies automatically to internal container ports.
  - Only reload Caddy if `Caddyfile` or domain definitions were explicitly modified.
- [ ] **Retention Configuration Invariant:** Confirm `RETENTION_ENABLED=false` remains set in `.env.production` during pre-production verification to safeguard existing telemetry.
- [ ] **Single-Gateway Ownership Invariant:** Confirm that only ONE IoT gateway will run globally. Any conflicting local or staging gateway must be stopped before starting the VPS gateway.

### 9.2 Container Packaging & Transfer Checklist (Workstation — Full Release Only)
- [ ] **Platform Flag:** Build strictly with `--platform linux/amd64` using the TASK-0917 semantic release tag:
  ```powershell
  docker build --platform linux/amd64 -t kebun-melon-web:0.2.0-retention -f apps/web/Dockerfile .
  docker build --platform linux/amd64 -t kebun-melon-gateway:0.2.0-retention -f apps/iot-gateway/Dockerfile .
  ```
- [ ] **Deterministic Archive:** Save container images directly to named archive:
  ```powershell
  docker save -o melon-images-0.2.0-retention.tar kebun-melon-web:0.2.0-retention kebun-melon-gateway:0.2.0-retention
  ```
- [ ] **Transfer:** Secure copy (`scp`) the archive directly to `/opt/kebun-melon/` on the VPS host:
  ```powershell
  scp melon-images-0.2.0-retention.tar deploy@38.103.171.46:/opt/kebun-melon/
  ```

### 9.3 VPS Execution Checklist (Host `/opt/kebun-melon` — Full Release Only)
- [ ] **Define Release Tag First:** Set `RELEASE_TAG="0.2.0-retention"` and `ARCHIVE_PATH="/opt/kebun-melon/melon-images-${RELEASE_TAG}.tar"` explicitly before invoking Docker commands.
- [ ] **No Wildcards:** Never use `docker load -i *.tar` or `rm -f *.tar`.
- [ ] **Archive Existence Check:** Check `[ -f "${ARCHIVE_PATH}" ]` before running load.
- [ ] **Docker Load Success (Explicit Abort):** Check that `docker load -i "${ARCHIVE_PATH}"` exits with code 0. If it fails, abort immediately and preserve the archive—even if image tags exist from prior attempts.
- [ ] **Image Tag Inspection:** Inspect and verify both `kebun-melon-web:${RELEASE_TAG}` and `kebun-melon-gateway:${RELEASE_TAG}` exist in `docker image inspect` BEFORE removing the archive file.
- [ ] **Safe Archive Removal:** Only remove the specific archive (`rm -f "${ARCHIVE_PATH}"`) after tag inspection succeeds.
- [ ] **Environment Tag Update (Avoid `sed ... || echo ...`):**
  - Use `update_or_add_env` to update `WEB_IMAGE` and `GATEWAY_IMAGE` in `.env.production`.
  - Secure temporary file created via `mktemp "${dir}/.env.tmp.XXXXXXXXXX"` with `600` permissions set immediately.
  - Cleaned up on error; error propagates.
  - Verify existing unrelated keys (`DATABASE_URL`, `AUTH_SECRET`, `RETENTION_ENABLED`) remain unchanged.
  - Verify file permissions remain strictly `chmod 600`.
- [ ] **Secrets Non-Exposure:** Verify keys via `grep -E '^(WEB_IMAGE|GATEWAY_IMAGE)=' .env.production` without dumping or logging file secrets.
- [ ] **Compose Config Resolution:** Verify Compose resolves the updated image tags via `docker compose --env-file .env.production -f docker-compose.prod.yml config --images`.
- [ ] **Service Recreate:** Recreate services in-place (`docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-deps web iot-gateway`).
- [ ] **Layered Health Verification:**
  - Verify container status: `docker compose -f docker-compose.prod.yml ps`.
  - Verify public health: `curl -I https://monitoring.melonmadura.my.id/health` (HTTP 200).
  - Verify readiness: `curl https://monitoring.melonmadura.my.id/ready` (HTTP 200).
  - Verify gateway health: `curl http://localhost:3001/health` (HTTP 200).
  - Verify live SSE telemetry stream in operator browser session.


