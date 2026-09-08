<#
.SYNOPSIS
    Securely restores and verifies the fresh Staging cutover backup into Singapore Staging (ihgoxqdncepbcrqkchxu).
.DESCRIPTION
    Executed by the operator. Strictly targets Singapore Staging using Session pooler port 5432.
    Validates SHA-256 checksums before restore.
    Decrypts backup using native or WSL GPG with passphrase piped via standard input (never in process arguments).
    Sanitizes pre-data DDL to preserve Supabase cloud-managed public schema.
    Executes pre-data, table data, and post-data in ONE atomic transaction (--single-transaction, ON_ERROR_STOP=1).
    Validates 100% table row-count parity against staging_manifest.tsv, zero FK orphans, and 10 baseline Prisma migration identities.
    Guarantees deterministic cleanup of plaintext data in try/finally blocks.
.PARAMETER BackupDir
    Path to the fresh cutover backup directory. Default: 'backups/cutover/staging_20260908_185145'.
.PARAMETER TargetRef
    The target Supabase project reference. Default: 'ihgoxqdncepbcrqkchxu'.
#>
[CmdletBinding()]
param (
    [string]$BackupDir = 'backups/cutover/staging_20260908_185145',
    [string]$TargetRef = 'ihgoxqdncepbcrqkchxu',
    [switch]$FunctionsOnly,
    [switch]$VerifyOnly
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ==============================================================================
# Reusable Encoding & Sanitization Functions
# ==============================================================================

function Sanitize-StagingPreDataSql {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$SourcePath,
        [Parameter(Mandatory=$true)][string]$DestinationPath
    )

    if (-not (Test-Path $SourcePath)) {
        throw "Source pre-data file not found: $SourcePath"
    }

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $preLines = [System.IO.File]::ReadAllLines($SourcePath, $utf8NoBom)

    $droppedSchemaCount = 0
    $createdSchemaCount = 0
    $commentSchemaCount = 0
    $cleanLines = New-Object System.Collections.Generic.List[string]

    for ($i = 0; $i -lt $preLines.Count; $i++) {
        $line = $preLines[$i]

        # 1. Existing public schema guards (schema public is cloud-owned by pg_database_owner)
        if ($line -match '^DROP SCHEMA IF EXISTS public;') {
            $droppedSchemaCount++
            continue
        }
        if ($line -match '^CREATE SCHEMA public;') {
            $createdSchemaCount++
            continue
        }
        if ($line -match '^COMMENT ON SCHEMA public') {
            $commentSchemaCount++
            continue
        }

        # 2. Conflicting platform function rls_auto_enable() if ever present
        if ($line -match '^DROP FUNCTION (IF EXISTS )?public\.rls_auto_enable\b') {
            continue
        }
        if ($line -match '^(ALTER|COMMENT ON|GRANT|REVOKE)\b.*public\.rls_auto_enable\b') {
            continue
        }

        $cleanLines.Add($line)
    }

    # Fail closed on unexpected dump structure for public schema
    if ($droppedSchemaCount -ne 1) {
        throw "Fail Closed: Expected exactly 1 DROP SCHEMA IF EXISTS public statement, found $droppedSchemaCount."
    }
    if ($createdSchemaCount -ne 1) {
        throw "Fail Closed: Expected exactly 1 CREATE SCHEMA public statement, found $createdSchemaCount."
    }

    [System.IO.File]::WriteAllLines($DestinationPath, $cleanLines, $utf8NoBom)

    # Post-sanitization safety verification: assert destination is strictly free from conflicting statements
    $sanitizedContent = [System.IO.File]::ReadAllText($DestinationPath, $utf8NoBom)
    if ($sanitizedContent -match 'DROP SCHEMA IF EXISTS public') {
        throw "Post-sanitization assertion failed: 'DROP SCHEMA IF EXISTS public' still present in $DestinationPath."
    }
    if ($sanitizedContent -match 'CREATE SCHEMA public') {
        throw "Post-sanitization assertion failed: 'CREATE SCHEMA public' still present in $DestinationPath."
    }

    # Verify no UTF-8 BOM was emitted
    $destBytes = [System.IO.File]::ReadAllBytes($DestinationPath)
    if ($destBytes.Length -ge 3 -and $destBytes[0] -eq 0xEF -and $destBytes[1] -eq 0xBB -and $destBytes[2] -eq 0xBF) {
        throw "Encoding assertion failed: $DestinationPath starts with a UTF-8 BOM!"
    }
}

function Remove-LeadingBom {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$FilePath
    )

    if (-not (Test-Path $FilePath)) {
        throw "Target file for BOM removal not found: $FilePath"
    }

    $bytes = [System.IO.File]::ReadAllBytes($FilePath)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $noBomBytes = New-Object byte[] ($bytes.Length - 3)
        [System.Buffer]::BlockCopy($bytes, 3, $noBomBytes, 0, $noBomBytes.Length)
        [System.IO.File]::WriteAllBytes($FilePath, $noBomBytes)
        return $true
    }
    return $false
}

function Prepare-StagingPostDataSql {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$SourcePath,
        [Parameter(Mandatory=$true)][string]$DestinationPath
    )

    if (-not (Test-Path $SourcePath)) {
        throw "Source post-data file not found: $SourcePath"
    }

    $bytes = [System.IO.File]::ReadAllBytes($SourcePath)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $noBomBytes = New-Object byte[] ($bytes.Length - 3)
        [System.Buffer]::BlockCopy($bytes, 3, $noBomBytes, 0, $noBomBytes.Length)
        [System.IO.File]::WriteAllBytes($DestinationPath, $noBomBytes)
    } else {
        [System.IO.File]::WriteAllBytes($DestinationPath, $bytes)
    }

    # Verify no UTF-8 BOM in destination
    $destBytes = [System.IO.File]::ReadAllBytes($DestinationPath)
    if ($destBytes.Length -ge 3 -and $destBytes[0] -eq 0xEF -and $destBytes[1] -eq 0xBB -and $destBytes[2] -eq 0xBF) {
        throw "Encoding assertion failed: $DestinationPath starts with a UTF-8 BOM!"
    }
}

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

function Verify-SingaporeStagingBaseline {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$TargetHost,
        [Parameter(Mandatory=$true)][int]$TargetPort,
        [Parameter(Mandatory=$true)][string]$TargetUser,
        [Parameter(Mandatory=$true)][string]$TargetDb,
        [Parameter(Mandatory=$true)][string]$PlainPassword,
        [Parameter(Mandatory=$true)][string]$ManifestPath,
        [switch]$RequireSsl,
        [string]$Network
    )

    Write-Host "`n========================================================================" -ForegroundColor Cyan
    Write-Host "  VERIFYING SINGAPORE STAGING BASELINE RESTORATION & REFERENTIAL INTEGRITY" -ForegroundColor Cyan
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
    'foreign_key_count', (SELECT count(*) FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace),
    'enum_count', (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typtype = 'e'),
    'trigger_count', (SELECT count(*) FROM pg_event_trigger WHERE evtname = 'ensure_rls' AND evtenabled = 'O'),
    'sessions_user_active_idx_exists', (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'sessions_user_active_idx')
)::text;
'@

    $vOut = Invoke-PsqlCommand -TargetHost $TargetHost -TargetPort $TargetPort -TargetUser $TargetUser -TargetDb $TargetDb -PlainPassword $PlainPassword -Sql $verifySql -TuplesOnly -RequireSsl:$RequireSsl -Network $Network

    $vData = $vOut | ConvertFrom-Json
    Write-Host "  Public Table Count        : $($vData.table_count) (Expected: 26)"
    Write-Host "  Total Migration Records   : $($vData.total_migration_records) (Expected: 10)"
    Write-Host "  Applied Migrations Count  : $($vData.applied_migrations_count) (Expected: 10)"
    Write-Host "  Unresolved Failed Records : $($vData.unresolved_failed_count) (Expected: 0)"
    Write-Host "  Rolled-Back Records       : $($vData.rolled_back_count) (Expected: 0)"
    Write-Host "  Foreign Key Constraints   : $($vData.foreign_key_count) (Expected: 28)"
    Write-Host "  Enum Types Count          : $($vData.enum_count) (Expected: 8)"
    Write-Host "  ensure_rls Event Trigger  : $($vData.trigger_count) (Expected: 1)"
    Write-Host "  sessions_user_active_idx  : $($vData.sessions_user_active_idx_exists) (Expected: 1)"

    if ($vData.table_count -ne 26) { throw "Table count mismatch! Expected 26, got $($vData.table_count)" }
    if ($vData.total_migration_records -ne 10) { throw "Total migration records mismatch! Expected 10, got $($vData.total_migration_records)" }
    if ($vData.applied_migrations_count -ne 10) { throw "Applied migrations count mismatch! Expected 10, got $($vData.applied_migrations_count)" }
    if ($vData.unresolved_failed_count -ne 0) { throw "Unresolved failed migration records detected! Count: $($vData.unresolved_failed_count)" }
    if ($vData.rolled_back_count -ne 0) { throw "Rolled-back records detected! Count: $($vData.rolled_back_count)" }
    if ($vData.foreign_key_count -ne 28) { throw "Foreign key count mismatch! Expected 28, got $($vData.foreign_key_count)" }
    if ($vData.enum_count -ne 8) { throw "Enum type count mismatch! Expected 8, got $($vData.enum_count)" }
    if ($vData.trigger_count -ne 1) { throw "ensure_rls event trigger missing or disabled!" }
    if ($vData.sessions_user_active_idx_exists -ne 1) { throw "sessions_user_active_idx missing!" }

    # Assert 10 Baseline Applied Migration Identities for Staging
    $expectedBaselineApplied = @(
        "0_init",
        "20260730140756_update_device_type_enum",
        "20260731001600_add_user_device_access_active_unique_index",
        "20260731170000_remove_legacy_device_types",
        "20260802170000_add_faucet_command_events_message_unique",
        "20260817000000_add_password_reset_tokens",
        "20260817082153_add_email_verification_tokens",
        "20260819000000_task_0802_faucet_command_action",
        "20260820000000_add_session_user_active_index",
        "20260829170000_add_pending_email_to_email_verification_tokens"
    )

    foreach ($m in $expectedBaselineApplied) {
        if ($vData.applied_migration_names -notcontains $m) {
            throw "Missing expected baseline applied migration: $m"
        }
    }

    Write-Host "  [OK] All 10 baseline applied migrations verified in _prisma_migrations." -ForegroundColor Green
    Write-Host "  [INFO] Pending migration 20260905040000_add_auth_and_fk_performance_indexes ready for prisma migrate deploy." -ForegroundColor Cyan

    # 2. Per-table row count parity verification against manifest
    Write-Host "`n  Verifying table row counts against snapshot manifest ($ManifestPath)..." -ForegroundColor Yellow
    if (-not (Test-Path $ManifestPath)) {
        throw "Snapshot manifest file not found: $ManifestPath"
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

    $countsOut = Invoke-PsqlCommand -TargetHost $TargetHost -TargetPort $TargetPort -TargetUser $TargetUser -TargetDb $TargetDb -PlainPassword $PlainPassword -Sql $aggCountsSql -TuplesOnly -RequireSsl:$RequireSsl -Network $Network
    $actualCounts = $countsOut | ConvertFrom-Json

    $manifestLines = Get-Content $ManifestPath | Where-Object { $_ -match '\S' }
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

    $null = Invoke-PsqlCommand -TargetHost $TargetHost -TargetPort $TargetPort -TargetUser $TargetUser -TargetDb $TargetDb -PlainPassword $PlainPassword -Sql $orphanCheckSql -RequireSsl:$RequireSsl -Network $Network

    Write-Host "  [OK] Zero orphaned foreign key rows detected across all 28 constraints." -ForegroundColor Green
    Write-Host "`n========================================================================" -ForegroundColor Green
    Write-Host "  ALL BASELINE VERIFICATIONS PASSED FOR SINGAPORE STAGING ($TargetRef)!" -ForegroundColor Green
    Write-Host "========================================================================" -ForegroundColor Green
}

if ($FunctionsOnly) {
    return
}

# ==============================================================================
# 1. Target Identity Guards & Host Verification
# ==============================================================================
$EXPECTED_TARGET_REF = 'ihgoxqdncepbcrqkchxu'
$PAUSED_SOURCE_REF   = 'scqrbtfilmttqrutynyo'

if ($TargetRef -ne $EXPECTED_TARGET_REF) {
    Write-Error "Safety Guard: TargetRef '$TargetRef' does not match expected Singapore Staging reference '$EXPECTED_TARGET_REF'."
    exit 1
}

# Explicitly prevent accidental execution against paused Mumbai source
if ($TargetRef -eq $PAUSED_SOURCE_REF) {
    Write-Error "CRITICAL GUARD: Cannot restore to paused Mumbai source project '$PAUSED_SOURCE_REF'!"
    exit 1
}

$targetHost = "aws-0-ap-southeast-1.pooler.supabase.com"
$targetPort = 5432
$targetUser = "postgres.$TargetRef"
$targetDb   = "postgres"

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "  KEBUN MELON: RESTORE TO SINGAPORE STAGING (PROJECT: $TargetRef)" -ForegroundColor Cyan
Write-Host "  Destination Host: $targetHost`:$targetPort (Database: $targetDb)" -ForegroundColor Cyan
Write-Host "  Target Region   : AWS Singapore (ap-southeast-1)" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan

# ==============================================================================
# 2. Check Prerequisites: Docker, GPG, and Backup Artifacts
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

# Verify GPG availability (native or WSL Ubuntu)
$hasNativeGpg = [bool](Get-Command gpg -ErrorAction SilentlyContinue)
$useWslGpg = $false
if (-not $hasNativeGpg) {
    $wslCheck = wsl -d Ubuntu -- which gpg 2>$null
    if ($LASTEXITCODE -eq 0 -and $wslCheck) {
        $useWslGpg = $true
    } else {
        Write-Error "GPG is required for decryption but was not found in native PATH or WSL Ubuntu."
        exit 1
    }
}

# Resolve backup paths
$absBackupDir = (Resolve-Path $BackupDir -ErrorAction Stop).Path
$preDataPath  = Join-Path $absBackupDir "staging_pre_data.sql"
$dataGpgPath  = Join-Path $absBackupDir "staging_data.sql.gpg"
$postDataPath = Join-Path $absBackupDir "staging_post_data.sql"
$schemaPath   = Join-Path $absBackupDir "staging_schema.sql"
$manifestPath = Join-Path $absBackupDir "staging_manifest.tsv"
$checksumPath = Join-Path $absBackupDir "staging_checksums.sha256"

foreach ($file in @($preDataPath, $dataGpgPath, $postDataPath, $manifestPath, $checksumPath)) {
    if (-not (Test-Path $file)) {
        Write-Error "Missing required backup artifact: $file"
        exit 1
    }
}

# ==============================================================================
# 2.1 Verification-Only Mode Entry Point (-VerifyOnly)
# ==============================================================================
if ($VerifyOnly) {
    Write-Host "`n========================================================================" -ForegroundColor Cyan
    Write-Host "  MODE: VERIFICATION-ONLY (-VerifyOnly)" -ForegroundColor Cyan
    Write-Host "  Target: $TargetRef ($targetHost`:$targetPort)" -ForegroundColor Cyan
    Write-Host "  Safety Guarantee: Zero DDL execution, zero data loading, zero decryption." -ForegroundColor Cyan
    Write-Host "========================================================================" -ForegroundColor Cyan

    if (-not (Test-Path $manifestPath)) {
        Write-Error "Manifest file not found: $manifestPath"
        exit 1
    }

    $secPass = Read-Host -Prompt "Enter Singapore Staging Database Password (postgres.$TargetRef)" -AsSecureString
    if (-not $secPass) {
        Write-Error "Database password is required for verification."
        exit 1
    }
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPass)
    $plainDbPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    $secPass = $null

    try {
        Verify-SingaporeStagingBaseline `
            -TargetHost $targetHost `
            -TargetPort $targetPort `
            -TargetUser $targetUser `
            -TargetDb $targetDb `
            -PlainPassword $plainDbPass `
            -ManifestPath $manifestPath `
            -RequireSsl
    } finally {
        $plainDbPass = $null
        [System.GC]::Collect()
    }
    exit 0
}

# ==============================================================================
# 3. Cryptographic Checksum Pre-Validation
# ==============================================================================
Write-Host "`n[1/6] Validating SHA-256 checksums before restore..." -ForegroundColor Yellow
$checksumLines = Get-Content $checksumPath | Where-Object { $_ -match '\S' -and $_ -notmatch '^-' -and $_ -notmatch '^Path' }
$filesToCheck = @(
    @{ Name = "staging_pre_data.sql";  Path = $preDataPath },
    @{ Name = "staging_data.sql.gpg";  Path = $dataGpgPath },
    @{ Name = "staging_post_data.sql"; Path = $postDataPath },
    @{ Name = "staging_manifest.tsv";  Path = $manifestPath }
)

foreach ($f in $filesToCheck) {
    $computedHash = (Get-FileHash -Algorithm SHA256 $f.Path).Hash.ToUpper()
    $matchingLine = $checksumLines | Where-Object { $_ -match [regex]::Escape($f.Name) }
    if (-not $matchingLine) {
        Write-Error "Could not find checksum record for $($f.Name) in $checksumPath. Aborting."
        exit 1
    }
    
    $hashInFile = ($matchingLine.Trim() -split '\s+')[-1].TrimEnd('.')
    if (-not $computedHash.StartsWith($hashInFile)) {
        Write-Error "SHA-256 checksum mismatch for $($f.Name)! Computed: $computedHash, Recorded prefix: $hashInFile. Aborting."
        exit 1
    }
    Write-Host "  [OK] $($f.Name): $computedHash (matches recorded prefix $hashInFile)" -ForegroundColor Green
}

# ==============================================================================
# 4. Credential Acquisition (Interactive Masked Prompts)
# ==============================================================================
Write-Host "`n[2/6] Acquiring database credentials..." -ForegroundColor Yellow
$secDbPass = Read-Host -Prompt "Enter password for Singapore Staging ($targetUser)" -AsSecureString
if ($null -eq $secDbPass -or $secDbPass.Length -eq 0) {
    Write-Error "Database password cannot be empty."
    exit 1
}

$bstrDb = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secDbPass)
$plainDbPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstrDb)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstrDb)
$secDbPass = $null

# ==============================================================================
# 4.1 Fail-Closed Restore Preflight Check (Target Must Be Empty of Application Objects)
# ==============================================================================
Write-Host "`n  Executing target preflight check on $targetHost`:$targetPort..." -ForegroundColor Yellow
$preflightSql = "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name != '_prisma_migrations';"
try {
    $existingAppTables = Invoke-PsqlCommand `
        -TargetHost $targetHost `
        -TargetPort $targetPort `
        -TargetUser $targetUser `
        -TargetDb $targetDb `
        -PlainPassword $plainDbPass `
        -Sql $preflightSql `
        -TuplesOnly `
        -RequireSsl
} catch {
    throw "Target connection/preflight check failed: $_"
}

if ([int64]$existingAppTables.Trim() -gt 0) {
    Write-Host "`n========================================================================" -ForegroundColor Red
    Write-Host "  [BLOCKED] FAIL-CLOSED RESTORE PREFLIGHT" -ForegroundColor Red
    Write-Host "========================================================================" -ForegroundColor Red
    Write-Host "Target database '$TargetRef' already contains $($existingAppTables.Trim()) application tables in 'public' schema!" -ForegroundColor Red
    Write-Host "The restore appears to have already completed, or the target database is not empty." -ForegroundColor Red
    Write-Host "To prevent destructive SQL, table drop conflicts, or accidental overwrites, restore is ABORTED." -ForegroundColor Red
    Write-Host "`nTo perform read-only verification of the existing database without executing restore, run:" -ForegroundColor Yellow
    Write-Host "  powershell -File scripts/cutover/verify_singapore_staging.ps1" -ForegroundColor Green
    Write-Host "or:" -ForegroundColor Yellow
    Write-Host "  powershell -File scripts/cutover/restore_singapore_staging.ps1 -VerifyOnly`n" -ForegroundColor Green
    $plainDbPass = $null
    exit 1
}
Write-Host "  [OK] Preflight passed: Target database has 0 application tables in public schema." -ForegroundColor Green

$secGpgPass = Read-Host -Prompt "Enter GPG encryption passphrase" -AsSecureString
if ($null -eq $secGpgPass -or $secGpgPass.Length -eq 0) {
    Write-Error "GPG passphrase cannot be empty."
    $plainDbPass = $null
    exit 1
}

$bstrGpg = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secGpgPass)
$plainGpgPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstrGpg)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstrGpg)
$secGpgPass = $null

# Define staging paths for temporary files
$tempDataPath      = Join-Path $absBackupDir "staging_data.tmp.sql"
$cleanPreDataPath  = Join-Path $absBackupDir "clean_staging_pre_data.tmp.sql"
$cleanPostDataPath = Join-Path $absBackupDir "clean_staging_post_data.tmp.sql"

try {
    # ==============================================================================
    # 5. Decrypt Data Dump via GPG (Passphrase via Stdin)
    # ==============================================================================
    Write-Host "`n[3/6] Decrypting data payload via GPG..." -ForegroundColor Yellow
    if ($useWslGpg) {
        $wslGpgPath  = ($dataGpgPath -replace '\\', '/' -replace 'C:', '/mnt/c')
        $wslDataPath = ($tempDataPath -replace '\\', '/' -replace 'C:', '/mnt/c')
        
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "wsl"
        $psi.Arguments = "-d Ubuntu -- gpg --batch --yes --decrypt --passphrase-fd 0 --output `"$wslDataPath`" `"$wslGpgPath`""
        $psi.UseShellExecute = $false
        $psi.RedirectStandardInput = $true
        $psi.RedirectStandardError = $true
        $proc = [System.Diagnostics.Process]::Start($psi)
        $proc.StandardInput.Write("$plainGpgPass`n")
        $proc.StandardInput.Flush()
        $proc.StandardInput.Close()
        $errOut = $proc.StandardError.ReadToEnd()
        $proc.WaitForExit()
        
        if ($proc.ExitCode -ne 0 -or -not (Test-Path $tempDataPath)) {
            throw "WSL GPG decryption failed (ExitCode: $($proc.ExitCode)): $errOut"
        }
    } else {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "gpg"
        $psi.Arguments = "--batch --yes --decrypt --passphrase-fd 0 --output `"$tempDataPath`" `"$dataGpgPath`""
        $psi.UseShellExecute = $false
        $psi.RedirectStandardInput = $true
        $psi.RedirectStandardError = $true
        $proc = [System.Diagnostics.Process]::Start($psi)
        $proc.StandardInput.WriteLine($plainGpgPass)
        $proc.StandardInput.Flush()
        $proc.StandardInput.Close()
        $errOut = $proc.StandardError.ReadToEnd()
        $proc.WaitForExit()
        
        if ($proc.ExitCode -ne 0 -or -not (Test-Path $tempDataPath)) {
            throw "Native GPG decryption failed (ExitCode: $($proc.ExitCode)): $errOut"
        }
    }

    # Ensure decrypted data payload is strictly UTF-8 without BOM
    $bomRemoved = Remove-LeadingBom -FilePath $tempDataPath
    if ($bomRemoved) {
        Write-Host "  [OK] Stripped leading UTF-8 BOM from decrypted data payload (byte-exact preservation)." -ForegroundColor Gray
    }
    Write-Host "  [OK] Data payload decrypted successfully." -ForegroundColor Green

    # ==============================================================================
    # 6. Sanitize Pre-Data DDL & Prepare Inputs Without BOM
    # ==============================================================================
    Write-Host "`n[4/6] Sanitizing pre-data DDL & preparing UTF-8 inputs without BOM..." -ForegroundColor Yellow

    Sanitize-StagingPreDataSql -SourcePath $preDataPath -DestinationPath $cleanPreDataPath
    Prepare-StagingPostDataSql -SourcePath $postDataPath -DestinationPath $cleanPostDataPath

    Write-Host "  [OK] Filtered schema drop/create statements." -ForegroundColor Green
    Write-Host "  [OK] Preserved Supabase public schema ownership and active ensure_rls event trigger." -ForegroundColor Green
    Write-Host "  [OK] Generated clean_staging_pre_data.tmp.sql and clean_staging_post_data.tmp.sql strictly as UTF-8 without BOM." -ForegroundColor Green

    # ==============================================================================
    # 7. Single-Transaction Atomic Restoration (--single-transaction, ON_ERROR_STOP=1)
    # ==============================================================================
    Write-Host "`n[5/6] Executing atomic restoration into Singapore Staging..." -ForegroundColor Yellow
    Write-Host "  Connection Host: $targetHost`:$targetPort"
    Write-Host "  Single Transaction: ENABLED (All DDL, data, and constraints atomic)"
    Write-Host "  Client Encoding: UTF-8 (PGCLIENTENCODING=UTF8)"
    Write-Host "  Execution Mode: Direct multi-file -f flags (zero stdin piping)"

    # Execute direct multi-file psql inside Docker container
    $dockerBackupMount = "${absBackupDir}:/backup:ro"

    $dockerPsi = New-Object System.Diagnostics.ProcessStartInfo
    $dockerPsi.FileName = "docker"
    $dockerPsi.Arguments = "run -i --rm -e PGPASSWORD=$plainDbPass -e PGSSLMODE=require -e PGCLIENTENCODING=UTF8 -v $dockerBackupMount postgres:17-alpine psql -h $targetHost -p $targetPort -U $targetUser -d $targetDb -v ON_ERROR_STOP=1 --single-transaction --quiet -f /backup/clean_staging_pre_data.tmp.sql -f /backup/staging_data.tmp.sql -f /backup/clean_staging_post_data.tmp.sql"
    $dockerPsi.UseShellExecute = $false
    $dockerPsi.RedirectStandardOutput = $true
    $dockerPsi.RedirectStandardError = $true
    $dockerPsi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
    $dockerPsi.StandardErrorEncoding = [System.Text.Encoding]::UTF8
    
    $dProc = [System.Diagnostics.Process]::Start($dockerPsi)
    $dOut = $dProc.StandardOutput.ReadToEnd()
    $dErr = $dProc.StandardError.ReadToEnd()
    $dProc.WaitForExit()

    if ($dProc.ExitCode -ne 0) {
        Write-Host "PostgreSQL Error Output:" -ForegroundColor Red
        Write-Host $dErr -ForegroundColor Red
        throw "Database restore failed with exit code $($dProc.ExitCode). Transaction was automatically rolled back."
    }

    Write-Host "  [SUCCESS] All pre-data DDL, data rows, and post-data constraints committed atomically!" -ForegroundColor Green

    # ==============================================================================
    # 8. Automated Post-Restore Baseline Verification
    # ==============================================================================
    Verify-SingaporeStagingBaseline `
        -TargetHost $targetHost `
        -TargetPort $targetPort `
        -TargetUser $targetUser `
        -TargetDb $targetDb `
        -PlainPassword $plainDbPass `
        -ManifestPath $manifestPath `
        -RequireSsl
}
finally {
    # ==============================================================================
    # 9. Deterministic Plaintext Cleanup & Credential Purge
    # ==============================================================================
    Write-Host "`n[CLEANUP] Executing deterministic plaintext cleanup..." -ForegroundColor Gray
    if (Test-Path $tempDataPath) {
        Remove-Item -Force $tempDataPath 2>$null
        Write-Host "  [CLEANUP] Deleted temporary decrypted data file: $tempDataPath" -ForegroundColor Gray
    }
    if (Test-Path $cleanPreDataPath) {
        Remove-Item -Force $cleanPreDataPath 2>$null
        Write-Host "  [CLEANUP] Deleted temporary pre-data DDL file: $cleanPreDataPath" -ForegroundColor Gray
    }
    if (Test-Path $cleanPostDataPath) {
        Remove-Item -Force $cleanPostDataPath 2>$null
        Write-Host "  [CLEANUP] Deleted temporary post-data constraints file: $cleanPostDataPath" -ForegroundColor Gray
    }

    # Verify absence of plaintext data
    if ((Test-Path $tempDataPath) -or (Test-Path $cleanPreDataPath) -or (Test-Path $cleanPostDataPath)) {
        Write-Host "  [WARNING] Failed to remove decrypted temporary data files!" -ForegroundColor Red
    } else {
        Write-Host "  [CLEANUP] Verified: 0 plaintext dump files remain on disk." -ForegroundColor Green
    }

    # Purge credentials from process scope
    $plainDbPass = $null
    $plainGpgPass = $null
    [System.GC]::Collect()
}
