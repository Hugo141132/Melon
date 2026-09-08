# Supabase Migration Runbook: Mumbai (`ap-south-1`) to Singapore (`ap-southeast-1`)

> **Task Reference:** `TASK-0916`  
> **Status:** IN PROGRESS / DEV CUTOVER VERIFIED (Dev Cutover Completed & Verified in Singapore; Staging Migration Pending Maintenance Window)  
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

### 3.3 Cloud Platform Object & Event Trigger Compatibility Exception
1. **Internal Platform Event Triggers (`ensure_rls`):**
   - In Supabase-managed PostgreSQL instances (including Singapore Dev `unbyxlkrzqlafolxcypi`), Supabase provisions platform-owned event triggers by default. Specifically, event trigger `ensure_rls` (owned by `postgres`, event `ddl_command_end`, tags `CREATE TABLE`, `CREATE TABLE AS`, `SELECT INTO`) automatically invokes `public.rls_auto_enable()` to enforce RLS on newly created public tables.
2. **Conflict with `--clean` DDL Dumps:**
   - Standard `pg_dump --clean` dumps include `DROP FUNCTION IF EXISTS public.rls_auto_enable();` followed by `CREATE FUNCTION public.rls_auto_enable() ...`.
   - Executing `DROP FUNCTION public.rls_auto_enable()` fails immediately with PostgreSQL error `2BP01: cannot drop function public.rls_auto_enable() because other objects depend on it (event trigger ensure_rls depends on function public.rls_auto_enable())`.
3. **Mandatory Sanitization Policy & Safety Invariance:**
   - The restore pipeline in `scripts/cutover/restore_singapore_dev.ps1` implements a fail-closed parser that automatically filters out:
     - `DROP FUNCTION public.rls_auto_enable()`
     - Multiline `CREATE FUNCTION public.rls_auto_enable()` body down to its terminating `$$;`
     - Any associated `ALTER`, `COMMENT`, `GRANT`, or `REVOKE` statements targeting `public.rls_auto_enable`
     - Platform-level public schema modifications (`DROP SCHEMA IF EXISTS public;`, `CREATE SCHEMA public;`, `COMMENT ON SCHEMA public`).
   - The platform trigger `ensure_rls` and function `public.rls_auto_enable()` on the target database remain completely preserved and untouched (no `CASCADE`, no `CREATE OR REPLACE`, no trigger disabling/dropping).
   - Application tables, foreign keys, and custom enums are completely preserved, and `--single-transaction` with `ON_ERROR_STOP=1` guarantees 100% atomic rollback on any failure.

### 3.4 UTF-8 Encoding & Direct Multi-File Transport Policy
1. **UTF-8 Byte Order Mark (BOM) Elimination:**
   - In Windows PowerShell environments, default file-writing cmdlets (`Out-File -Encoding utf8`, `Set-Content`) emit a 3-byte UTF-8 Byte Order Mark (`0xEF, 0xBB, 0xBF`).
   - Standard PostgreSQL clients (`psql`) running in default client encodings read these bytes prior to the initial comment on line 1 as literal character tokens `∩╗┐` (CP437 interpretation of the UTF-8 BOM), resulting in immediate fatal syntax errors (`ERROR: syntax error at or near "∩╗┐"`).
   - Temporary SQL files must be generated strictly as UTF-8 without BOM using `.NET` `New-Object System.Text.UTF8Encoding($false)`. Leading BOMs from decrypted archives are stripped via raw binary buffer copy (`Remove-LeadingBom`) without string re-encoding or arbitrary character stripping, preserving exact bit-for-bit application data and non-ASCII characters (e.g. Indonesian diacritics, accented letters, emoji, and mathematical symbols).
2. **Multi-File Transport & Client Encoding:**
   - Rather than shell piping or stream concatenation, temporary files (`clean_pre_data.tmp.sql`, `dev_data.tmp.sql`, `clean_post_data.tmp.sql`) are mounted directly into an isolated PostgreSQL 17 Docker container and passed to a single `psql` invocation using repeated `-f` arguments:
     `-v ON_ERROR_STOP=1 --single-transaction --quiet -f /backup/clean_pre_data.tmp.sql -f /backup/dev_data.tmp.sql -f /backup/clean_post_data.tmp.sql`
   - Explicit client encoding `PGCLIENTENCODING=UTF8` and PowerShell process encoding `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` are enforced across all operations, completely eliminating implicit OEM/ANSI conversions.

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
2. Take secure export of Mumbai Dev: snapshot saved in `backups/cutover/dev_20260908_025808/` with matching SHA-256 checksums and GPG-encrypted data payload.
3. In Supabase Dashboard: Navigate to `xjsencdgfcbkzdzqcnqx` $\rightarrow$ **Settings** $\rightarrow$ **General** $\rightarrow$ **Pause project** (Frees 1 project slot; active project count = 1).
4. Create Singapore Dev Project (`ap-southeast-1`): Recorded reference `unbyxlkrzqlafolxcypi` and Session connection string (`aws-0-ap-southeast-1.pooler.supabase.com:5432`).
5. Restore & Verify Singapore Dev using Target-Locked Script:
   - The operator executes the target-locked, single-transaction atomic restoration script:
     ```powershell
     powershell -File scripts/cutover/restore_singapore_dev.ps1
     ```
   - **Automated Workflow:**
     - Pre-validates cryptographic SHA-256 checksums of all dump artifacts.
     - Acquires database credentials and executes a **fail-closed preflight check** (`SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name != '_prisma_migrations';`) ensuring target is clean before asking for GPG passphrase, decrypting data, or executing DDL.
     - Decrypts `dev_data.sql.gpg` via standard input without exposing passphrase in process table.
     - Sanitizes pre-data DDL to preserve Supabase public schema ownership and exclude `rls_auto_enable()` to prevent conflict with active `ensure_rls` event trigger (§3.3).
     - Restores pre-data, table data, and post-data atomically (`--single-transaction`, `-v ON_ERROR_STOP=1`) through containerized PostgreSQL 17 client.
     - Validates baseline: 26 public tables, 11 Prisma migrations, 28 foreign key constraints (0 orphans), and 100% row-count parity against `dev_manifest.tsv`.
     - Deterministically removes temporary plaintext files in a `finally` block and purges process credentials.
   - **Dedicated Read-Only Verification Entry Point:**
     - If restoration has already committed and only baseline verification needs to be run (without decrypting backups or executing DDL), execute the dedicated, strictly read-only verification script:
       ```powershell
       powershell -File scripts/cutover/verify_singapore_dev.ps1
       ```
       *(or `powershell -File scripts/cutover/restore_singapore_dev.ps1 -VerifyOnly`)*.
6. **Verified Dev Baseline Evidence (`unbyxlkrzqlafolxcypi`):**
   - **Status:** `Dev baseline restored and verified; application cutover pending.`
   - **Restore Fidelity vs Application Migration Readiness:**
   - **Restore Fidelity (Snapshot Parity):** 100% exact parity against Mumbai Dev cutover snapshot (`backups/cutover/dev_20260908_025808/`).
     - Public Tables: 26 (100% row-count parity against `dev_manifest.tsv`, zero missing tables).
     - Foreign Key Constraints: 28 valid constraints, 0 orphaned rows detected across all relations.
     - Database History Records: 11 rows in `_prisma_migrations` restored identically from snapshot.
     - Platform Triggers & Functions: `ensure_rls` event trigger active, `rls_auto_enable()` intact.
     - Plaintext Cleanup: Verified 0 plaintext dump files remain on disk.
     - **Prisma Migration History Reconciliation:**
        - Total rows in `_prisma_migrations`: **11 rows** (Pre-deploy baseline).
        - Distinct applied migrations: **9 successful migrations** (`finished_at IS NOT NULL AND rolled_back_at IS NULL`), verified bit-for-bit against repository SHA-256 checksums (`0_init`, `20260730140756`, `20260731001600`, `20260731170000`, `20260802170000`, `20260817000000`, `20260817082153`, `20260819000000`, `20260829170000`).
        - Historical rolled-back records: **2 attempts** (`20260817082153_add_email_verification_tokens` and `20260819000000_task_0802_faucet_command_action`), both having corresponding successful replacement applied records in the database.
        - Unresolved failed migrations: **0 records** (`finished_at IS NULL AND rolled_back_at IS NULL`).
        - Unapplied repository migrations: **2 pending migrations** (`20260820000000_add_session_user_active_index` and `20260905040000_add_auth_and_fk_performance_indexes`).
        - Physical Performance Indexes & Pre-Deploy Reconciliation:
          - All **13 performance indexes** declared in the pending migrations (`sessions_user_active_idx`, `sessions_user_id_idx`, `user_roles_user_id_idx`, `user_roles_user_id_revoked_at_idx`, `user_roles_role_id_idx`, `role_permissions_permission_id_idx`, `account_approvals_decided_by_user_id_idx`, `user_device_access_device_id_idx`, `user_device_access_assigned_by_user_id_idx`, `user_preferences_default_device_id_idx`, `alert_acknowledgements_user_id_idx`, `alert_acknowledgements_alert_id_idx`, `alerts_device_id_idx`) were restored physically from the Mumbai snapshot.
          - Migration `20260820000000` executes `CREATE INDEX "sessions_user_active_idx"` without `IF NOT EXISTS`. Running raw `prisma migrate deploy` directly against Singapore Dev would fail with PostgreSQL error `42P07: relation "sessions_user_active_idx" already exists`.
          - Modifying `20260820000000/migration.sql` in git is prohibited because it was applied on Staging (`scqrbtfilmttqrutynyo`) on 2026-09-03 with checksum `aae0ceb0a605ae1061e837a6a79a0001976eb60e352e9592390600c49c9636fe`.
          - **Reconciling `prisma migrate status` vs Physical Schema Drift:**
            - Running `npx prisma migrate status` reports `"Database schema is up to date!"` alongside listing the two unapplied migrations. This message indicates *only* that the Prisma schema file (`schema.prisma`) has no diffs against the local migrations directory (`packages/database/prisma/migrations/`). It does **not** indicate zero schema drift against the physical database, nor does it guarantee physical schema equivalence.
            - Conversely, `_prisma_migrations` rows verify migration application history, but do not prove physical index validity or readiness. Physical schema verification requires querying PostgreSQL system catalogs (`pg_index`, `pg_class`, `pg_am`, `pg_get_indexdef`) for `indisvalid = true` and `indisready = true`. A `pg_indexes` name count alone is insufficient.
          - **Execution Timing & Bounded Lock Control:**
            - Speculative or unsupported execution time claims (e.g. "<1 ms") are excluded from operational procedures. Actual DDL lock acquisition and execution times are workload-dependent.
            - Instead, safety is enforced deterministically by applying a bounded lock timeout (`SET lock_timeout = '5s';`) without `CASCADE` while application writers remain strictly stopped.
          - **Deployment Wrapper Architecture (`scripts/cutover/deploy_singapore_dev_migrations.ps1`):**
            1. **Pre-Deploy History & Schema Assessment:** Checks `_prisma_migrations` for unresolved failures (aborts if count > 0). If both migrations (`20260820000000`, `20260905040000`) are already applied, verifies physical schema matches history (`indisvalid=true, indisready=true` on all 13 indexes) and runs verification only without dropping objects. If history and physical schema disagree, halts immediately with a specific diagnosis rather than modifying history or deleting objects.
            2. **Targeted Conditional Drop:** Drops `sessions_user_active_idx` *only* when migration `20260820000000` is genuinely pending, 0 unresolved failures exist, and the existing index definition matches the approved definition (`btree` on `sessions(user_id, revoked_at, expires_at)`, non-unique, valid, ready). Never drops when `20260820000000` is already applied.
            3. **Separate Bounded Lock Execution:** Executes `SET lock_timeout = '5s'; DROP INDEX public.sessions_user_active_idx;` as an independent operation prior to Prisma invocation.
            4. **Diagnostic Deploy Failure Handling:** Executes `npx prisma migrate deploy`. If deployment fails after drop, inspects post-failure migration state (`failed_migrations`, `applied_migrations`) and index existence, keeps application writers stopped, performs zero blind retries, and outputs structured recovery action guidance.
            5. **Post-Deploy Validation:** Validates 13 total migration records, 11 applied migrations, 2 preserved historical rollbacks, 0 unresolved failures, all 13 individual performance indexes verified for definition match, `indisvalid=true`, and `indisready=true`, bit-for-bit checksum parity across all 11 applied migrations against local files, and 100% unchanged application table row counts vs `dev_manifest.tsv`.
7. **Execute Singapore Dev Migration Deployment (COMPLETED 2026-09-08):**
   - The operator executed the target-locked deploy wrapper:
     ```powershell
     powershell -File scripts/cutover/deploy_singapore_dev_migrations.ps1
     ```
   - **Deployment Result:** Exit Code `0`. Successfully deployed migrations `20260820000000_add_session_user_active_index` and `20260905040000_add_auth_and_fk_performance_indexes`.
   - **Post-Deploy Verification & Manifest Baseline Comparison:**
     - **Original Cutover Manifest Baseline (`backups/cutover/dev_20260908_025808/dev_manifest.tsv`):** Recorded exactly **11** migration history records in `_prisma_migrations` prior to deployment. The original cutover manifest path and file remain strictly preserved and immutable.
     - **Migration Deployment Output:** Applying the two pending migrations (`20260820000000` and `20260905040000`) produced exactly **13** records in `_prisma_migrations` (11 applied migrations matching local repository SHA-256 checksums bit-for-bit, 2 preserved historical rollbacks from 2026-08-20, 0 unresolved failures).
     - **Pre-Write Schema & Index Parity:** All 13 performance indexes confirmed valid (`indisvalid=true`), ready (`indisready=true`), non-unique, with exact definition string match.
     - **Pre-Write Application Table Parity:** All 25 non-migration application tables confirmed 100% row-count match vs the original cutover manifest (`backups/cutover/dev_20260908_025808/dev_manifest.tsv`) prior to resuming live application traffic.
8. **Dev Application Services & Live Cutover Validation (IN PROGRESS 2026-09-08):**
   - **RLS & Data API Assessment:** RLS is enabled on all 26 public tables with 0 policies, enforcing complete denial of PostgREST / Data API access for `anon` and `authenticated` roles (`rolbypassrls = false`). Supabase security linter flags `rls_auto_enable()` as a `SECURITY DEFINER` function with default public execution grants. System catalog inspection (`pg_proc`) confirms `public.rls_auto_enable()` returns `event_trigger` for DDL trigger automation and cannot be executed as a standard RPC outside DDL trigger context. Per governance policy, zero silent hardening was applied.
   - **Prisma & Gateway Connectivity:** Web (`http://localhost:3000`) and IoT Gateway (`http://localhost:3001`) connected to Singapore Dev (`unbyxlkrzqlafolxcypi`) pooler (port 6543, `?pgbouncer=true`).
   - **Service Health Probes & Token Rotation:**
     - Web `/health`: HTTP 200 (`{ "status": "ok" }`).
     - Web `/ready`: HTTP 200 (`{ "status": "ready", "dependencies": { "database": "up", "gateway": "up", "broker": "up" } }`).
     - Gateway `/health`: HTTP 200 (`{ "status": "pass", "service": "iot-gateway" }`).
     - Gateway `/internal/v1/ready`: HTTP 200 (`{ "status": "ready", "dependencies": { "database": "up", "broker": "up" } }`).
     - **Internal Service Token Rotation (COMPLETED 2026-09-08):** Operator executed `rotate_dev_internal_token.js` generating a 32-byte hex CSPRNG token across `.env`, `apps/web/.env`, and `apps/iot-gateway/.env` (pre-validated, zero credentials printed). Dev services restarted and validated via `verify_token_rotation.js`: Gateway `/internal/v1/ready` confirmed rejecting missing and stale tokens (HTTP 401) and accepting the new rotated token (HTTP 200), and Web `/ready` confirmed returning HTTP 200 with gateway status `up`. Staging was preserved untouched.
   - **Expected Post-Cutover Data Mutations (Recorded Separately from Baseline):**
     - **Session State:** Exactly 1 active session in `public.sessions` (`de8a9c04-5829-44bb-875a-eca4edbf5a88` for Owner `hugo@resend.dev`, created at `2026-09-08 02:37:28.567 UTC`); previous test session revoked (`revoked_at = 2026-09-08 02:14:00 UTC`). Single active session invariant (`DEC-AUTH-107`) confirmed active.
     - **Telemetry Persistence:** `soil_readings` count changed from 0 (manifest baseline) $\rightarrow$ 3 (post-cutover).
       - First Write: `POST /api/v1/devices/soil-node-jvbkdbv/telemetry/soil` (Message ID: `cutover-synthetic-telemetry-20260908-01`, Reading ID: `902f6f4e-fcad-4bba-9f05-d56eafb62a5c`, timestamp: `2026-09-08 01:48:09.319 UTC`).
       - Second Write: `POST /api/v1/devices/soil-node-jvbkdbv/telemetry/soil` (Message ID: `cutover-sse-telemetry-20260908-02`, Reading ID: `681f5441-47a7-4825-9b6b-35223f63ee26`, timestamp: `2026-09-08 02:38:09.070 UTC`).
       - Third Write: `POST /api/v1/devices/soil-node-jvbkdbv/telemetry/soil` (Message ID: `cutover-sse-subscriber-20260908-03`, Reading ID: `04bafee1-4ea7-4999-a223-2d497cbeafbc`, timestamp: `2026-09-08 03:10:02.111 UTC`).
       - Sensor values persisted: Nitrogen 16.0, Phosphorus 10.2, Potassium 19.1, Temp 26.8°C, Moisture 69.5%, pH 6.7, EC 1.6, Status NORMAL.
     - **Device Metadata:** `soil-node-jvbkdbv` updated atomically (`last_seen_at` and `last_message_at` refreshed to ingestion timestamp).
     - **Migration History:** Exactly 13 rows in `_prisma_migrations` (11 applied + 2 historical rollbacks).
     - **Command Isolation:** `public.faucet_commands` remains strictly **0** (`ENABLE_FAUCET_CONTROL=false` strictly maintained across all services).
   - **Real-Time Telemetry-Event SSE Delivery Status:**
     - Webhook Dispatch (VERIFIED): Event dispatched to Realtime Event Hub via internal webhook `POST /api/v1/internal/realtime/publish` using rotated `INTERNAL_SERVICE_TOKEN` (HTTP 200).
     - SSE Transport & Heartbeat (VERIFIED): `GET /api/v1/realtime/stream` establishes connection, emits `event: connected`, and delivers periodic `event: ping` heartbeats under authenticated session (`test_sse_stream.ts`).
     - Subscriber Receipt of Telemetry Chunk (VERIFIED): Uniquely identified payload `cutover-sse-subscriber-20260908-03` received on authorized browser EventSource subscriber client as `event: telemetry.soil.updated` matching payload and Singapore Dev DB record (`04bafee1-4ea7-4999-a223-2d497cbeafbc`), test stream closed cleanly.
   - **MUMBAI DEV STALENESS NOTICE:** Because live writes have resumed in Singapore Dev, the paused Mumbai Dev database (`xjsencdgfcbkzdzqcnqx`) is now **STALE**. A simple connection-string rollback to Mumbai is unsupported and prohibited (§9.2).

### Step 2: Staging Migration Window
1. Enforce Faucet Shutdown Protocol (§4.3) and ensure staging application services remain stopped. (Docker inspection confirms `kebun-melon-staging-web` and `kebun-melon-staging-gateway` have been in `exited` status since 2026-09-05; the cloud Supabase Staging project `scqrbtfilmttqrutynyo` remains active on Mumbai).
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

1. **Gate 1 (Schema & Row Parity):** Verify row counts on Singapore match the consistent snapshot manifest (`${Environment}_manifest.tsv`) 100%. Verify Singapore target reports 26 tables with RLS enabled, 28 foreign keys with 0 orphaned rows, 13 performance indexes, and reconciled Prisma migration history (0 unresolved failures, all rolled-back attempts resolved, and baseline applied migrations verified).
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
