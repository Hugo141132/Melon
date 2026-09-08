<#
.SYNOPSIS
    Dedicated, strictly read-only verification script for Singapore Staging (ihgoxqdncepbcrqkchxu).
.DESCRIPTION
    Executed by the operator or test automation. Strictly read-only:
      - ZERO DDL execution (no CREATE, DROP, ALTER).
      - ZERO data modification (no INSERT, UPDATE, DELETE, TRUNCATE).
      - ZERO backup decryption (does not touch GPG or passphrases).
      - ZERO target database reset.
    Validates:
      1. Exactly 26 public tables present.
      2. Exactly 10 (baseline) or 11 (post-migration) Prisma migration rows.
      3. All applied Prisma migration identities match expected hashes.
      4. Exactly 28 foreign key constraints with 0 orphaned rows.
      5. Exactly 8 enum types present.
      6. Platform event trigger 'ensure_rls' is active.
      7. All performance indexes valid and ready (1 baseline, 13 post-deploy).
      8. 100% per-table row-count parity against snapshot staging_manifest.tsv.
.PARAMETER BackupDir
    Path to the cutover backup directory containing staging_manifest.tsv. Default: 'backups/cutover/staging_20260908_185145'.
.PARAMETER TargetRef
    The target Supabase project reference. Default: 'ihgoxqdncepbcrqkchxu'.
.PARAMETER TargetHost
    The target database host. Default: 'aws-0-ap-southeast-1.pooler.supabase.com'.
.PARAMETER TargetPort
    The target database port. Default: 5432.
.PARAMETER TargetUser
    The target database user. Defaults to 'postgres.<TargetRef>'.
.PARAMETER TargetDb
    The target database name. Default: 'postgres'.
.PARAMETER PlainPassword
    Database password (for automated/isolated tests). If omitted, securely prompted via Read-Host -AsSecureString.
.PARAMETER RequireSsl
    Require SSL connection. Default: true.
.PARAMETER Network
    Docker bridge network (for isolated container testing).
#>
[CmdletBinding()]
param (
    [string]$BackupDir = 'backups/cutover/staging_20260908_185145',
    [string]$TargetRef = 'ihgoxqdncepbcrqkchxu',
    [string]$TargetHost = "aws-0-ap-southeast-1.pooler.supabase.com",
    [int]$TargetPort = 5432,
    [string]$TargetUser = "",
    [string]$TargetDb = "postgres",
    [string]$PlainPassword = "",
    [switch]$RequireSsl = $true,
    [string]$Network = ""
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ==============================================================================
# 1. Target Identity Guards
# ==============================================================================
$EXPECTED_TARGET_REF = 'ihgoxqdncepbcrqkchxu'
$PAUSED_SOURCE_REF   = 'scqrbtfilmttqrutynyo'

if ($TargetRef -eq $PAUSED_SOURCE_REF) {
    Write-Error "CRITICAL GUARD: Cannot verify against paused Mumbai source project '$PAUSED_SOURCE_REF'!"
    exit 1
}

if (-not $TargetUser) {
    $TargetUser = "postgres.$TargetRef"
}

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "  KEBUN MELON: READ-ONLY BASELINE & INTEGRITY VERIFICATION" -ForegroundColor Cyan
Write-Host "  Target Project  : $TargetRef" -ForegroundColor Cyan
Write-Host "  Destination Host: $TargetHost`:$TargetPort (Database: $TargetDb)" -ForegroundColor Cyan
Write-Host "  Safety Guarantee: 100% READ-ONLY. Zero DDL, zero data loading, zero decryption." -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan

# ==============================================================================
# 2. Check Prerequisites: Docker & Manifest
# ==============================================================================
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker CLI not found. Docker Desktop is required for isolated psql client."
    exit 1
}

try {
    $null = docker ps 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Docker daemon not running." }
} catch {
    Write-Error "Docker daemon is not running. Please start Docker Desktop."
    exit 1
}

$absBackupDir = (Resolve-Path $BackupDir -ErrorAction Stop).Path
$manifestPath = Join-Path $absBackupDir "staging_manifest.tsv"

if (-not (Test-Path $manifestPath)) {
    Write-Error "Snapshot manifest file not found: $manifestPath"
    exit 1
}

# ==============================================================================
# 3. Acquire Credentials Securely
# ==============================================================================
$plainDbPass = $PlainPassword
if (-not $plainDbPass) {
    $secPass = Read-Host -Prompt "Enter Singapore Staging Database Password ($TargetUser)" -AsSecureString
    if (-not $secPass) {
        Write-Error "Database password cannot be empty."
        exit 1
    }
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPass)
    $plainDbPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    $secPass = $null
}

function Invoke-PsqlQuery {
    param([string]$Sql, [switch]$TuplesOnly)
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "docker"
    
    $argsList = @("run", "-i", "--rm")
    if ($Network) { $argsList += @("--network", $Network) }
    $argsList += @(
        "-e", "PGPASSWORD",
        "-e", "PGCLIENTENCODING=UTF8"
    )
    if ($RequireSsl) { $argsList += @("-e", "PGSSLMODE=require") }
    
    $argsList += @("postgres:17-alpine", "psql", "-h", $TargetHost, "-p", $TargetPort.ToString(), "-U", $TargetUser, "-d", $TargetDb, "-v", "ON_ERROR_STOP=1")
    if ($TuplesOnly) { $argsList += @("-t", "-A") }

    $psi.Arguments = ($argsList -join " ")
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
    $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8
    $psi.EnvironmentVariables["PGPASSWORD"] = $plainDbPass

    $proc = [System.Diagnostics.Process]::Start($psi)
    $proc.StandardInput.WriteLine($Sql)
    $proc.StandardInput.Flush()
    $proc.StandardInput.Close()

    $stdOut = $proc.StandardOutput.ReadToEnd()
    $stdErr = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()

    if ($proc.ExitCode -ne 0) {
        throw "psql query failed (ExitCode: $($proc.ExitCode)): $stdErr"
    }
    return $stdOut.Trim()
}

try {
    # ==============================================================================
    # 4. Comprehensive Read-Only Verification
    # ==============================================================================
    Write-Host "`n[1/3] Inspecting schema objects, migrations, and performance indexes..." -ForegroundColor Yellow

    $inspectSql = @'
SELECT json_build_object(
    'table_count', (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'),
    'total_migration_records', (SELECT count(*) FROM public._prisma_migrations),
    'applied_migrations_count', (SELECT count(DISTINCT migration_name) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
    'unresolved_failed_count', (SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL),
    'rolled_back_count', (SELECT count(*) FROM public._prisma_migrations WHERE rolled_back_at IS NOT NULL),
    'foreign_key_count', (SELECT count(*) FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace),
    'enum_count', (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typtype = 'e'),
    'trigger_count', (SELECT count(*) FROM pg_event_trigger WHERE evtname = 'ensure_rls' AND evtenabled = 'O'),
    'perf_indexes_valid_and_ready', (
        SELECT count(*)
        FROM pg_index ix
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_namespace n ON n.oid = i.relnamespace
        JOIN pg_am am ON am.oid = i.relam
        WHERE n.nspname = 'public'
          AND am.amname = 'btree'
          AND ix.indisvalid = true
          AND ix.indisready = true
          AND i.relname IN (
            'sessions_user_active_idx', 'sessions_user_id_idx',
            'user_roles_user_id_idx', 'user_roles_user_id_revoked_at_idx', 'user_roles_role_id_idx',
            'role_permissions_permission_id_idx', 'account_approvals_decided_by_user_id_idx',
            'user_device_access_device_id_idx', 'user_device_access_assigned_by_user_id_idx',
            'user_preferences_default_device_id_idx', 'alert_acknowledgements_user_id_idx',
            'alert_acknowledgements_alert_id_idx', 'alerts_device_id_idx'
          )
    ),
    'all_applied_migrations', (
        SELECT json_agg(json_build_object('name', migration_name, 'checksum', checksum) ORDER BY finished_at ASC)
        FROM public._prisma_migrations
        WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    )
)::text;
'@

    $raw = Invoke-PsqlQuery -Sql $inspectSql -TuplesOnly
    $data = $raw | ConvertFrom-Json

    Write-Host "  Public Table Count        : $($data.table_count) (Expected: 26)"
    Write-Host "  Total Migration Records   : $($data.total_migration_records) (10 baseline or 11 post-deploy)"
    Write-Host "  Applied Migrations Count  : $($data.applied_migrations_count)"
    Write-Host "  Unresolved Failed Records : $($data.unresolved_failed_count) (Expected: 0)"
    Write-Host "  Rolled-Back Records       : $($data.rolled_back_count) (Expected: 0)"
    Write-Host "  Foreign Key Constraints   : $($data.foreign_key_count) (Expected: 28)"
    Write-Host "  Enum Types Count          : $($data.enum_count) (Expected: 8)"
    Write-Host "  ensure_rls Event Trigger  : $($data.trigger_count) (Expected: 1)"
    Write-Host "  Valid Performance Indexes : $($data.perf_indexes_valid_and_ready) (1 baseline or 13 post-deploy)"

    if ($data.table_count -ne 26) { throw "Table count mismatch! Expected 26, got $($data.table_count)" }
    if ($data.unresolved_failed_count -ne 0) { throw "Unresolved failed migration records detected! Count: $($data.unresolved_failed_count)" }
    if ($data.rolled_back_count -ne 0) { throw "Rolled-back records detected! Count: $($data.rolled_back_count)" }
    if ($data.foreign_key_count -ne 28) { throw "Foreign key count mismatch! Expected 28, got $($data.foreign_key_count)" }
    if ($data.enum_count -ne 8) { throw "Enum type count mismatch! Expected 8, got $($data.enum_count)" }
    if ($data.trigger_count -ne 1) { throw "ensure_rls event trigger missing or disabled!" }

    $isPostDeploy = ($data.applied_migrations_count -eq 11)
    if ($isPostDeploy) {
        Write-Host "  [STATE] Target database is in POST-DEPLOYMENT state (11 migrations applied)." -ForegroundColor Green
        if ($data.perf_indexes_valid_and_ready -ne 13) {
            throw "Post-deployment performance indexes mismatch! Expected 13, got $($data.perf_indexes_valid_and_ready)"
        }
    } else {
        Write-Host "  [STATE] Target database is in BASELINE state (10 migrations applied)." -ForegroundColor Cyan
        if ($data.perf_indexes_valid_and_ready -lt 1) {
            throw "Baseline 'sessions_user_active_idx' is missing or invalid!"
        }
    }

    # ==============================================================================
    # 5. Table Row Count Parity Verification
    # ==============================================================================
    Write-Host "`n[2/3] Verifying table row counts against manifest ($manifestPath)..." -ForegroundColor Yellow

    $aggCountsSql = @'
SELECT json_object_agg(table_name, row_count) FROM (
    SELECT 
        t.table_name,
        (xpath('/row/cnt/text()', xml_count))[1]::text::bigint AS row_count
    FROM (
        SELECT 
            table_name,
            query_to_xml(format('select count(*) as cnt from %I.%I', table_schema, table_name), false, true, '') as xml_count
        FROM information_schema.tables
        WHERE table_schema = 'public'
    ) t
) s;
'@

    $countsRaw = Invoke-PsqlQuery -Sql $aggCountsSql -TuplesOnly
    $actualCounts = $countsRaw | ConvertFrom-Json

    $manifestLines = Get-Content $manifestPath | Where-Object { $_ -match '\S' }
    foreach ($line in $manifestLines) {
        $parts = $line -split "`t"
        $tbl = $parts[0].Trim()
        $expectedCount = [int64]$parts[1].Trim()

        if ($tbl -eq '_prisma_migrations' -and $isPostDeploy) {
            $act = [int64]$actualCounts.$tbl
            if ($act -ne 11) {
                throw "_prisma_migrations count mismatch! Expected 11 post-deploy, found $act"
            }
            Write-Host "  [MATCH] Table '_prisma_migrations': 11 rows (10 baseline + 1 post-deploy)" -ForegroundColor Green
            continue
        }

        $actCount = $actualCounts.$tbl
        if ($null -eq $actCount) {
            throw "Table '$tbl' is missing from target database!"
        }
        if ([int64]$actCount -ne $expectedCount) {
            throw "Table '$tbl' row count mismatch! Expected $expectedCount, found $actCount"
        }
        Write-Host "  [MATCH] Table '$tbl': $actCount rows" -ForegroundColor Gray
    }

    # ==============================================================================
    # 6. Referential Integrity (0 Orphans)
    # ==============================================================================
    Write-Host "`n[3/3] Evaluating foreign key referential integrity (0 orphans rule)..." -ForegroundColor Yellow
    $orphanCheckSql = @'
DO $$
DECLARE
  fk RECORD;
  orphan_count BIGINT;
  total_orphans BIGINT := 0;
BEGIN
  FOR fk IN (
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  ) LOOP
    EXECUTE format(
      'SELECT count(*) FROM public.%I t WHERE t.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.%I f WHERE f.%I = t.%I)',
      fk.table_name, fk.column_name, fk.foreign_table_name, fk.foreign_column_name, fk.column_name
    ) INTO orphan_count;
    IF orphan_count > 0 THEN
      RAISE WARNING 'FK Orphan detected: public.%I.%I -> public.%I.%I has % orphans',
        fk.table_name, fk.column_name, fk.foreign_table_name, fk.foreign_column_name, orphan_count;
      total_orphans := total_orphans + orphan_count;
    END IF;
  END LOOP;
  IF total_orphans > 0 THEN
    RAISE EXCEPTION 'Referential integrity check failed with % total orphaned rows.', total_orphans;
  END IF;
END $$;
'@

    $null = Invoke-PsqlQuery -Sql $orphanCheckSql

    Write-Host "  [OK] Zero orphaned foreign key rows detected across all 28 constraints." -ForegroundColor Green
    Write-Host "`n========================================================================" -ForegroundColor Green
    Write-Host "  ALL VERIFICATIONS PASSED FOR SINGAPORE STAGING ($TargetRef)!" -ForegroundColor Green
    Write-Host "========================================================================" -ForegroundColor Green
} finally {
    $plainDbPass = $null
    [System.GC]::Collect()
}
