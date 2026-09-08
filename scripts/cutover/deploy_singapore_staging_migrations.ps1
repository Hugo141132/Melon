<#
.SYNOPSIS
    Target-locked operator wrapper to deploy pending Prisma migrations to Singapore Staging (ihgoxqdncepbcrqkchxu).
.DESCRIPTION
    1. Locks execution strictly to target project ihgoxqdncepbcrqkchxu (AWS ap-southeast-1).
    2. Interactively acquires database credentials without exposing them in command history or process listings.
    3. Inspects current migration history and physical schema:
       - Confirms baseline 10 migrations are applied (including 20260820000000_add_session_user_active_index).
       - Confirms 0 unresolved failures exist.
       - Confirms 'sessions_user_active_idx' is already valid and ready (will NEVER drop it).
       - Confirms migration 20260905040000_add_auth_and_fk_performance_indexes is pending.
    4. Executes 'npx prisma migrate deploy' with structured failure diagnostics.
    5. Performs comprehensive post-deploy verification:
       - Exactly 11 applied migrations in _prisma_migrations (0 unresolved failures, 0 rollbacks)
       - Bit-for-bit checksum match for all 11 applied repository migrations
       - All 13 performance indexes verified for definition, validity (indisvalid=true), and readiness (indisready=true)
       - Unchanged row counts across all 25 non-_prisma application tables vs staging_manifest.tsv
#>
[CmdletBinding()]
param (
    [string]$TargetRef     = "ihgoxqdncepbcrqkchxu",
    [string]$BackupDir     = "backups/cutover/staging_20260908_185145",
    [string]$TargetHost    = "aws-0-ap-southeast-1.pooler.supabase.com",
    [int]$TargetPort       = 5432,
    [string]$TargetUser    = "",
    [string]$TargetDb      = "postgres",
    [string]$PlainPassword = "",
    [switch]$RequireSsl,
    [string]$Network,
    [string]$PrismaHost    = "",
    [int]$PrismaPort       = 0
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ==============================================================================
# 1. Target Identity Guards
# ==============================================================================
$EXPECTED_TARGET_REF = 'ihgoxqdncepbcrqkchxu'
$PAUSED_SOURCE_REF   = 'scqrbtfilmttqrutynyo'

if ($TargetRef -ne $EXPECTED_TARGET_REF) {
    Write-Error "Safety Guard: TargetRef '$TargetRef' does not match expected Singapore Staging reference '$EXPECTED_TARGET_REF'."
    exit 1
}

if ($TargetRef -eq $PAUSED_SOURCE_REF) {
    Write-Error "CRITICAL GUARD: Cannot run migration deploy against paused Mumbai source project '$PAUSED_SOURCE_REF'!"
    exit 1
}

if ([string]::IsNullOrWhiteSpace($TargetUser)) {
    $TargetUser = "postgres.$TargetRef"
}

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "  KEBUN MELON: PRISMA MIGRATE DEPLOY (TARGET: $TargetRef)" -ForegroundColor Cyan
Write-Host "  Destination Host: $TargetHost`:$TargetPort (Database: $TargetDb)" -ForegroundColor Cyan
Write-Host "  Target Region   : AWS Singapore (ap-southeast-1)" -ForegroundColor Cyan
Write-Host "  Pending Migration to Deploy:" -ForegroundColor Cyan
Write-Host "    - 20260905040000_add_auth_and_fk_performance_indexes" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan

# ==============================================================================
# 2. Acquire Credentials Securely
# ==============================================================================
$plainDbPass = $PlainPassword
if ([string]::IsNullOrWhiteSpace($plainDbPass)) {
    $secPass = Read-Host -Prompt "Enter Singapore Staging Database Password ($TargetUser)" -AsSecureString
    if (-not $secPass -or $secPass.Length -eq 0) {
        Write-Error "Database password cannot be empty."
        exit 1
    }
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPass)
    $plainDbPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    $secPass = $null
}

function Invoke-PsqlDirect {
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
        throw "psql command failed (ExitCode: $($proc.ExitCode)): $stdErr"
    }
    return $stdOut.Trim()
}

try {
    # ==============================================================================
    # 3. Pre-Deploy Assessment: Unresolved Failures & Idempotence Checks
    # ==============================================================================
    Write-Host "`n[1/4] Assessing migration history & index state before deployment..." -ForegroundColor Yellow

    $assessSql = @'
SELECT json_build_object(
    'unresolved_failed_count', (SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL),
    'migration_20260820_applied', (SELECT count(*) FROM public._prisma_migrations WHERE migration_name = '20260820000000_add_session_user_active_index' AND finished_at IS NOT NULL AND rolled_back_at IS NULL),
    'migration_20260905_applied', (SELECT count(*) FROM public._prisma_migrations WHERE migration_name = '20260905040000_add_auth_and_fk_performance_indexes' AND finished_at IS NOT NULL AND rolled_back_at IS NULL),
    'sessions_user_active_valid_and_ready', (
        SELECT count(*)
        FROM pg_index ix
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_class t ON t.oid = ix.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_am am ON am.oid = i.relam
        WHERE n.nspname = 'public'
          AND i.relname = 'sessions_user_active_idx'
          AND t.relname = 'sessions'
          AND am.amname = 'btree'
          AND ix.indisvalid = true
          AND ix.indisready = true
    ),
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
    )
)::text;
'@

    $assessRaw = Invoke-PsqlDirect -Sql $assessSql -TuplesOnly
    $assessData = $assessRaw | ConvertFrom-Json

    # Guard 1: Zero Unresolved Failed Migration Records
    if ($assessData.unresolved_failed_count -gt 0) {
        throw "BLOCKED: Detected $($assessData.unresolved_failed_count) unresolved failed migration records in _prisma_migrations! Halting without modifications."
    }

    # Guard 2: Baseline migration 20260820000000 MUST already be applied on Staging
    if ($assessData.migration_20260820_applied -ne 1) {
        throw "BLOCKED: Expected migration 20260820000000_add_session_user_active_index to be applied in baseline Staging! Found: $($assessData.migration_20260820_applied)"
    }
    if ($assessData.sessions_user_active_valid_and_ready -ne 1) {
        throw "BLOCKED: Expected index 'sessions_user_active_idx' to exist, be valid, and ready in baseline Staging!"
    }
    Write-Host "  [OK] Baseline migration 20260820000000 confirmed applied and 'sessions_user_active_idx' is valid and ready." -ForegroundColor Green
    Write-Host "  [POLICY] Staging preserves 'sessions_user_active_idx' (will NOT drop)." -ForegroundColor Green

    $alreadyApplied = ($assessData.migration_20260905_applied -gt 0)

    if ($alreadyApplied) {
        Write-Host "  [INFO] Target migration 20260905040000 is ALREADY applied in _prisma_migrations." -ForegroundColor Cyan
        if ($assessData.perf_indexes_valid_and_ready -ne 13) {
            throw "DISCREPANCY DETECTED: Migration 20260905040000 is marked applied, but physical schema has $($assessData.perf_indexes_valid_and_ready)/13 valid and ready performance indexes! Halting without deleting objects or modifying history."
        }
        Write-Host "  [INFO] All 13 performance indexes confirmed valid and ready." -ForegroundColor Green
        Write-Host "  [INFO] Skipping prisma migrate deploy. Running verification only." -ForegroundColor Cyan
    } else {
        # ==============================================================================
        # 4. Execute Prisma Migrate Deploy
        # ==============================================================================
        Write-Host "`n[2/4] Executing 'npx prisma migrate deploy' against Singapore Staging..." -ForegroundColor Yellow
        $escapedPass = [System.Uri]::EscapeDataString($plainDbPass)
        $escapedUser = [System.Uri]::EscapeDataString($TargetUser)
        $pHost = if ([string]::IsNullOrWhiteSpace($PrismaHost)) { $TargetHost } else { $PrismaHost }
        $pPort = if ($PrismaPort -gt 0) { $PrismaPort } else { $TargetPort }
        $sslQuery = if ($RequireSsl) { "?sslmode=require" } else { "" }
        $sessionUrl = "postgresql://${escapedUser}:${escapedPass}@${pHost}:${pPort}/${TargetDb}${sslQuery}"

        $env:DATABASE_URL = $sessionUrl
        $deploySuccess = $false

        try {
            $deployOutput = npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma 2>&1
            $deployExitCode = $LASTEXITCODE
            Write-Host $deployOutput
            if ($deployExitCode -ne 0) {
                throw "Prisma migrate deploy exited with code $deployExitCode"
            }
            $deploySuccess = $true
        } catch {
            Write-Host "`n========================================================================" -ForegroundColor Red
            Write-Host "  [FATAL] PRISMA MIGRATE DEPLOYMENT FAILED ON SINGAPORE STAGING" -ForegroundColor Red
            Write-Host "========================================================================" -ForegroundColor Red
            Write-Host "Error details: $_" -ForegroundColor Red
            throw
        } finally {
            $env:DATABASE_URL = $null
        }

        Write-Host "  [SUCCESS] Prisma migrate deploy completed successfully!" -ForegroundColor Green
    }

    # ==============================================================================
    # 5. Comprehensive Post-Deploy Verification
    # ==============================================================================
    Write-Host "`n[3/4] Performing post-deployment schema and checksum verification..." -ForegroundColor Yellow

    $postAssessSql = @'
SELECT json_build_object(
    'total_migration_records', (SELECT count(*) FROM public._prisma_migrations),
    'applied_migrations_count', (SELECT count(DISTINCT migration_name) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
    'unresolved_failed_count', (SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL),
    'rolled_back_count', (SELECT count(*) FROM public._prisma_migrations WHERE rolled_back_at IS NOT NULL),
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

    $postRaw = Invoke-PsqlDirect -Sql $postAssessSql -TuplesOnly
    $postData = $postRaw | ConvertFrom-Json

    Write-Host "  Total Migration Records   : $($postData.total_migration_records) (Expected: 11)"
    Write-Host "  Applied Migrations Count  : $($postData.applied_migrations_count) (Expected: 11)"
    Write-Host "  Unresolved Failed Records : $($postData.unresolved_failed_count) (Expected: 0)"
    Write-Host "  Rolled-Back Records       : $($postData.rolled_back_count) (Expected: 0)"
    Write-Host "  Valid Performance Indexes : $($postData.perf_indexes_valid_and_ready) (Expected: 13)"

    if ($postData.total_migration_records -ne 11) { throw "Post-deploy migration records mismatch! Expected 11, got $($postData.total_migration_records)" }
    if ($postData.applied_migrations_count -ne 11) { throw "Post-deploy applied count mismatch! Expected 11, got $($postData.applied_migrations_count)" }
    if ($postData.unresolved_failed_count -ne 0) { throw "Post-deploy unresolved failed migrations detected! Count: $($postData.unresolved_failed_count)" }
    if ($postData.rolled_back_count -ne 0) { throw "Post-deploy rolled-back records detected! Count: $($postData.rolled_back_count)" }
    if ($postData.perf_indexes_valid_and_ready -ne 13) { throw "Post-deploy performance indexes mismatch! Expected 13, got $($postData.perf_indexes_valid_and_ready)" }

    # Assert Checksum Match for 11 Applied Repository Migrations
    $expectedChecksums = @{
        "0_init"                                                         = "0000000000000000000000000000000000000000000000000000000000000000"
        "20260730140756_update_device_type_enum"                         = "0000000000000000000000000000000000000000000000000000000000000002"
        "20260731001600_add_user_device_access_active_unique_index"      = "0000000000000000000000000000000000000000000000000000000000000003"
        "20260731170000_remove_legacy_device_types"                      = "0000000000000000000000000000000000000000000000000000000000000004"
        "20260802170000_add_faucet_command_events_message_unique"        = "0000000000000000000000000000000000000000000000000000000000000005"
        "20260817000000_add_password_reset_tokens"                       = "96cb7573b6a3f0dd34515a181e7c7686ab8722f39737f4411b19cce07d520597"
        "20260817082153_add_email_verification_tokens"                   = "20ffda99679f7a30c940a7965ea99d6f00f11cfc27b13398ee6dda27e9afd3de"
        "20260819000000_task_0802_faucet_command_action"                 = "1827d0111cd5bf1c2db4d4b9361cda19aa1baa70bf92513c0e908f0e5ffe0ee0"
        "20260820000000_add_session_user_active_index"                   = "aae0ceb0a605ae1061e837a6a79a0001976eb60e352e9592390600c49c9636fe"
        "20260829170000_add_pending_email_to_email_verification_tokens"  = "c61139df4afbe0f46629c3203a9d0bd189920216279b5c3a2aead494e50f279e"
        "20260905040000_add_auth_and_fk_performance_indexes"             = "3799354a0d16038662939aa4d2b4cd6f9ced11a84291267f2fad55f396107f7e"
    }

    foreach ($appMig in $postData.all_applied_migrations) {
        $mName = $appMig.name
        $mCheck = $appMig.checksum
        if ($expectedChecksums.ContainsKey($mName)) {
            if ($expectedChecksums[$mName] -ne $mCheck) {
                throw "Checksum mismatch for migration $mName! Expected: $($expectedChecksums[$mName]), Found: $mCheck"
            }
            Write-Host "  [OK] Migration '$mName': checksum verified bit-for-bit." -ForegroundColor Green
        } else {
            throw "Unexpected migration found in target database: $mName"
        }
    }

    # ==============================================================================
    # 6. Verify Unchanged Application Table Row Counts vs Staging Manifest
    # ==============================================================================
    Write-Host "`n[4/4] Verifying unchanged row counts across all 25 application tables vs manifest..." -ForegroundColor Yellow
    $manifestPath = Join-Path (Resolve-Path $BackupDir).Path "staging_manifest.tsv"
    if (-not (Test-Path $manifestPath)) {
        throw "Staging snapshot manifest not found: $manifestPath"
    }

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

    $countsOut = Invoke-PsqlDirect -Sql $aggCountsSql -TuplesOnly
    $actualCounts = $countsOut | ConvertFrom-Json

    $manifestLines = Get-Content $manifestPath | Where-Object { $_ -match '\S' }
    foreach ($line in $manifestLines) {
        $parts = $line -split "`t"
        $tbl = $parts[0].Trim()
        $expectedCount = [int64]$parts[1].Trim()

        # _prisma_migrations is expected to increase from 10 to 11
        if ($tbl -eq '_prisma_migrations') {
            $act = [int64]$actualCounts.$tbl
            if ($act -ne 11) {
                throw "_prisma_migrations count mismatch post-deploy! Expected 11, found $act"
            }
            Write-Host "  [MATCH] Table '_prisma_migrations': 11 rows (10 baseline + 1 new migration)" -ForegroundColor Green
            continue
        }

        $actCount = $actualCounts.$tbl
        if ($null -eq $actCount) {
            throw "Table '$tbl' is missing from target database post-deploy!"
        }
        if ([int64]$actCount -ne $expectedCount) {
            throw "Data corruption detected! Table '$tbl' row count changed from $expectedCount to $actCount during migration deploy!"
        }
        Write-Host "  [MATCH] Table '$tbl': $actCount rows (unchanged)" -ForegroundColor Gray
    }

    Write-Host "`n========================================================================" -ForegroundColor Green
    Write-Host "  SINGAPORE STAGING MIGRATION DEPLOYMENT & VERIFICATION COMPLETE!" -ForegroundColor Green
    Write-Host "========================================================================" -ForegroundColor Green
} finally {
    $plainDbPass = $null
    $env:DATABASE_URL = $null
    [System.GC]::Collect()
}
