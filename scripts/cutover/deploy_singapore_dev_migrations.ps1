<#
.SYNOPSIS
    Target-locked operator wrapper to deploy pending Prisma migrations to Singapore Dev (unbyxlkrzqlafolxcypi).
.DESCRIPTION
    1. Locks execution strictly to target project unbyxlkrzqlafolxcypi (AWS ap-southeast-1).
    2. Interactively acquires database credentials without exposing them in command history or process listings.
    3. Inspects current migration history and physical schema:
       - If both migrations (20260820000000, 20260905040000) are already applied, skips DROP INDEX and migrate deploy, running verification only.
       - If history and physical schema disagree, stops with a specific diagnosis without deleting objects.
       - Only drops 'sessions_user_active_idx' when migration 20260820000000 is genuinely pending, 0 unresolved failures exist, and the index matches the approved definition.
    4. Applies bounded lock waiting (SET lock_timeout = '5s') and never uses CASCADE.
    5. Executes 'npx prisma migrate deploy' with clear failure handling:
       - If deployment fails after drop, inspects post-failure state, keeps writers stopped, and reports recovery actions without blind retries.
    6. Performs comprehensive post-deploy verification:
       - 13 total rows in _prisma_migrations (11 applied + 2 preserved historical rollbacks, 0 unresolved failures)
       - Bit-for-bit checksum match for all 11 applied repository migrations
       - All 13 performance indexes verified for definition, validity (indisvalid=true), and readiness (indisready=true)
       - Unchanged row counts across all 25 non-_prisma application tables vs dev_manifest.tsv
#>
[CmdletBinding()]
param (
    [string]$TargetRef     = "unbyxlkrzqlafolxcypi",
    [string]$BackupDir     = "backups/cutover/dev_20260908_025808",
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
$EXPECTED_TARGET_REF = 'unbyxlkrzqlafolxcypi'
$PAUSED_SOURCE_REF   = 'xjsencdgfcbkzdzqcnqx'

if ($TargetRef -ne $EXPECTED_TARGET_REF) {
    Write-Error "Safety Guard: TargetRef '$TargetRef' does not match expected Singapore Dev reference '$EXPECTED_TARGET_REF'."
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
Write-Host "  Pending Migrations to Deploy:" -ForegroundColor Cyan
Write-Host "    - 20260820000000_add_session_user_active_index" -ForegroundColor Cyan
Write-Host "    - 20260905040000_add_auth_and_fk_performance_indexes" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan

# ==============================================================================
# 2. Acquire Credentials Securely
# ==============================================================================
$plainDbPass = $PlainPassword
if ([string]::IsNullOrWhiteSpace($plainDbPass)) {
    $secPass = Read-Host -Prompt "Enter Singapore Dev Database Password ($TargetUser)" -AsSecureString
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
    'index_exists', (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'sessions_user_active_idx'),
    'index_valid_and_ready', (
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
          AND ix.indisunique = false
          AND ix.indisvalid = true
          AND ix.indisready = true
          AND pg_get_indexdef(ix.indexrelid) = 'CREATE INDEX sessions_user_active_idx ON public.sessions USING btree (user_id, revoked_at, expires_at)'
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

    $alreadyApplied = ($assessData.migration_20260820_applied -gt 0 -and $assessData.migration_20260905_applied -gt 0)

    if ($alreadyApplied) {
        Write-Host "  [INFO] Both target migrations (20260820000000, 20260905040000) are ALREADY applied in _prisma_migrations." -ForegroundColor Cyan
        
        # Verify physical schema matches history
        if ($assessData.index_valid_and_ready -ne 1) {
            throw "DISCREPANCY DETECTED: Migration 20260820000000 is marked applied, but physical index 'sessions_user_active_idx' is missing, invalid, or definition has drifted! Halting without deleting objects or modifying history."
        }
        if ($assessData.perf_indexes_valid_and_ready -ne 13) {
            throw "DISCREPANCY DETECTED: Migration 20260905040000 is marked applied, but physical schema has $($assessData.perf_indexes_valid_and_ready)/13 valid and ready performance indexes! Halting without deleting objects or modifying history."
        }
        Write-Host "  [INFO] All 13 performance indexes confirmed valid and ready." -ForegroundColor Green
        Write-Host "  [INFO] Skipping DROP INDEX and skipping prisma migrate deploy. Running verification only." -ForegroundColor Cyan
    } else {
        # Migration 20260820000000 handling
        if ($assessData.migration_20260820_applied -eq 0) {
            # Migration 20260820000000 is genuinely pending
            if ($assessData.index_exists -gt 0) {
                # Check definition match before dropping
                if ($assessData.index_valid_and_ready -ne 1) {
                    throw "DISCREPANCY DETECTED: Physical index 'sessions_user_active_idx' exists but does not match the approved definition (must be btree on public.sessions(user_id, revoked_at, expires_at), non-unique, valid, ready). Halting without dropping."
                }

                Write-Host "  [RECONCILIATION] Migration 20260820000000 is genuinely pending and 'sessions_user_active_idx' exists matching approved definition." -ForegroundColor Yellow
                Write-Host "  [RECONCILIATION] Executing separate bounded lock drop (lock_timeout = '5s', NO CASCADE)..." -ForegroundColor Yellow
                
                $dropSql = @'
SET lock_timeout = '5s';
DROP INDEX public.sessions_user_active_idx;
'@
                $null = Invoke-PsqlDirect -Sql $dropSql
                Write-Host "  [OK] Successfully dropped 'sessions_user_active_idx' for clean Prisma deployment." -ForegroundColor Green
            } else {
                Write-Host "  [INFO] 'sessions_user_active_idx' does not exist. Ready for initial creation by Prisma." -ForegroundColor Green
            }
        } else {
            # Migration 20260820000000 is already applied, but 20260905040000 is pending.
            # Never drop sessions_user_active_idx!
            if ($assessData.index_valid_and_ready -ne 1) {
                throw "DISCREPANCY DETECTED: Migration 20260820000000 is marked applied, but physical index 'sessions_user_active_idx' is missing or invalid! Halting without modifications."
            }
            Write-Host "  [INFO] Migration 20260820000000 is already applied. Preserving existing 'sessions_user_active_idx' (will NOT drop)." -ForegroundColor Green
        }

        # ==============================================================================
        # 4. Execute Prisma Migrate Deploy with Diagnostic Failure Handling
        # ==============================================================================
        Write-Host "`n[2/4] Executing 'npx prisma migrate deploy' against Singapore Dev..." -ForegroundColor Yellow
        $escapedPass = [System.Uri]::EscapeDataString($plainDbPass)
        $escapedUser = [System.Uri]::EscapeDataString($TargetUser)
        $pHost = if ([string]::IsNullOrWhiteSpace($PrismaHost)) { $TargetHost } else { $PrismaHost }
        $pPort = if ($PrismaPort -gt 0) { $PrismaPort } else { $TargetPort }
        $sslQuery = if ($RequireSsl) { "?sslmode=require" } else { "" }
        $sessionUrl = "postgresql://${escapedUser}:${escapedPass}@${pHost}:${pPort}/${TargetDb}${sslQuery}"

        $env:DATABASE_URL = $sessionUrl
        $deploySuccess = $false
        $deployErrorOutput = ""

        try {
            $deployOutput = npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma 2>&1
            $deployExitCode = $LASTEXITCODE
            Write-Host $deployOutput
            if ($deployExitCode -ne 0) {
                $deployErrorOutput = $deployOutput -join "`n"
                throw "Prisma migrate deploy exited with code $deployExitCode"
            }
            $deploySuccess = $true
        } catch {
            $deployErrorOutput = $_.Exception.Message
        } finally {
            $env:DATABASE_URL = $null
            $sessionUrl = $null
            $escapedPass = $null
        }

        if (-not $deploySuccess) {
            Write-Host "`n========================================================================" -ForegroundColor Red
            Write-Host "  [FAILURE] PRISMA MIGRATE DEPLOY FAILED AFTER INDEX DROP" -ForegroundColor Red
            Write-Host "========================================================================" -ForegroundColor Red
            Write-Host "Error Output: $deployErrorOutput" -ForegroundColor Red
            
            # Post-failure state inspection
            Write-Host "`n  Inspecting resulting database state after failure..." -ForegroundColor Yellow
            $postFailSql = @'
SELECT json_build_object(
    'failed_migrations', (
        SELECT json_agg(json_build_object('name', migration_name, 'logs', logs, 'started_at', started_at))
        FROM public._prisma_migrations
        WHERE finished_at IS NULL AND rolled_back_at IS NULL
    ),
    'applied_migrations', (
        SELECT json_agg(json_build_object('name', migration_name, 'finished_at', finished_at))
        FROM public._prisma_migrations
        WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    ),
    'index_exists', (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'sessions_user_active_idx')
)::text;
'@
            try {
                $pfRaw = Invoke-PsqlDirect -Sql $postFailSql -TuplesOnly
                $pfData = $pfRaw | ConvertFrom-Json
                Write-Host "  Recorded Failed Migrations : $(($pfData.failed_migrations | ConvertTo-Json -Compress))" -ForegroundColor Red
                Write-Host "  Recorded Applied Migrations: $(($pfData.applied_migrations | ConvertTo-Json -Compress))" -ForegroundColor Yellow
                Write-Host "  'sessions_user_active_idx' Exists: $($pfData.index_exists)" -ForegroundColor Red
            } catch {
                Write-Host "  Could not inspect post-failure database state: $_" -ForegroundColor Red
            }

            Write-Host "`n  SAFETY INVARIANT: APPLICATION WRITERS REMAIN STOPPED." -ForegroundColor Yellow
            Write-Host "  ZERO BLIND RETRIES PERFORMED." -ForegroundColor Yellow
            Write-Host "`n  RECOVERY ACTION GUIDANCE:" -ForegroundColor Yellow
            Write-Host "  1. If Prisma failed before applying any migration (failed_migrations is empty and index_exists is 0):" -ForegroundColor Gray
            Write-Host "     - Database schema and history are intact except 'sessions_user_active_idx' was dropped." -ForegroundColor Gray
            Write-Host "     - Resolve root cause (e.g. database credentials or connectivity)." -ForegroundColor Gray
            Write-Host "     - Re-running this script will safely detect the pending migration with index absent and deploy cleanly." -ForegroundColor Gray
            Write-Host "     - Alternatively, to restore pre-drop state without deploying: execute CREATE INDEX sessions_user_active_idx ON public.sessions USING btree (user_id, revoked_at, expires_at);" -ForegroundColor Gray
            Write-Host "  2. If a migration record exists with finished_at IS NULL and rolled_back_at IS NULL:" -ForegroundColor Gray
            Write-Host "     - DO NOT run blind 'prisma migrate resolve'." -ForegroundColor Gray
            Write-Host "     - Review the exact migration failure logs shown above and resolve the blocking DDL." -ForegroundColor Gray
            Write-Host "  3. Keep ENABLE_FAUCET_CONTROL=false and keep web and IoT gateway stopped.`n" -ForegroundColor Yellow
            throw "Prisma migration deployment failed. Transaction was aborted."
        }
        Write-Host "  [SUCCESS] All pending migrations deployed cleanly." -ForegroundColor Green
    }

    # ==============================================================================
    # 5. Post-Deploy Comprehensive Validation
    # ==============================================================================
    Write-Host "`n[3/4] Executing post-deploy validation (history, checksums, validity)..." -ForegroundColor Yellow

    $valSql = @'
SELECT json_build_object(
    'table_count', (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'),
    'total_migration_records', (SELECT count(*) FROM public._prisma_migrations),
    'applied_migrations_count', (SELECT count(DISTINCT migration_name) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
    'applied_migration_records', (
        SELECT json_agg(json_build_object('name', migration_name, 'checksum', checksum) ORDER BY migration_name)
        FROM public._prisma_migrations
        WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    ),
    'unresolved_failed_count', (SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL),
    'rolled_back_count', (SELECT count(*) FROM public._prisma_migrations WHERE rolled_back_at IS NOT NULL),
    'rolled_back_names', (SELECT array_agg(DISTINCT migration_name ORDER BY migration_name) FROM public._prisma_migrations WHERE rolled_back_at IS NOT NULL),
    'foreign_key_count', (SELECT count(*) FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace),
    'valid_performance_indexes_count', (
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
    'perf_index_definitions', (
        SELECT json_agg(json_build_object(
            'name', i.relname,
            'table', t.relname,
            'valid', ix.indisvalid,
            'ready', ix.indisready,
            'unique', ix.indisunique,
            'def', pg_get_indexdef(ix.indexrelid)
        ) ORDER BY i.relname)
        FROM pg_index ix
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_class t ON t.oid = ix.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
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

    $vRaw = Invoke-PsqlDirect -Sql $valSql -TuplesOnly
    $vData = $vRaw | ConvertFrom-Json

    Write-Host "  Public Table Count             : $($vData.table_count) (Expected: 26)"
    Write-Host "  Total Migration Records        : $($vData.total_migration_records) (Expected: 13)"
    Write-Host "  Applied Migrations Count       : $($vData.applied_migrations_count) (Expected: 11)"
    Write-Host "  Unresolved Failed Records      : $($vData.unresolved_failed_count) (Expected: 0)"
    Write-Host "  Rolled-Back Records            : $($vData.rolled_back_count) (Expected: 2)"
    Write-Host "  Valid Performance Indexes (13) : $($vData.valid_performance_indexes_count) (indisvalid=true, indisready=true)"
    Write-Host "  Foreign Key Constraints        : $($vData.foreign_key_count) (Expected: 28)"

    if ($vData.table_count -ne 26) { throw "Table count mismatch! Expected 26, got $($vData.table_count)" }
    if ($vData.total_migration_records -ne 13) { throw "Total migration records mismatch! Expected 13, got $($vData.total_migration_records)" }
    if ($vData.applied_migrations_count -ne 11) { throw "Applied migrations count mismatch! Expected 11, got $($vData.applied_migrations_count)" }
    if ($vData.unresolved_failed_count -ne 0) { throw "Unresolved failed migration records detected! Count: $($vData.unresolved_failed_count)" }
    if ($vData.rolled_back_count -ne 2) { throw "Rolled-back records mismatch! Expected 2, got $($vData.rolled_back_count)" }
    if ($vData.valid_performance_indexes_count -ne 13) { throw "Valid performance indexes count mismatch! Expected 13, got $($vData.valid_performance_indexes_count)" }
    if ($vData.foreign_key_count -ne 28) { throw "Foreign key count mismatch! Expected 28, got $($vData.foreign_key_count)" }

    # Detailed index definition, validity, and readiness verification
    $expectedDefinitions = @{
        "sessions_user_active_idx"                 = @{ table = "sessions"; def = "CREATE INDEX sessions_user_active_idx ON public.sessions USING btree (user_id, revoked_at, expires_at)" }
        "sessions_user_id_idx"                     = @{ table = "sessions"; def = "CREATE INDEX sessions_user_id_idx ON public.sessions USING btree (user_id)" }
        "user_roles_user_id_idx"                   = @{ table = "user_roles"; def = "CREATE INDEX user_roles_user_id_idx ON public.user_roles USING btree (user_id)" }
        "user_roles_user_id_revoked_at_idx"        = @{ table = "user_roles"; def = "CREATE INDEX user_roles_user_id_revoked_at_idx ON public.user_roles USING btree (user_id, revoked_at)" }
        "user_roles_role_id_idx"                   = @{ table = "user_roles"; def = "CREATE INDEX user_roles_role_id_idx ON public.user_roles USING btree (role_id)" }
        "role_permissions_permission_id_idx"       = @{ table = "role_permissions"; def = "CREATE INDEX role_permissions_permission_id_idx ON public.role_permissions USING btree (permission_id)" }
        "account_approvals_decided_by_user_id_idx" = @{ table = "account_approvals"; def = "CREATE INDEX account_approvals_decided_by_user_id_idx ON public.account_approvals USING btree (decided_by_user_id)" }
        "user_device_access_device_id_idx"         = @{ table = "user_device_access"; def = "CREATE INDEX user_device_access_device_id_idx ON public.user_device_access USING btree (device_id)" }
        "user_device_access_assigned_by_user_id_idx" = @{ table = "user_device_access"; def = "CREATE INDEX user_device_access_assigned_by_user_id_idx ON public.user_device_access USING btree (assigned_by_user_id)" }
        "user_preferences_default_device_id_idx"   = @{ table = "user_preferences"; def = "CREATE INDEX user_preferences_default_device_id_idx ON public.user_preferences USING btree (default_device_id)" }
        "alert_acknowledgements_user_id_idx"       = @{ table = "alert_acknowledgements"; def = "CREATE INDEX alert_acknowledgements_user_id_idx ON public.alert_acknowledgements USING btree (acknowledged_by_user_id)" }
        "alert_acknowledgements_alert_id_idx"      = @{ table = "alert_acknowledgements"; def = "CREATE INDEX alert_acknowledgements_alert_id_idx ON public.alert_acknowledgements USING btree (alert_id)" }
        "alerts_device_id_idx"                     = @{ table = "alerts"; def = "CREATE INDEX alerts_device_id_idx ON public.alerts USING btree (device_id)" }
    }

    Write-Host "`n  Verifying individual performance index definitions, validity (indisvalid=true), and readiness (indisready=true)..." -ForegroundColor Yellow
    foreach ($idxInfo in $vData.perf_index_definitions) {
        $iName = $idxInfo.name
        $exp = $expectedDefinitions[$iName]
        if ($null -eq $exp) {
            throw "Unexpected performance index '$iName' returned in validation!"
        }
        if (-not $idxInfo.valid) {
            throw "Index '$iName' is marked INVALID (indisvalid=false)!"
        }
        if (-not $idxInfo.ready) {
            throw "Index '$iName' is marked NOT READY (indisready=false)!"
        }
        if ($idxInfo.unique) {
            throw "Index '$iName' is unexpectedly UNIQUE (indisunique=true)!"
        }
        if ($idxInfo.table -ne $exp.table) {
            throw "Index '$iName' is on table '$($idxInfo.table)', expected '$($exp.table)'!"
        }
        if ($idxInfo.def -ne $exp.def) {
            throw "Index '$iName' definition mismatch! Expected '$($exp.def)', found '$($idxInfo.def)'"
        }
        Write-Host "  [VALID & READY] $iName ON $($idxInfo.table)" -ForegroundColor Gray
    }

    # Assert 2 historical rollbacks preserved
    $expectedRollbacks = @(
        "20260817082153_add_email_verification_tokens",
        "20260819000000_task_0802_faucet_command_action"
    )
    foreach ($rb in $expectedRollbacks) {
        if ($vData.rolled_back_names -notcontains $rb) {
            throw "Historical rolled-back record '$rb' is missing!"
        }
    }

    # Verify exact migration identities and compute local file checksums
    Write-Host "`n  Verifying exact checksum parity against local migration files..." -ForegroundColor Yellow
    $migrationsDir = Resolve-Path "packages/database/prisma/migrations"
    $sha256 = [System.Security.Cryptography.SHA256]::Create()

    foreach ($rec in $vData.applied_migration_records) {
        $mName = $rec.name
        $dbChecksum = $rec.checksum
        $mDir = Join-Path $migrationsDir $mName
        $mFile = Join-Path $mDir "migration.sql"

        if (-not (Test-Path $mFile)) {
            throw "Applied migration '$mName' has no corresponding file in $migrationsDir!"
        }

        # Compute LF-normalized SHA-256
        $content = [System.IO.File]::ReadAllText($mFile, [System.Text.Encoding]::UTF8).Replace("`r`n", "`n")
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
        $hashBytes = $sha256.ComputeHash($bytes)
        $localChecksum = ([System.BitConverter]::ToString($hashBytes)).Replace("-", "").ToLower()

        if ($dbChecksum -ne $localChecksum) {
            throw "Checksum mismatch for migration '$mName'! DB: $dbChecksum, Local: $localChecksum"
        }
        Write-Host "  [MATCH] $mName : $dbChecksum" -ForegroundColor Gray
    }
    Write-Host "  [OK] 100% bit-for-bit checksum parity confirmed across all 11 applied repository migrations." -ForegroundColor Green

    # ==============================================================================
    # 6. Unchanged Application Table Parity vs Snapshot Manifest
    # ==============================================================================
    $manifestPath = Join-Path (Resolve-Path $BackupDir).Path "dev_manifest.tsv"
    Write-Host "`n[4/4] Verifying unchanged row counts across all 25 application tables vs manifest..." -ForegroundColor Yellow
    if (-not (Test-Path $manifestPath)) {
        throw "Snapshot manifest file not found: $manifestPath"
    }

    $countsSql = @'
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
    $countsOut = Invoke-PsqlDirect -Sql $countsSql -TuplesOnly
    $actualCounts = $countsOut | ConvertFrom-Json
    $manifestLines = Get-Content $manifestPath | Where-Object { $_ -match '\S' }

    foreach ($line in $manifestLines) {
        $parts = $line -split "`t"
        $tbl = $parts[0].Trim()
        $expectedCount = [int64]$parts[1].Trim()

        # Skip _prisma_migrations because it grew from 11 to 13 as intended
        if ($tbl -eq '_prisma_migrations') { continue }

        $actualCount = $actualCounts.$tbl
        if ($null -eq $actualCount) {
            throw "Table '$tbl' missing from target database!"
        } elseif ([int64]$actualCount -ne $expectedCount) {
            throw "Application table row count changed unexpectedly for '$tbl'! Expected: $expectedCount, Found: $actualCount"
        }
    }
    Write-Host "  [OK] All 25 application tables have 100% unchanged row counts." -ForegroundColor Green

    Write-Host "`n========================================================================" -ForegroundColor Green
    Write-Host "  ALL POST-DEPLOY CHECKS PASSED FOR SINGAPORE DEV ($TargetRef)!" -ForegroundColor Green
    Write-Host "  11 Applied Migrations, 2 Resolved Rollbacks, 13 Performance Indexes Valid." -ForegroundColor Green
    Write-Host "========================================================================" -ForegroundColor Green
} finally {
    $plainDbPass = $null
    [System.GC]::Collect()
}
