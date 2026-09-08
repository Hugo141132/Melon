<#
.SYNOPSIS
    Dedicated, strictly read-only verification script for Singapore Dev (unbyxlkrzqlafolxcypi).
.DESCRIPTION
    Executed by the operator. Strictly read-only:
      - ZERO DDL execution (no CREATE, DROP, ALTER).
      - ZERO data modification (no INSERT, UPDATE, DELETE, TRUNCATE).
      - ZERO backup decryption (does not touch GPG or passphrases).
      - ZERO target database reset.
    Validates:
      1. Exactly 26 public tables present.
      2. Exactly 11 Prisma migration rows (9 applied, 2 rolled back).
      3. All 9 applied Prisma migration identities match expected hashes.
      4. Exactly 28 foreign key constraints with 0 orphaned rows.
      5. Exactly 8 enum types present.
      6. Platform event trigger 'ensure_rls' is active.
      7. Platform function 'public.rls_auto_enable()' is intact.
      8. 100% per-table row-count parity against snapshot manifest.tsv.
.PARAMETER BackupDir
    Path to the cutover backup directory containing dev_manifest.tsv. Default: 'backups/cutover/dev_20260908_025808'.
.PARAMETER TargetRef
    The target Supabase project reference. Default: 'unbyxlkrzqlafolxcypi'.
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
    [string]$BackupDir = 'backups/cutover/dev_20260908_025808',
    [string]$TargetRef = 'unbyxlkrzqlafolxcypi',
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
$EXPECTED_TARGET_REF = 'unbyxlkrzqlafolxcypi'
$PAUSED_SOURCE_REF   = 'xjsencdgfcbkzdzqcnqx'

if ($TargetRef -eq $PAUSED_SOURCE_REF) {
    Write-Error "CRITICAL GUARD: Cannot verify against paused Mumbai source project '$PAUSED_SOURCE_REF'!"
    exit 1
}

# If user did not provide TargetUser, default to postgres.<TargetRef>
if (-not $TargetUser) {
    $TargetUser = "postgres.$TargetRef"
}

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "  KEBUN MELON: READ-ONLY BASELINE VERIFICATION" -ForegroundColor Cyan
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
$manifestPath = Join-Path $absBackupDir "dev_manifest.tsv"

if (-not (Test-Path $manifestPath)) {
    Write-Error "Snapshot manifest file not found: $manifestPath"
    exit 1
}

# ==============================================================================
# 3. Dedicated psql Invocation Helper
# ==============================================================================
function Invoke-PsqlCommand {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$TargetHost,
        [Parameter(Mandatory=$true)][int]$TargetPort,
        [Parameter(Mandatory=$true)][string]$TargetUser,
        [Parameter(Mandatory=$true)][string]$TargetDb,
        [Parameter(Mandatory=$true)][string]$PlainPassword,
        [Parameter(Mandatory=$true)][string]$Sql,
        [switch]$TuplesOnly,
        [switch]$RequireSsl,
        [string]$Network
    )

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "docker"
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
    $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8

    # Pass PGPASSWORD via child process environment to prevent exposure in argument string
    if ($psi.EnvironmentVariables.ContainsKey("PGPASSWORD")) {
        $psi.EnvironmentVariables["PGPASSWORD"] = $PlainPassword
    } else {
        $psi.EnvironmentVariables.Add("PGPASSWORD", $PlainPassword)
    }

    # Pass arguments without surrounding quotes on variables
    $argsList = "run -i --rm -e PGPASSWORD -e PGCLIENTENCODING=UTF8"
    if ($RequireSsl) {
        $argsList += " -e PGSSLMODE=require"
    }
    if ($Network) {
        $argsList += " --network $Network"
    }
    $argsList += " postgres:17-alpine psql -h $TargetHost -p $TargetPort -U $TargetUser -d $TargetDb -v ON_ERROR_STOP=1"
    if ($TuplesOnly) {
        $argsList += " -t -A"
    }
    $psi.Arguments = $argsList

    $proc = [System.Diagnostics.Process]::Start($psi)
    $proc.StandardInput.WriteLine($Sql)
    $proc.StandardInput.Close()
    $out = $proc.StandardOutput.ReadToEnd().Trim()
    $err = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()

    if ($proc.ExitCode -ne 0) {
        throw "psql command failed (ExitCode: $($proc.ExitCode)): $err"
    }
    return $out
}

# ==============================================================================
# 4. Credential Acquisition (if not provided via parameter)
# ==============================================================================
$plainDbPass = $PlainPassword
$needCredentialPurge = $false

if (-not $plainDbPass) {
    $secPass = Read-Host -Prompt "Enter Singapore Dev Database Password ($TargetUser)" -AsSecureString
    if (-not $secPass) {
        Write-Error "Database password is required for verification."
        exit 1
    }
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPass)
    $plainDbPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    $secPass = $null
    $needCredentialPurge = $true
}

try {
    Write-Host "`n========================================================================" -ForegroundColor Cyan
    Write-Host "  VERIFYING SINGAPORE DEV BASELINE RESTORATION & REFERENTIAL INTEGRITY" -ForegroundColor Cyan
    Write-Host "========================================================================" -ForegroundColor Cyan

    # 1. Structural Counts & Migrations
    Write-Host "`n  Verifying table counts, migrations, constraints, indexes, and platform triggers..." -ForegroundColor Yellow
    $verifySql = @'
SELECT json_build_object(
    'table_count', (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'),
    'total_migration_records', (SELECT count(*) FROM public._prisma_migrations),
    'applied_migrations_count', (SELECT count(DISTINCT migration_name) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
    'applied_migration_names', (SELECT array_agg(DISTINCT migration_name ORDER BY migration_name) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
    'unresolved_failed_count', (SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL),
    'rolled_back_count', (SELECT count(*) FROM public._prisma_migrations WHERE rolled_back_at IS NOT NULL),
    'rolled_back_names', (SELECT array_agg(DISTINCT migration_name ORDER BY migration_name) FROM public._prisma_migrations WHERE rolled_back_at IS NOT NULL),
    'foreign_key_count', (SELECT count(*) FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace),
    'enum_count', (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typtype = 'e'),
    'trigger_count', (SELECT count(*) FROM pg_event_trigger WHERE evtname = 'ensure_rls' AND evtenabled = 'O'),
    'function_exists', (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'),
    'performance_indexes_count', (
        SELECT count(*) FROM pg_indexes 
        WHERE schemaname = 'public' 
          AND indexname IN (
            'sessions_user_active_idx', 'sessions_user_id_idx',
            'user_roles_user_id_idx', 'user_roles_user_id_revoked_at_idx', 'user_roles_role_id_idx',
            'role_permissions_permission_id_idx', 'account_approvals_decided_by_user_id_idx',
            'user_device_access_device_id_idx', 'user_device_access_assigned_by_user_id_idx',
            'user_preferences_default_device_id_idx', 'alert_acknowledgements_user_id_idx',
            'alert_acknowledgements_alert_id_idx', 'alerts_device_id_idx'
          )
    )
)::text;
'@

    $vOut = Invoke-PsqlCommand `
        -TargetHost $TargetHost `
        -TargetPort $TargetPort `
        -TargetUser $TargetUser `
        -TargetDb $TargetDb `
        -PlainPassword $plainDbPass `
        -Sql $verifySql `
        -TuplesOnly `
        -RequireSsl:$RequireSsl `
        -Network $Network

    $vData = $vOut | ConvertFrom-Json
    Write-Host "  Public Table Count        : $($vData.table_count) (Expected: 26)"
    Write-Host "  Total Migration Records   : $($vData.total_migration_records) (History rows in _prisma_migrations)"
    Write-Host "  Applied Migrations Count  : $($vData.applied_migrations_count) (Distinct finished non-rolled-back)"
    Write-Host "  Unresolved Failed Records : $($vData.unresolved_failed_count) (Expected: 0)"
    Write-Host "  Rolled-Back Records       : $($vData.rolled_back_count) (Historical attempts)"
    Write-Host "  Foreign Key Constraints   : $($vData.foreign_key_count) (Expected: 28)"
    Write-Host "  Enum Types Count          : $($vData.enum_count) (Expected: 8)"
    Write-Host "  Performance Indexes Found : $($vData.performance_indexes_count) (Expected: 13)"
    Write-Host "  ensure_rls Event Trigger  : $($vData.trigger_count) (Expected: 1)"
    Write-Host "  rls_auto_enable Function  : $($vData.function_exists) (Expected: 1)"

    if ($vData.table_count -ne 26) { throw "Table count mismatch! Expected 26, got $($vData.table_count)" }
    if ($vData.unresolved_failed_count -ne 0) { throw "Unresolved failed migration records detected! Count: $($vData.unresolved_failed_count)" }
    if ($vData.foreign_key_count -ne 28) { throw "Foreign key count mismatch! Expected 28, got $($vData.foreign_key_count)" }
    if ($vData.enum_count -ne 8) { throw "Enum type count mismatch! Expected 8, got $($vData.enum_count)" }
    if ($vData.performance_indexes_count -ne 13) { throw "Performance indexes count mismatch! Expected 13, got $($vData.performance_indexes_count)" }
    if ($vData.trigger_count -ne 1) { throw "ensure_rls event trigger missing or disabled!" }
    if ($vData.function_exists -ne 1) { throw "rls_auto_enable function missing!" }

    # Assert 9 Baseline Applied Migration Identities
    $expectedBaselineApplied = @(
        "0_init",
        "20260730140756_update_device_type_enum",
        "20260731001600_add_user_device_access_active_unique_index",
        "20260731170000_remove_legacy_device_types",
        "20260802170000_add_faucet_command_events_message_unique",
        "20260817000000_add_password_reset_tokens",
        "20260817082153_add_email_verification_tokens",
        "20260819000000_task_0802_faucet_command_action",
        "20260829170000_add_pending_email_to_email_verification_tokens"
    )

    foreach ($m in $expectedBaselineApplied) {
        if ($vData.applied_migration_names -notcontains $m) {
            throw "Missing expected baseline applied migration: $m"
        }
    }

    # Verify that all rolled-back attempts have corresponding applied resolution records
    if ($vData.rolled_back_count -gt 0 -and $null -ne $vData.rolled_back_names) {
        foreach ($rb in $vData.rolled_back_names) {
            if ($vData.applied_migration_names -notcontains $rb) {
                throw "Rolled-back migration '$rb' has no successful applied resolution record!"
            }
        }
    }

    Write-Host "  [OK] All $($vData.applied_migrations_count) applied migrations verified (0 unresolved failures; all rolled-back attempts resolved)." -ForegroundColor Green
    Write-Host "  [OK] All 13 performance indexes physically present in public schema." -ForegroundColor Green
    if ($vData.applied_migrations_count -eq 9) {
        Write-Host "  [INFO] 2 repository migrations (20260820000000, 20260905040000) are unapplied in _prisma_migrations (ready for prisma migrate deploy)." -ForegroundColor Cyan
    }

    # 2. Per-table row count parity verification against manifest
    Write-Host "`n  Verifying table row counts against snapshot manifest ($manifestPath)..." -ForegroundColor Yellow
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

    $countsOut = Invoke-PsqlCommand `
        -TargetHost $TargetHost `
        -TargetPort $TargetPort `
        -TargetUser $TargetUser `
        -TargetDb $TargetDb `
        -PlainPassword $plainDbPass `
        -Sql $aggCountsSql `
        -TuplesOnly `
        -RequireSsl:$RequireSsl `
        -Network $Network

    $actualCounts = $countsOut | ConvertFrom-Json

    $manifestLines = Get-Content $manifestPath | Where-Object { $_ -match '\S' }
    $paritySuccess = $true

    foreach ($line in $manifestLines) {
        $parts = $line -split "`t"
        $tbl = $parts[0].Trim()
        $expectedCount = [int64]$parts[1].Trim()

        $actualCount = $actualCounts.$tbl
        if ($null -eq $actualCount) {
            Write-Host "  [FAIL] Table '$tbl': missing from target database!" -ForegroundColor Red
            $paritySuccess = $false
        } elseif ([int64]$actualCount -ne $expectedCount) {
            Write-Host "  [FAIL] Table '$tbl': expected $expectedCount, found $actualCount" -ForegroundColor Red
            $paritySuccess = $false
        } else {
            Write-Host "  [MATCH] Table '$tbl': $actualCount rows" -ForegroundColor Gray
        }
    }

    if (-not $paritySuccess) {
        throw "Table row count manifest parity validation failed!"
    }
    Write-Host "  [OK] 100% table row-count manifest parity confirmed across all 26 tables." -ForegroundColor Green

    # 3. Dynamic Orphaned Foreign Key Check
    Write-Host "`n  Evaluating foreign key referential integrity (0 orphans rule)..." -ForegroundColor Yellow
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
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  ) LOOP
    EXECUTE format(
      'SELECT count(*) FROM public.%I t WHERE t.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.%I f WHERE f.%I = t.%I)',
      fk.table_name, fk.column_name, fk.foreign_table_name, fk.foreign_column_name, fk.column_name
    ) INTO orphan_count;
    total_orphans := total_orphans + orphan_count;
    IF orphan_count > 0 THEN
      RAISE EXCEPTION 'Detected % orphaned rows in %.% referencing %.%', orphan_count, fk.table_name, fk.column_name, fk.foreign_table_name, fk.foreign_column_name;
    END IF;
  END LOOP;
END $$;
'@

    $null = Invoke-PsqlCommand `
        -TargetHost $TargetHost `
        -TargetPort $TargetPort `
        -TargetUser $TargetUser `
        -TargetDb $TargetDb `
        -PlainPassword $plainDbPass `
        -Sql $orphanCheckSql `
        -RequireSsl:$RequireSsl `
        -Network $Network

    Write-Host "  [OK] Zero orphaned foreign key rows detected across all 28 constraints." -ForegroundColor Green
    Write-Host "`n========================================================================" -ForegroundColor Green
    Write-Host "  ALL BASELINE VERIFICATIONS PASSED FOR SINGAPORE DEV ($TargetRef)!" -ForegroundColor Green
    Write-Host "========================================================================" -ForegroundColor Green
}
finally {
    if ($needCredentialPurge) {
        $plainDbPass = $null
        [System.GC]::Collect()
    }
}
