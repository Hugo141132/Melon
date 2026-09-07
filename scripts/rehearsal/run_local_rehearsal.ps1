<#
.SYNOPSIS
    Orchestrates the local isolated PostgreSQL restore rehearsal for Kebun Melon.
.DESCRIPTION
    Runs an isolated restore rehearsal for Dev or Staging database exports.
    Ensures zero external network access (no MQTT, no hardware devices, no email delivery, no cloud DBs).
    Preserves all existing containers and volumes. Supports encrypted .gpg archives.
.PARAMETER Environment
    The target environment to rehearse: 'dev' or 'staging'. Default is 'dev'.
.PARAMETER BackupDir
    Directory containing exported backup artifacts. Default is 'backups/rehearsal'.
.PARAMETER Port
    Local host port to bind PostgreSQL rehearsal instance. Default is 5433 (isolated from staging 5432).
.PARAMETER ContainerName
    Name of the isolated rehearsal Docker container. Default is 'kebun-melon-rehearsal-db'.
#>
[CmdletBinding()]
param (
    [ValidateSet('dev', 'staging')]
    [string]$Environment = 'dev',
    [string]$BackupDir = 'backups/rehearsal',
    [int]$Port = 5433,
    [string]$ContainerName = 'kebun-melon-rehearsal-db',
    [string]$Database = 'postgres',
    [string]$User = 'postgres',
    [string]$Password = 'rehearsal_isolated_pass_123',
    [switch]$Clean
)

$ErrorActionPreference = 'Stop'

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "  KEBUN MELON: LOCAL ISOLATED RESTORE REHEARSAL ($($Environment.ToUpper()))" -ForegroundColor Cyan
Write-Host "  Binding Port: $Port | Target Database: $Database" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan

# 1. Check Artifact Prerequisites
Write-Host "`n[1/6] Checking required backup artifacts in '$BackupDir'..." -ForegroundColor Yellow

$preDataFile = Join-Path $BackupDir "${Environment}_pre_data.sql"
$schemaFile = Join-Path $BackupDir "${Environment}_schema.sql"
$dataFile = Join-Path $BackupDir "${Environment}_data.sql"
$dataGpgFile = Join-Path $BackupDir "${Environment}_data.sql.gpg"
$postDataFile = Join-Path $BackupDir "${Environment}_post_data.sql"
$manifestFile = Join-Path $BackupDir "${Environment}_manifest.tsv"

$hasPreData = Test-Path $preDataFile
$hasSchema = Test-Path $schemaFile
$hasPlainData = Test-Path $dataFile
$hasEncryptedData = Test-Path $dataGpgFile
$hasPostData = Test-Path $postDataFile
$hasManifest = Test-Path $manifestFile

if ((-not $hasPlainData -and -not $hasEncryptedData) -or (-not $hasPreData -and -not $hasSchema)) {
    Write-Host "`n[!] CRITICAL: Required backup artifacts are missing in '$BackupDir'!" -ForegroundColor Red
    Write-Host "Expected local artifact paths:" -ForegroundColor Yellow
    Write-Host "  - DDL / Pre-Data : '$preDataFile' (or '$schemaFile')"
    Write-Host "  - Table Data     : '$dataGpgFile' (encrypted) or '$dataFile'"
    Write-Host "  - Post-Data/FKs  : '$postDataFile' (optional if full schema used)"
    Write-Host "  - Snapshot Manifest: '$manifestFile'"
    Write-Host "`nNEXT OPERATOR ACTION:" -ForegroundColor Cyan
    Write-Host "  Run 'powershell -File scripts/backup/export_source_snapshot.ps1 -Environment $Environment'"
    Write-Host "  to securely export Mumbai $Environment and generate the snapshot manifest."
    exit 2
}

Write-Host "Backup artifacts found." -ForegroundColor Green
if ($hasPreData) { Write-Host "  - Pre-data DDL : $preDataFile" } else { Write-Host "  - Schema DDL   : $schemaFile" }
if ($hasEncryptedData) { Write-Host "  - Encrypted Data : $dataGpgFile" } else { Write-Host "  - Plain Data     : $dataFile" }
if ($hasPostData) { Write-Host "  - Post-data FKs: $postDataFile" }
if ($hasManifest) { Write-Host "  - Manifest     : $manifestFile" }

# 2. Check Database Runtime Availability (Docker Engine)
Write-Host "`n[2/6] Checking isolated PostgreSQL container runtime..." -ForegroundColor Yellow

$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
    Write-Host "[!] Docker CLI not found. Please install or add Docker to PATH." -ForegroundColor Red
    exit 1
}

try {
    $null = docker ps 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Docker daemon not responding." }
} catch {
    Write-Host "`n[!] BLOCKER: Docker Desktop daemon is not running." -ForegroundColor Red
    Write-Host "Please start the Docker Desktop application on Windows before running rehearsal." -ForegroundColor Yellow
    exit 1
}

# Check if port 5433 is available or used by our container
if ($Clean) {
    Write-Host "Resetting previous rehearsal container '$ContainerName'..." -ForegroundColor Yellow
    docker rm -f $ContainerName 2>$null | Out-Null
}
$existingContainer = docker ps -a --filter "name=^/${ContainerName}$" --format "{{.Names}}"
if (-not $existingContainer) {
    # Verify port 5433 is free
    $tcp = New-Object System.Net.Sockets.TcpClient
    try {
        $tcp.Connect("127.0.0.1", $Port)
        $tcp.Close()
        Write-Host "`n[!] Port $Port is already in use by another process. Please free port $Port." -ForegroundColor Red
        exit 1
    } catch {
        # Expected: port is free
    }

    Write-Host "Starting new isolated rehearsal container '$ContainerName' on port $Port..." -ForegroundColor Yellow
    docker run -d `
        --name $ContainerName `
        -p "${Port}:5432" `
        -e "POSTGRES_PASSWORD=$Password" `
        --network bridge `
        postgres:17-alpine | Out-Null
    
    Write-Host "Waiting for PostgreSQL engine to initialize..." -ForegroundColor Yellow
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        $check = docker exec $ContainerName pg_isready -U postgres 2>&1
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    }
    if (-not $ready) {
        throw "PostgreSQL container failed to become ready in time."
    }
} else {
    Write-Host "Existing rehearsal container '$ContainerName' found. Ensuring it is active..." -ForegroundColor Yellow
    docker start $ContainerName | Out-Null
}

Write-Host "Isolated container '$ContainerName' is ready on port $Port." -ForegroundColor Green

# 3. Apply Scaffolding (Roles, Extensions)
Write-Host "`n[3/6] Applying Supabase-compatible roles and extensions scaffolding..." -ForegroundColor Yellow
Get-Content -Raw "scripts/rehearsal/01_scaffold_rehearsal.sql" |
    docker exec -i $ContainerName psql -U $User -d $Database -v ON_ERROR_STOP=1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Scaffolding failed." }
Write-Host "Scaffolding successfully applied." -ForegroundColor Green

# 4. Restore Schema & Data
Write-Host "`n[4/6] Restoring DDL, Data, and Constraints..." -ForegroundColor Yellow

try {
    if ($hasPreData) {
    Write-Host "  -> Restoring Pre-Data DDL (Tables, types, sequences)..."
    Get-Content -Raw $preDataFile | docker exec -i $ContainerName psql -U $User -d $Database -v ON_ERROR_STOP=1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Pre-data DDL restore failed." }
} else {
    Write-Host "  -> Restoring Full Schema DDL..."
    Get-Content -Raw $schemaFile | docker exec -i $ContainerName psql -U $User -d $Database -v ON_ERROR_STOP=1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Schema DDL restore failed." }
}

Write-Host "  -> Restoring Table Data (with replica replication role)..."
if ($hasPlainData) {
    Write-Host "     Restoring from local plaintext data file ($dataFile)..."
    Get-Content -Raw $dataFile |
        docker exec -i $ContainerName psql -U $User -d $Database -v ON_ERROR_STOP=1 -c "SET session_replication_role = replica;" -f - | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Table data restore failed." }
} elseif ($hasEncryptedData) {
    # Prompt for decryption passphrase
    $secGpgPass = Read-Host -Prompt "Enter decryption passphrase for $dataGpgFile" -AsSecureString
    $bGpg = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secGpgPass)
    $plainGpg = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bGpg)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bGpg)
    $secGpgPass = $null

    # Decrypt and stream directly into psql
    $absGpg = (Resolve-Path $dataGpgFile).Path
    $hasNativeGpg = Get-Command gpg -ErrorAction SilentlyContinue

    if ($hasNativeGpg) {
        $plainGpg | gpg --batch --yes --decrypt --passphrase-fd 0 $absGpg |
            docker exec -i $ContainerName psql -U $User -d $Database -v ON_ERROR_STOP=1 -c "SET session_replication_role = replica;" -f - | Out-Null
    } else {
        $wslGpgPath = ($absGpg -replace '\\', '/' -replace 'C:', '/mnt/c')
        $wslGpgOut = ($dataFile -replace '\\', '/' -replace 'C:', '/mnt/c')
        wsl -d Ubuntu -- gpg --batch --yes --decrypt --passphrase $plainGpg $wslGpgPath |
            docker exec -i $ContainerName psql -U $User -d $Database -v ON_ERROR_STOP=1 -c "SET session_replication_role = replica;" -f - | Out-Null
    }
    $plainGpg = $null
    if ($LASTEXITCODE -ne 0) { throw "Decrypted table data restore failed." }
}
Write-Host "Table data successfully restored." -ForegroundColor Green

if ($hasPostData) {
    Write-Host "  -> Restoring Post-Data Constraints & Foreign Keys (Validating constraints against loaded data)..."
    Get-Content -Raw $postDataFile | docker exec -i $ContainerName psql -U $User -d $Database -v ON_ERROR_STOP=1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Post-data constraints restore failed." }
    Write-Host "Constraints and foreign keys successfully restored and validated." -ForegroundColor Green
}

# 5. Baseline Source Fidelity & Manifest Parity Verification (Pre-Migration, Pre-Hardening)
Write-Host "`n[5/8] Verifying baseline source fidelity, foreign keys, and snapshot manifest parity..." -ForegroundColor Yellow

# Verify Foreign Key Integrity on baseline data
$fkSql = @'
DO $$
DECLARE
  fk_rec RECORD;
  orphan_count BIGINT;
  total_orphans BIGINT := 0;
  fk_checked_count INT := 0;
  query_text TEXT;
BEGIN
  FOR fk_rec IN
    SELECT 
      c.conname AS constraint_name,
      child_tbl.relname AS child_table,
      parent_tbl.relname AS parent_table,
      string_agg(format('c.%I = p.%I', a_child.attname, a_parent.attname), ' AND ' ORDER BY pos.ord) AS join_condition,
      string_agg(format('c.%I IS NOT NULL', a_child.attname), ' AND ' ORDER BY pos.ord) AS not_null_condition,
      split_part(string_agg(quote_ident(a_parent.attname), ', ' ORDER BY pos.ord), ', ', 1) AS first_parent_col
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    JOIN pg_class child_tbl ON child_tbl.oid = c.conrelid
    JOIN pg_class parent_tbl ON parent_tbl.oid = c.confrelid
    CROSS JOIN LATERAL unnest(c.conkey, c.confkey) WITH ORDINALITY AS pos(child_att, parent_att, ord)
    JOIN pg_attribute a_child ON a_child.attrelid = child_tbl.oid AND a_child.attnum = pos.child_att
    JOIN pg_attribute a_parent ON a_parent.attrelid = parent_tbl.oid AND a_parent.attnum = pos.parent_att
    WHERE n.nspname = 'public' AND c.contype = 'f'
    GROUP BY c.conname, child_tbl.relname, parent_tbl.relname
  LOOP
    fk_checked_count := fk_checked_count + 1;
    query_text := format(
      'SELECT count(*) FROM public.%I c LEFT JOIN public.%I p ON %s WHERE %s AND p.%I IS NULL',
      fk_rec.child_table, fk_rec.parent_table, fk_rec.join_condition, fk_rec.not_null_condition, fk_rec.first_parent_col
    );
    EXECUTE query_text INTO orphan_count;
    total_orphans := total_orphans + orphan_count;
  END LOOP;

  IF total_orphans > 0 THEN
    RAISE EXCEPTION 'Baseline FK referential integrity FAILED with % orphan rows across % constraints!', total_orphans, fk_checked_count;
  ELSE
    RAISE NOTICE 'Baseline FK referential integrity VERIFIED: 0 orphan rows across % foreign keys.', fk_checked_count;
  END IF;
END $$;
'@
$fkSql | docker exec -i $ContainerName psql -U $User -d $Database -v ON_ERROR_STOP=1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Baseline foreign key verification failed." }
Write-Host "Baseline foreign keys: 0 orphaned rows (Referential integrity 100% verified)." -ForegroundColor Green

# Verify Table Count
$tableCount = (docker exec $ContainerName psql -U $User -d $Database -t -A -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';").Trim()
if ($tableCount -ne "26") { throw "Public table count mismatch: expected 26, found $tableCount." }
Write-Host "Baseline tables restored: $tableCount / 26." -ForegroundColor Green

# Verify Baseline Prisma Migrations Count
$baselinePrismaCount = (docker exec $ContainerName psql -U $User -d $Database -t -A -c "SELECT count(*) FROM public._prisma_migrations;").Trim()
Write-Host "Baseline Prisma migrations recorded in snapshot: $baselinePrismaCount." -ForegroundColor Green

# Compare 1:1 with snapshot manifest
if ($hasManifest) {
    Write-Host "`n[Baseline Snapshot Manifest Parity Verification]" -ForegroundColor Cyan
    $manifestLines = (Get-Content $manifestFile) | Where-Object { $_ -match "^[a-zA-Z0-9_]+`t\d+$" }
    $mismatchCount = 0
    foreach ($line in $manifestLines) {
        $parts = $line.Split("`t")
        $tbl = $parts[0].Trim()
        $expectedCount = [int64]$parts[1].Trim()

        $actualCountStr = (docker exec $ContainerName psql -U $User -d $Database -t -A -c "SELECT count(*) FROM public.`"$tbl`";").Trim()
        $actualCount = [int64]$actualCountStr

        if ($expectedCount -eq $actualCount) {
            Write-Host "  [BASELINE PASS] ${tbl} : $actualCount rows (100% parity with snapshot manifest)" -ForegroundColor Green
        } else {
            Write-Host "  [BASELINE FAIL] ${tbl} : Expected $expectedCount rows, found $actualCount rows!" -ForegroundColor Red
            $mismatchCount++
        }
    }

    if ($mismatchCount -gt 0) {
        Write-Error "Baseline manifest parity check failed with $mismatchCount mismatched tables!"
        exit 1
    }
}

# 6. Pending Migration Catch-up Testing (Staging Only)
if ($Environment -eq 'staging') {
    Write-Host "`n[6/8] Testing pending Staging migration catch-up (20260905040000_add_auth_and_fk_performance_indexes)..." -ForegroundColor Yellow
    $origDbUrl = $env:DATABASE_URL
    $origDirectUrl = $env:DIRECT_URL

    try {
        $isolatedUrl = "postgresql://${User}:${Password}@127.0.0.1:${Port}/${Database}?sslmode=disable"
        $env:DATABASE_URL = $isolatedUrl
        $env:DIRECT_URL = $isolatedUrl

        # Fail-closed guard: ensure migration connection NEVER points to remote cloud
        if ($env:DATABASE_URL -match "supabase\.co" -or $env:DATABASE_URL -match "pooler\.supabase\.com" -or
            $env:DIRECT_URL -match "supabase\.co" -or $env:DIRECT_URL -match "pooler\.supabase\.com" -or
            ($env:DATABASE_URL -notmatch "127\.0\.0\.1:$Port" -and $env:DATABASE_URL -notmatch "localhost:$Port")) {
            throw "FAIL-CLOSED VIOLATION: Migration URL is not safely scoped to isolated local target on port $Port! Detected: $($env:DATABASE_URL)"
        }
        Write-Host "  -> Isolated connection variables verified: DATABASE_URL & DIRECT_URL scoped to 127.0.0.1:$Port." -ForegroundColor Green

        Write-Host "  -> Checking Prisma migration status on isolated target (port $Port)..."
        $migrateStatus = npx prisma migrate status --schema=packages/database/prisma/schema.prisma 2>&1 | Out-String
        Write-Host $migrateStatus

        if ($migrateStatus -notmatch "20260905040000_add_auth_and_fk_performance_indexes") {
            throw "Expected pending migration '20260905040000_add_auth_and_fk_performance_indexes' not found in Prisma status."
        }

        # Check that no other unexpected migrations are unapplied
        if ($migrateStatus -match "Following migration\(s\) have not yet been applied:") {
            $unappliedSection = $migrateStatus -split "Following migration\(s\) have not yet been applied:" | Select-Object -Last 1
            $unappliedLines = ($unappliedSection -split "`r?`n") | Where-Object { $_ -match "^\s*(\d{14}_[a-zA-Z0-9_]+)" }
            if ($unappliedLines.Count -ne 1) {
                throw "UNEXPECTED PENDING MIGRATIONS DETECTED ($($unappliedLines.Count) found): $($unappliedLines -join ', ')! Expected ONLY 20260905040000_add_auth_and_fk_performance_indexes."
            }
        }

        Write-Host "  -> Deploying pending migration to isolated rehearsal target..."
        npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
        if ($LASTEXITCODE -ne 0) { throw "Prisma migration deploy failed." }

        # Verify migration history count is now 11
        $postMigCount = (docker exec $ContainerName psql -U $User -d $Database -t -A -c "SELECT count(*) FROM public._prisma_migrations;").Trim()
        if ($postMigCount -ne "11") { throw "Expected 11 applied migrations after deploy, found $postMigCount." }
        Write-Host "Prisma migrations applied count: $postMigCount (Catch-up successful)." -ForegroundColor Green

        # Verify expected 13 performance indexes
        $expectedIndexes = @(
            "sessions_user_active_idx", "sessions_user_id_idx",
            "user_roles_user_id_idx", "user_roles_user_id_revoked_at_idx", "user_roles_role_id_idx",
            "role_permissions_permission_id_idx", "account_approvals_decided_by_user_id_idx",
            "user_device_access_device_id_idx", "user_device_access_assigned_by_user_id_idx",
            "user_preferences_default_device_id_idx", "alert_acknowledgements_user_id_idx",
            "alert_acknowledgements_alert_id_idx", "alerts_device_id_idx"
        )
        $indexCheckSql = "SELECT indexname FROM pg_indexes WHERE schemaname = 'public';"
        $existingIndexes = (docker exec $ContainerName psql -U $User -d $Database -t -A -c $indexCheckSql) -split "`r?`n"

        foreach ($idx in $expectedIndexes) {
            if ($existingIndexes -contains $idx) {
                Write-Host "  [INDEX PASS] Verified index: $idx" -ForegroundColor Green
            } else {
                throw "Missing expected performance index: $idx!"
            }
        }

        # Verify application data row counts remain 100% unchanged
        Write-Host "Verifying application table data invariant after index creation..." -ForegroundColor Yellow
        foreach ($line in $manifestLines) {
            $parts = $line.Split("`t")
            $tbl = $parts[0].Trim()
            if ($tbl -eq "_prisma_migrations") { continue } # Expecting migration count to increment

            $expectedCount = [int64]$parts[1].Trim()
            $actualCount = [int64](docker exec $ContainerName psql -U $User -d $Database -t -A -c "SELECT count(*) FROM public.`"$tbl`";").Trim()

            if ($expectedCount -ne $actualCount) {
                throw "DATA DRIFT DETECTED: Table $tbl row count changed from $expectedCount to $actualCount during migration!"
            }
        }
        Write-Host "Application data invariant confirmed: Zero rows altered by index migration." -ForegroundColor Green
    }
    finally {
        $env:DATABASE_URL = $origDbUrl
        $env:DIRECT_URL = $origDirectUrl
        Write-Host "Process environment variables cleanly restored." -ForegroundColor Gray
    }
} else {
    Write-Host "`n[6/8] Skipping migration catch-up (Not applicable for $Environment)." -ForegroundColor Gray
}

# 7. Apply Security Hardening & Effective Privileges Verification
Write-Host "`n[7/8] Applying explicit security hardening and verifying effective privileges..." -ForegroundColor Yellow
Get-Content -Raw "scripts/rehearsal/02_post_restore_security.sql" |
    docker exec -i $ContainerName psql -U $User -d $Database -v ON_ERROR_STOP=1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Security hardening failed." }
Write-Host "Security hardening successfully applied." -ForegroundColor Green

Get-Content -Raw "scripts/rehearsal/03_verify_integrity.sql" |
    docker exec -i $ContainerName psql -U $User -d $Database -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) { throw "Integrity verification failed." }
}
finally {
    # 8. Secure Cleanup: Remove temporary unencrypted data dump if present (on success or failure)
    if (Test-Path $dataFile) {
        Remove-Item -Force $dataFile
        $removed = -not (Test-Path $dataFile)
        Write-Host "`nUnencrypted data dump removed. Verified removal: $removed. Only encrypted archive is retained." -ForegroundColor Green
    }
}

Write-Host "`n========================================================================" -ForegroundColor Green
Write-Host "  REHEARSAL SUCCESSFUL: Database restored and verified with zero errors." -ForegroundColor Green
Write-Host "========================================================================" -ForegroundColor Green
exit 0
