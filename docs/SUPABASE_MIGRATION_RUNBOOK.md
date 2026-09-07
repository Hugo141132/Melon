# Supabase Migration Runbook: Mumbai (`ap-south-1`) to Singapore (`ap-southeast-1`)

> **Task Reference:** `TASK-0916`  
> **Status:** BLOCKED (Local Restore Rehearsals PASSED; Pending Operator CI Gates, Maintenance Window Scheduling, Write Freeze, and Sequential Singapore Cutover)  
> **Architecture:** Free-Plan-Only Sequential Migration with Planned Downtime (Zero Paid Upgrades)  
> **Target Environments:** Development (`dev`) and Staging (`staging`)  
> **Source Region:** AWS Mumbai (`ap-south-1`)  
> **Destination Region:** AWS Singapore (`ap-southeast-1`)  
> **Safety Invariance:** `ENABLE_FAUCET_CONTROL=false` strictly enforced across all environments  

---

## 1. Executive Summary & Design Constraints

### 1.1 Objective & Architecture
Migrate both the **Development** and **Staging** Supabase PostgreSQL databases from **AWS Mumbai (`ap-south-1`)** to **AWS Singapore (`ap-southeast-1`)** using a **Free-plan-only migration design with planned downtime**.

### 1.2 Free-Plan Constraint Principles
1. **Zero Paid Upgrades:** The migration architecture strictly relies on Supabase Free plan capabilities. No Pro plan subscriptions, branch compute add-ons, or paid compute instances shall be provisioned.
2. **Account-Wide Project Cap:** Supabase Free plan enforces a global limit of **2 active projects per account** across all organizations.
3. **Sequential Execution with Planned Downtime:** Because 2 Mumbai projects already occupy the account quota, creating Singapore projects requires sequentially pausing source projects during an approved maintenance window to free up project slots.
4. **Colocation Rationale:** Moving databases to AWS Singapore co-locates persistence with the project's EMQX Cloud MQTT broker (`asia-southeast1`: `he100b10.ala.asia-southeast1.emqxsl.com:8443`), reducing regional network round-trips from ~240ms (Mumbai) to an expected ~20–40ms. (Note: Network latency is path-dependent and cannot be unconditionally guaranteed; operational risks are mitigated through rehearsal and disciplined rollback procedures).

### 1.3 Scope Boundaries & Decoupling from `TASK-0909`
- `TASK-0909` (automated daily offsite backup pipeline to R2/S3) is an independent operational task currently blocked on cloud storage selection. It does **not** block `TASK-0916`.
- Migration-specific recovery is satisfied independently by dedicated, point-in-time, GPG/AES-256 encrypted snapshots, cryptographic checksums, and a mandatory isolated restore rehearsal.
- **Checksum Limitation:** SHA-256 checksums verify transport file integrity only. They do **not** guarantee logical data completeness, foreign key consistency, or successful SQL execution. Logical integrity is validated via row-count parity and local restore rehearsal.

---

## 2. Project Inventory & Security Exposure Audit

### 2.1 Project Identity Matrix

| Attribute | Development (`dev`) | Staging (`staging`) |
|---|---|---|
| **Current Project Ref** | `xjsencdgfcbkzdzqcnqx` | `scqrbtfilmttqrutynyo` |
| **Current Region** | Mumbai (`ap-south-1`) | Mumbai (`ap-south-1`) |
| **Current URL** | `https://xjsencdgfcbkzdzqcnqx.supabase.co` | `https://scqrbtfilmttqrutynyo.supabase.co` |
| **Session / Direct Port** | `5432` (Required for dump, restore, migrations) | `5432` (Required for dump, restore, migrations) |
| **Transaction Pooler** | `aws-1-ap-south-1.pooler.supabase.com:6543` | `aws-0-ap-south-1.pooler.supabase.com:6543` |
| **Database Schema** | `public` (26 tables) | `public` (26 tables) |
| **Custom Integer Sequences** | **0** (All primary keys use UUIDs) | **0** (All primary keys use UUIDs) |
| **Table Owner** | `postgres` (All 26 tables) | `postgres` (All 26 tables) |
| **RLS Status** | **ENABLED** on all 26 tables (`relrowsecurity = true`) | **DISABLED** on all 26 tables (`relrowsecurity = false`) |
| **Installed Extensions** | `plpgsql`, `uuid-ossp`, `pgcrypto`, `pg_stat_statements`, `supabase_vault` | `plpgsql`, `uuid-ossp`, `pgcrypto`, `pg_stat_statements`, `supabase_vault` |
| **Prisma Migrations** | 11 applied | 10 applied (Migration 11 pending) |

### 2.2 Consistent Snapshot Table Manifest (Replacing Historical Audit Counts)
- **Historical Observations (Informational Only):** Historical row counts recorded during preliminary audit (1,417 rows in Dev, 184 rows in Staging) are static observations and must **never** be used as cutover parity criteria. Real-world databases fluctuate as sessions, audit logs, and test fixtures accumulate.
- **Mandatory Snapshot Manifest Policy:** Data verification must be performed against an exact table manifest generated from the **same consistent backup snapshot** as the data dump.
- **Manifest Generation:** During export, an atomic query records every table name in `public` and its exact `count(*)` directly into `${Environment}_manifest.tsv`.
- **Parity Assertion:** Post-restore verification compares every single table's row count against this snapshot manifest. The restore is accepted only if there is 100% parity across all 26 tables.


### 2.3 Separation of Confirmed SQL Grants from Unverified HTTP Exposure
1. **Confirmed Database-Level Findings (SQL Evidence via `@mcp:supabase-staging`):**
   - Staging catalog queries confirm `relrowsecurity = false` across all 26 tables in `public`.
   - Roles `anon` and `authenticated` possess full `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` privileges across all 26 tables in `information_schema.table_privileges`.
   - In `pg_default_acl`, default privileges for tables created by `postgres` in `public` automatically grant `arwdDxtm` (all privileges) to `anon`, `authenticated`, and `service_role`.
   - Role `authenticator` has `rolcanlogin = true` and inherits `anon`, `authenticated`, and `service_role`.
2. **Unverified HTTP Exposure:**
   - Whether the PostgREST HTTP Data API (`https://scqrbtfilmttqrutynyo.supabase.co/rest/v1/`) is publicly accessible or blocked by platform API gateway policies has **not** been tested over HTTP in this turn.
3. **Application Usage Audit:**
   - The Kebun Melon monorepo (`apps/web`, `apps/iot-gateway`, `packages/database`) exclusively uses `@prisma/client` over direct/pooled PostgreSQL connections.
   - `@supabase/supabase-js` is not installed; no code calls `/rest/v1/`. The PostgREST HTTP Data API is completely **UNUSED** by the application.
4. **Proposed Containment Step (Post-Migration):**
   - Disabling the Data API in the Supabase Dashboard (**Project Settings** $\rightarrow$ **API** $\rightarrow$ **Data API** $\rightarrow$ toggle **Off**) is proposed as a containment step for staging to eliminate this alternate attack path.
   - **Invariance:** No database or platform settings are modified in this turn; containment requires its own dedicated verification.

---

## 3. Explicit Privilege, Ownership, and Security Hardening
 
### 3.1 Definition & Consequence of `--no-privileges` in `pg_dump`
- `pg_dump --no-privileges` (`-x` / `--no-acl`) suppresses the generation of access privilege statements (`GRANT` and `REVOKE`).
- It does **not** affect object ownership (governed separately by `--no-owner`) or schema/table definitions.
- **The Security Consequence:** Because `--no-privileges` suppresses explicit access statements from the source dump, restored database objects automatically inherit the target database's default privileges (`pg_default_acl`). In standard Supabase PostgreSQL setups, default ACLs grant full access (`arwdDxtm`) on new tables in `public` to the `anon` and `authenticated` roles.
- **The Exposure Risk:** If Row Level Security is disabled or unconfigured, relying on target default privileges silently creates wide-open access via PostgREST/Data API to all 26 application tables!
- **Mandatory Policy:** Treat proposed RLS and grant hardening as an **explicit security change**. Never rely on target defaults. Following DDL and data restoration, explicit ownership, privilege revocation, default privilege modification, and RLS enforcement must be applied and tested locally.
 
### 3.2 Explicit Security Configuration Script (`scripts/rehearsal/02_post_restore_security.sql`)
Run this script on the rehearsal database and target Singapore databases immediately after data and constraint restoration:
 
```sql
-- ==============================================================================
-- KEBUN MELON: Post-Restore Explicit Security & Privilege Hardening
-- ==============================================================================

-- 1. Ensure all public tables are owned by postgres
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO postgres;', r.tablename);
  END LOOP;
END $$;

-- 2. Revoke all direct privileges from public HTTP roles and PUBLIC pseudo-role
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated, PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, PUBLIC;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated, PUBLIC;

-- 3. Adjust default privileges so future tables created by postgres do not expose grants
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated, PUBLIC;

-- 4. Grant explicit required privileges to application roles (Prisma connects as postgres or service_role)
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, service_role;

-- 5. Enforce Row Level Security across all 26 application tables
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;
```

### 3.3 Effective Privileges & Application Role Verification
Run these queries to verify that effective permissions and role access are strictly enforced:

```sql
-- Verification 1: Verify 100% of tables are owned by postgres
SELECT count(*) AS non_postgres_tables
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND pg_get_userbyid(c.relowner) != 'postgres';
-- EXPECTED: 0

-- Verification 2: Verify RLS is enabled on all 26 tables
SELECT count(*) AS tables_without_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relrowsecurity = false;
-- EXPECTED: 0

-- Verification 3: Test effective privileges for anon, authenticated, and PUBLIC (must be 0)
WITH unauthorized_grants AS (
  SELECT c.relname, r.rolname, p.priv
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN (VALUES ('anon'), ('authenticated'), ('public')) AS r(rolname)
  CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS p(priv)
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND has_table_privilege(r.rolname, c.oid, p.priv)
)
SELECT count(*) AS unauthorized_grant_count FROM unauthorized_grants;
-- EXPECTED: 0

-- Verification 4: Test application role compatibility (postgres & service_role must have full access)
WITH missing_app_privileges AS (
  SELECT c.relname, r.rolname, p.priv
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN (VALUES ('postgres'), ('service_role')) AS r(rolname)
  CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS p(priv)
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND NOT has_table_privilege(r.rolname, c.oid, p.priv)
)
SELECT count(*) AS missing_app_privilege_count FROM missing_app_privileges;
-- EXPECTED: 0
```

---

## 4. Faucet Command Shutdown Ordering & Architectural Constraints

### 4.1 State Machine & The "SENT" Misconception
- Canonical States (`packages/contracts/src/enums.ts`):
  - **Non-Terminal:** `QUEUED`, `SENT`, `ACKNOWLEDGED`, `IN_PROGRESS`
  - **Terminal:** `COMPLETED`, `FAILED`, `CANCELLED`, `TIMEOUT`, `EXPIRED`
- **Critical Safety Finding:** `SENT` does **NOT** mean unexecuted. Once a command is published to MQTT (`SENT`), the physical ESP32 actuator may have already received the payload, opened the valve, and started water flow before the ACK arrives back at the broker. Treating `SENT` as unexecuted or running a blanket SQL update to `CANCELLED` creates physical desynchronization (hardware dispensing water while software marks it cancelled).
- **API Absence:** The web application (`apps/web`) exposes `POST` (create) and `GET` (query); it exposes **no command cancellation endpoint**.

### 4.2 Architectural Limitation: Gateway Shutdown Coupling
- **Audit Finding:** In `apps/iot-gateway/src/index.ts`, `CommandPublisher`, `AcknowledgementProcessor`, and `FaucetEventProcessor` run in the same Node.js process and share the MQTT connection.
- **Coupling Constraint:** The gateway cannot independently halt command polling/publishing while allowing ACK and event processors to continue listening. Invoking `docker compose stop iot-gateway` immediately halts both publisher and subscribers.
- **Operational Blocker Recorded:** In-flight command draining cannot be handled automatically by stopping only the publisher.

### 4.3 Mandatory Shutdown Protocol & Operator Device Reconciliation
1. **Freeze Web Ingress First:** Confirm `ENABLE_FAUCET_CONTROL=false` in `.env`, `.env.staging`, and `docker-compose.staging.yml`. This blocks `POST /api/v1/devices/[deviceId]/faucet-commands`.
2. **Query Non-Terminal Commands:**
   ```sql
   SELECT id, device_id, action, status, requested_at, updated_at
   FROM public.faucet_commands
   WHERE status IN ('QUEUED', 'SENT', 'ACKNOWLEDGED', 'IN_PROGRESS');
   ```
3. **If Count > 0 (CUTOVER BLOCKER):**
   - **Do NOT stop the IoT gateway container.**
   - **Do NOT proceed with cutover or database pausing.**
   - Arbitrary timeouts (e.g. 120 seconds) are **unsupported and prohibited**.
   - Non-terminal commands (`QUEUED`, `SENT`, `ACKNOWLEDGED`, `IN_PROGRESS`) remain an **absolute cutover blocker** until supported reconciliation prevents command replay.
   - **Physical Closure Alone Is Insufficient:** Verifying that a valve is physically closed does not resolve the software state. If non-terminal command records remain in the database when services reconnect or restart in Singapore, the IoT gateway or broker may attempt retries, acknowledge invalid states, or trigger replay.
   - **Required Reconciliation:** The gateway must remain running until commands transition naturally to terminal states (`COMPLETED`, `FAILED`, `TIMEOUT`, `EXPIRED`), or until a supported reconciliation script explicitly marks them terminal with accompanying audit logs before the gateway process is terminated.
4. **Verify Valve Closure & Zero Flow:** The operator must independently inspect the physical valve and device telemetry to verify the actuator is physically **CLOSED** and flow rate is strictly **0 L/min**.
5. **Stop IoT Gateway:** Only after non-terminal command count is confirmed **0** AND physical valve closure is verified, stop the gateway:
   ```powershell
   docker compose -f docker-compose.staging.yml stop iot-gateway
   ```
6. **Replay Prevention:** Retain `ENABLE_FAUCET_CONTROL=false` across all environments to guarantee zero command generation or replay during reconnect.


---

## 5. Reproducible Local Restore Rehearsal (MANDATORY GATE)

The rehearsal validates the full export/import cycle on an isolated local PostgreSQL instance (e.g. port 5433) before initiating any cutover.
 
### 5.1 Architecture of Real Foreign Key Integrity Verification
- **The Pitfall of `session_replication_role = replica`:** When data is imported with foreign keys and triggers bypassed, simply setting `session_replication_role = DEFAULT` does **not** validate rows inserted while constraints were bypassed.
- **Three-Section Restore Strategy:**
  1. **Pre-Data DDL (`${Environment}_pre_data.sql`):** Tables, types, sequences, and primary keys are created *without* foreign key constraints.
  2. **Table Data (`${Environment}_data.sql`):** Table rows are inserted.
  3. **Post-Data Constraints (`${Environment}_post_data.sql`):** Foreign key constraints and indexes are created *after* data is loaded. PostgreSQL validates every constraint against the loaded data upon creation.
- **Dynamic Referential Integrity Audit (`scripts/rehearsal/03_verify_integrity.sql`):** In addition to constraint creation, the verification script dynamically queries every foreign key relationship in `public` using `pg_constraint`, asserting that count of orphaned foreign key rows is strictly **0**.
 
### 5.2 Rehearsal Scripts Inventory (`scripts/rehearsal/`)
- `scripts/rehearsal/01_scaffold_rehearsal.sql`: Sets up `anon`, `authenticated`, `service_role`, `authenticator` roles and installs `uuid-ossp` and `pgcrypto`.
- `scripts/rehearsal/02_post_restore_security.sql`: Applies explicit ownership, revokes public/anon grants, alters default privileges, and enforces RLS across all 26 tables.
- `scripts/rehearsal/03_verify_integrity.sql`: Evaluates table counts, RLS status, effective privileges for all roles (including `PUBLIC`), and detects orphaned foreign key rows.
- `scripts/rehearsal/run_local_rehearsal.ps1`: Automated PowerShell orchestrator that handles container lifecycle (port 5433), SQL execution, and table manifest parity validation.
 
### 5.3 Automated Rehearsal Execution (PowerShell)
 
```powershell
# Execute isolated Dev restore rehearsal on port 5433
powershell -File scripts/rehearsal/run_local_rehearsal.ps1 -Environment dev -Port 5433

# Execute isolated Staging restore rehearsal on port 5433
powershell -File scripts/rehearsal/run_local_rehearsal.ps1 -Environment staging -Port 5433
```
 
*Success Criteria:* Exit code = 0; Table count = 26; Tables with RLS = 26; Orphaned FK rows = 0; Unauthorized public grants = 0; 100% row-count parity against snapshot manifest.

### 5.4 Verified Local Restore Rehearsal Results (Completed 2026-09-08)

Both Dev and Staging local restore rehearsals were executed and verified on isolated local PostgreSQL 17 (`postgres:17-alpine`, port 5433) using `scripts/rehearsal/run_local_rehearsal.ps1`:

1. **Development Environment Rehearsal (`dev`):**
   - **Command:** `powershell -File scripts/rehearsal/run_local_rehearsal.ps1 -Environment dev -Port 5433`
   - **Outcome:** Exit Code `0` (Success).
   - **Schema & Tables:** Restored 26 public tables with 0 missing.
   - **Foreign Key Integrity:** Verified 28 foreign key constraints with exactly 0 orphaned referential rows.
   - **Prisma Migrations:** Verified 11 migrations recorded in `_prisma_migrations`.
   - **Snapshot Parity:** 100% per-table row count match against `backups/rehearsal/dev_manifest.tsv`. *(Note: Unchanged row counts serve as evidence of row count parity against the exported snapshot manifest, not proof of byte-for-byte data equality).*
   - **Security Hardening:** Table ownership reassigned to `postgres`, RLS enabled on all 26 tables (`relrowsecurity = true`), direct privileges revoked from `anon`, `authenticated`, and `PUBLIC` (`f|f|t|t` assertion passed).

2. **Staging Environment Rehearsal (`staging`):**
   - **Command:** `powershell -File scripts/rehearsal/run_local_rehearsal.ps1 -Environment staging -Port 5433`
   - **Outcome:** Exit Code `0` (Success).
   - **Phase A (Baseline Restoration):** Restored 26 public tables, 28 foreign key constraints with 0 orphans, 10 Prisma migrations, and 100% per-table row count parity against `backups/rehearsal/staging_manifest.tsv`.
   - **Phase B (Local Migration Catch-Up):** Applied migration `20260905040000_add_auth_and_fk_performance_indexes` locally to the rehearsal container. Verified 11 migrations in `_prisma_migrations`, 13 performance indexes created across 8 tables, and 0 application data rows modified or lost.
   - **Phase C (Security Hardening):** Table ownership set to `postgres`, RLS enabled on all 26 tables, 0 unauthorized public grants (`f|f|t|t`).
   - **Phase D (Deterministic Plaintext Cleanup):** Temporary unencrypted SQL dumps (`dev_data.sql`, `staging_data.sql`) deleted and verified absent (`Test-Path: False`) via PowerShell `try ... finally` block.

3. **Cloud & Production Invariance:**
   - Security hardening and migration catch-up were validated strictly within the local isolated container on port 5433.
   - Live Supabase cloud instances in Mumbai (`xjsencdgfcbkzdzqcnqx` Dev, `scqrbtfilmttqrutynyo` Staging), cloud RLS policies, cloud grants, and live application containers (`kebun-melon-staging-web`, `kebun-melon-staging-gateway`) were NOT mutated and remain active.
 
---
 
## 6. Secure PowerShell Export Instructions (Operator Executed)
 
To prevent database credentials from being captured in `$PSReadLine` console history (`Get-History`), Task Manager process arguments, or shell logs, use the provided secure export script:
 
```powershell
# ==============================================================================
# SECURE EXPORT: DEV OR STAGING (Interactive Secure-String Prompt)
# ==============================================================================
# Operator executes script directly; enters password via masked prompt:
powershell -File scripts/backup/export_source_snapshot.ps1 -Environment dev -OutputDir "backups/rehearsal"

# For staging export:
powershell -File scripts/backup/export_source_snapshot.ps1 -Environment staging -OutputDir "backups/rehearsal"
```

The script automatically:
1. Prompts for password securely without echoing or terminal history storage.
2. Exports `--section=pre-data` into `${Environment}_pre_data.sql`.
3. Exports `--section=data` into `${Environment}_data.sql`.
4. Exports `--section=post-data` into `${Environment}_post_data.sql`.
5. Exports complete schema fallback into `${Environment}_schema.sql`.
6. Queries table row counts from the same session and generates `${Environment}_manifest.tsv`.
7. Computes cryptographic hashes into `${Environment}_checksums.sha256`.
8. Purges all credentials from memory and process environment immediately.

```powershell
# Test decryption to verify passphrase validity
gpg --decrypt kebun_melon_dev_data.sql.gpg | Out-File -FilePath "verify_dev.tmp"
$hash1 = (Get-FileHash -Algorithm SHA256 "verify_dev.tmp").Hash
$hash2 = (Get-FileHash -Algorithm SHA256 "kebun_melon_dev_data.sql").Hash
Remove-Item "verify_dev.tmp"

if ($hash1 -eq $hash2) {
    Write-Host "Backup encryption verified." -ForegroundColor Green
} else {
    Write-Error "Backup encryption verification FAILED!"
}
```

---

## 7. Sequential Cutover & Restoration Protocol (Free Plan)

Because of the 2-active-project limit, execution proceeds sequentially:

### Step 1: Development Migration Window
1. Verify Dev writer freeze (no local gateway or dev web servers running).
2. Take secure export of Mumbai Dev (`kebun_melon_dev_schema.sql`, `kebun_melon_dev_data.sql.gpg`).
3. In Supabase Dashboard: Navigate to `xjsencdgfcbkzdzqcnqx` $\rightarrow$ **Settings** $\rightarrow$ **General** $\rightarrow$ **Pause project** (Frees 1 project slot; active project count = 1).
4. Create Singapore Dev Project (`ap-southeast-1`): Record `[NEW_DEV_REF]` and retrieve Session connection string (port 5432).
5. Restore Schema & Data to Singapore Dev:
   ```powershell
   $secPass = Read-Host -Prompt "Enter Singapore Dev Database Password" -AsSecureString
   $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPass)
   $env:PGPASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
   [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
   $secPass = $null

   psql -h "[NEW_DEV_SESSION_HOST]" -p 5432 -U "postgres.[NEW_DEV_REF]" -d "postgres" -v ON_ERROR_STOP=1 -f "kebun_melon_dev_schema.sql"
   psql -h "[NEW_DEV_SESSION_HOST]" -p 5432 -U "postgres.[NEW_DEV_REF]" -d "postgres" -v ON_ERROR_STOP=1 -c "SET session_replication_role = replica;" -f "kebun_melon_dev_data.sql"
   psql -h "[NEW_DEV_SESSION_HOST]" -p 5432 -U "postgres.[NEW_DEV_REF]" -d "postgres" -v ON_ERROR_STOP=1 -f "post_restore_security.sql"

   $env:PGPASSWORD = $null
   ```
6. Verify Dev data parity and update `.env`.

### Step 2: Staging Migration Window
1. Execute Faucet Shutdown Protocol (§4.3) and stop `kebun-melon-staging-gateway` and `kebun-melon-staging-web`.
2. Take secure export of Mumbai Staging (`kebun_melon_staging_schema.sql`, `kebun_melon_staging_data.sql.gpg`).
3. In Supabase Dashboard: Navigate to `scqrbtfilmttqrutynyo` $\rightarrow$ **Settings** $\rightarrow$ **General** $\rightarrow$ **Pause project** (Frees 1 project slot; active project count = 1).
4. Create Singapore Staging Project (`ap-southeast-1`): Record `[NEW_STAGING_REF]` and retrieve Session connection string (port 5432).
5. Restore Schema, Data, and Security to Singapore Staging:
   ```powershell
   $secPass = Read-Host -Prompt "Enter Singapore Staging Database Password" -AsSecureString
   $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPass)
   $env:PGPASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
   [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
   $secPass = $null

   psql -h "[NEW_STAGING_SESSION_HOST]" -p 5432 -U "postgres.[NEW_STAGING_REF]" -d "postgres" -v ON_ERROR_STOP=1 -f "kebun_melon_staging_schema.sql"
   psql -h "[NEW_STAGING_SESSION_HOST]" -p 5432 -U "postgres.[NEW_STAGING_REF]" -d "postgres" -v ON_ERROR_STOP=1 -c "SET session_replication_role = replica;" -f "kebun_melon_staging_data.sql"
   psql -h "[NEW_STAGING_SESSION_HOST]" -p 5432 -U "postgres.[NEW_STAGING_REF]" -d "postgres" -v ON_ERROR_STOP=1 -f "post_restore_security.sql"

   $env:PGPASSWORD = $null
   ```
6. **Reconcile Staging Migration 11:**
   - Migration `20260905040000_add_auth_and_fk_performance_indexes` adds 13 performance indexes across `sessions`, `user_roles`, `role_permissions`, `account_approvals`, `user_device_access`, `user_preferences`, `alert_acknowledgements`, and `alerts`.
   - Run Prisma migration deployment:
     ```powershell
     $env:DATABASE_URL = "postgresql://postgres.[NEW_STAGING_REF]:[PASSWORD]@[NEW_STAGING_SESSION_HOST]:5432/postgres"
     npm run db:migrate:deploy
     $env:DATABASE_URL = $null
     ```
   - Verify `_prisma_migrations` count = **11**.
7. Update `.env.staging` with new Singapore connection strings.
8. Rebuild and redeploy staging containers:
   ```powershell
   docker compose -f docker-compose.staging.yml build --no-cache
   docker compose -f docker-compose.staging.yml up -d
   ```
9. Verify all 5 post-migration quality gates (§8).

---

## 8. Post-Migration Verification Gates

1. **Gate 1 (Schema & Row Parity):** Verify row counts on Singapore match the consistent snapshot manifest (`${Environment}_manifest.tsv`) 100%. Verify both Dev and Staging report 11 migrations, 26 tables with RLS enabled, and 0 orphaned foreign keys.
2. **Gate 2 (Service Health Probes):** Verify `http://localhost:3000/health` (HTTP 200), `http://localhost:3000/ready` (HTTP 200), `http://localhost:3001/health` (HTTP 200), `http://localhost:3001/ready` (HTTP 200).
3. **Gate 3 (Auth & RBAC):** Verify user login via `/api/v1/auth/login`, active session recognition, and audit log generation.
4. **Gate 4 (Telemetry Ingestion):** Verify `POST /api/v1/telemetry/soil` persists to `soil_readings` and MQTT telemetry persists to `reservoir_water_readings`.
5. **Gate 5 (Real-Time SSE Stream):** Verify `/api/v1/realtime/stream` establishes clean connection with periodic heartbeat.

---

## 9. Quota-Aware Rollback Protocol (Free Plan)

Because of the 2-active-project limit, rollback requires releasing an active slot before restoring Mumbai availability. **Unpausing a Supabase project spins up compute and takes several minutes; instant recovery cannot be promised.**

### 9.1 Procedure A: Rollback BEFORE Writes Resume (Pre-Cutover Failure)
*Condition:* Migration fails during restore, security script application, or initial health checks before traffic/writers are unfrozen.
- **Data Loss:** **ZERO.** Mumbai was frozen and unmutated.
- **Execution Steps:**
  1. Stop local/staging client processes.
  2. In Supabase Dashboard: Navigate to the failed Singapore project $\rightarrow$ **Settings** $\rightarrow$ **General** $\rightarrow$ **Pause project** (Releases active project slot).
  3. In Supabase Dashboard: Navigate to the paused Mumbai project $\rightarrow$ **Settings** $\rightarrow$ **General** $\rightarrow$ **Unpause project** (Takes 2–5 minutes to spin up).
  4. Verify Mumbai database returns to `ACTIVE` status.
  5. Revert `.env` and `.env.staging` back to Mumbai project refs.
  6. Rebuild and restart services: `docker compose -f docker-compose.staging.yml up -d`.
  7. Confirm `/ready` probes return HTTP 200 pointing to Mumbai.

### 9.2 Procedure B: Rollback AFTER Writes Resume (Post-Cutover Failure)
*Condition:* Operational anomaly or latent corruption detected after Singapore accepted post-cutover writes (new logins, audit logs, or telemetry).
- **Delta Replay Reality:** Generic `COPY` delta replay is **NOT** an executable automated rollback solution. Naive `COPY` cannot account for:
  - In-place row updates (e.g. `users.lastLoginAt`, session status updates).
  - Row deletions.
  - Relational foreign key dependency ordering across 26 tables.
  - Primary key and unique constraint collision handling.
- **Fix-Forward Priority:** Because bidirectional delta synchronization cannot be safely automated, the primary operational directive following post-cutover write acceptance is to **Fix-Forward in Singapore**.
- **Emergency Rollback Procedure (If Mandatory):**
  1. Freeze writers on Singapore immediately (stop IoT gateway and web containers).
  2. **Preserve Singapore Snapshot:** Take an independent, encrypted point-in-time backup of the Singapore database (`pg_dump` + GPG) for offline forensic analysis and manual data recovery.
  3. **Obtain Written Owner Sign-off:** The project Owner must formally approve the rollback and acknowledge **accepted data loss** for transactions that occurred on Singapore after the cutover point.
  4. In Supabase Dashboard: **Pause Singapore Project** (Releases active project slot).
  5. In Supabase Dashboard: **Unpause Mumbai Project** (Wait 2–5 minutes for compute spin-up).
  6. Revert configuration back to Mumbai project refs and redeploy services.
  7. Confirm health probes return HTTP 200 on Mumbai.

---

## 10. Proposed 72-Hour Soak Period & Mumbai Deletion Gate

1. **Soak Proposal:** A 72-hour soak period is proposed. During this period, Mumbai projects remain in a **paused** state (occupying 0 active project slots) to serve as a zero-cost safety fallback.
2. **Mandatory Deletion Gates:** Mumbai projects (`xjsencdgfcbkzdzqcnqx`, `scqrbtfilmttqrutynyo`) shall **NOT** be deleted until:
   - Singapore operates cleanly for the agreed soak duration with zero database errors.
   - An independent, encrypted recovery backup of Singapore is verified in cold storage.
   - The project Owner signs off in writing.
3. **Deletion Action:** Once approved, delete Mumbai projects via Supabase Dashboard Settings and archive documentation references.
