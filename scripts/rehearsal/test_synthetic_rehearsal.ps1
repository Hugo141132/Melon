<#
.SYNOPSIS
    Tests the complete end-to-end snapshot export, encryption, restore, and verification
    on synthetic local Docker containers to validate all scripts prior to operator execution.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "  KEBUN MELON: SYNTHETIC END-TO-END REHEARSAL & SNAPSHOT PREFLIGHT TEST" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan

$sourceContainer = "kebun-melon-synth-source"
$targetContainer = "kebun-melon-synth-target"
$synthDir = "backups/synthetic_test"

try {
    # 1. Clean up any previous synthetic containers
    docker rm -f $sourceContainer $targetContainer 2>$null | Out-Null
    if (Test-Path $synthDir) { Remove-Item -Recurse -Force $synthDir }
    New-Item -ItemType Directory -Path $synthDir -Force | Out-Null

    # 2. Start Source Container
    Write-Host "`n[1/6] Starting synthetic source database container..." -ForegroundColor Yellow
    docker run -d --name $sourceContainer -e POSTGRES_PASSWORD=synthpass postgres:17-alpine | Out-Null
    
    # Wait for ready
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        $null = docker exec $sourceContainer pg_isready -U postgres 2>&1
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    }
    if (-not $ready) { throw "Source container failed to start." }

    # Setup source schema with roles, extensions, tables, foreign keys, and RLS
    Write-Host "Seeding synthetic source schema and tables..." -ForegroundColor Yellow
    $seedSql = @"
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator LOGIN;
GRANT anon, authenticated, service_role TO authenticator;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE parent_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_code VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sensor_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES parent_nodes(id) ON DELETE CASCADE,
    metric_val DOUBLE PRECISION NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial data
INSERT INTO parent_nodes (id, node_code) VALUES 
('11111111-1111-1111-1111-111111111111', 'NODE-01'),
('22222222-2222-2222-2222-222222222222', 'NODE-02');

INSERT INTO sensor_readings (id, node_id, metric_val) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 25.4),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 7.2);
"@
    $seedSql | docker exec -i $sourceContainer psql -U postgres -d postgres -v ON_ERROR_STOP=1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Seeding source database failed." }
    Write-Host "Source database initialized with 2 parent rows and 2 child rows." -ForegroundColor Green

    # 3. Test Snapshot Export with Concurrent Writes
    Write-Host "`n[2/6] Testing consistent snapshot export with concurrent writes..." -ForegroundColor Yellow
    
    # Start Snapshot Holder process
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "docker"
    $psi.Arguments = "exec -i $sourceContainer psql -U postgres -d postgres -q"
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $holderProc = [System.Diagnostics.Process]::Start($psi)

    $holderProc.StandardInput.WriteLine("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;")
    $holderProc.StandardInput.WriteLine("SELECT pg_export_snapshot();")
    $holderProc.StandardInput.Flush()

    $snapshotId = ""
    while (-not $holderProc.StandardOutput.EndOfStream) {
        $line = $holderProc.StandardOutput.ReadLine().Trim()
        if ($line -match "^[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9A-Fa-f]+$") {
            $snapshotId = $line
            break
        }
    }

    if ([string]::IsNullOrWhiteSpace($snapshotId)) {
        throw "Failed to export snapshot ID from PostgreSQL."
    }
    Write-Host "Exported Snapshot ID: $snapshotId (Holding transaction active...)" -ForegroundColor Green

    # Concurrent Write in a separate connection (SIMULATING LIVE TRAFFIC DURING EXPORT)
    Write-Host "Simulating concurrent write during export..." -ForegroundColor Yellow
    docker exec $sourceContainer psql -U postgres -d postgres -c `
        "INSERT INTO parent_nodes (id, node_code) VALUES ('33333333-3333-3333-3333-333333333333', 'NODE-03-CONCURRENT');" | Out-Null

    # Export Pre-data, Data, Post-data using the snapshot
    $preDataFile = Join-Path $synthDir "synth_pre_data.sql"
    $dataFile = Join-Path $synthDir "synth_data.sql"
    $postDataFile = Join-Path $synthDir "synth_post_data.sql"
    $manifestFile = Join-Path $synthDir "synth_manifest.tsv"

    Write-Host "Dumping pre-data DDL using snapshot..." -ForegroundColor Yellow
    docker exec $sourceContainer pg_dump -U postgres -d postgres --section=pre-data `
        --no-owner --no-privileges --snapshot=$snapshotId | Out-File -FilePath $preDataFile -Encoding utf8
    if ($LASTEXITCODE -ne 0) { throw "Pre-data export failed." }

    Write-Host "Dumping table data using snapshot..." -ForegroundColor Yellow
    docker exec $sourceContainer pg_dump -U postgres -d postgres --section=data --inserts `
        --no-owner --no-privileges --snapshot=$snapshotId | Out-File -FilePath $dataFile -Encoding utf8
    if ($LASTEXITCODE -ne 0) { throw "Data export failed." }

    Write-Host "Dumping post-data constraints using snapshot..." -ForegroundColor Yellow
    docker exec $sourceContainer pg_dump -U postgres -d postgres --section=post-data `
        --no-owner --no-privileges --snapshot=$snapshotId | Out-File -FilePath $postDataFile -Encoding utf8
    if ($LASTEXITCODE -ne 0) { throw "Post-data export failed." }

    # Query Manifest using the snapshot
    Write-Host "Generating table row count manifest using snapshot..." -ForegroundColor Yellow
    $manifestSql = @"
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET TRANSACTION SNAPSHOT '$snapshotId';
SELECT tablename || E'\t' || count_val
FROM (
  SELECT 'parent_nodes' AS tablename, count(*)::text AS count_val FROM public.parent_nodes
  UNION ALL
  SELECT 'sensor_readings', count(*)::text FROM public.sensor_readings
) q
ORDER BY tablename;
COMMIT;
"@
    $manifestOutput = $manifestSql | docker exec -i $sourceContainer psql -U postgres -d postgres -t -A
    if ($LASTEXITCODE -ne 0) { throw "Manifest query failed." }
    $manifestLines = ($manifestOutput -split "`r?`n") | Where-Object { $_ -match "^[a-zA-Z0-9_]+`t\d+$" }
    $manifestLines | Out-File -FilePath $manifestFile -Encoding utf8

    # Close snapshot holder
    $holderProc.StandardInput.WriteLine("COMMIT;")
    $holderProc.StandardInput.Flush()
    $holderProc.StandardInput.Close()
    $holderProc.WaitForExit()
    Write-Host "Snapshot transaction closed." -ForegroundColor Green

    # Verify Snapshot Consistency:
    # Source DB now has 3 parent_nodes rows, but snapshot dump & manifest MUST HAVE EXACTLY 2!
    $dataContent = Get-Content $dataFile -Raw
    $parentInsertsInDump = [regex]::Matches($dataContent, "INSERT INTO public\.parent_nodes").Count
    $manifestLines = Get-Content $manifestFile
    $parentManifestLine = ($manifestLines | Where-Object { $_ -match "^parent_nodes`t" })
    $parentManifestCount = $parentManifestLine.Split("`t")[1]

    Write-Host "`n[Consistency Verification Results]" -ForegroundColor Cyan
    Write-Host "  Live table count in source DB : 3 (includes concurrent insert)"
    Write-Host "  Parent inserts in data dump   : $parentInsertsInDump"
    Write-Host "  Parent count in manifest      : $parentManifestCount"

    if ($parentInsertsInDump -ne 2 -or $parentManifestCount -ne 2) {
        throw "SNAPSHOT CONSISTENCY VIOLATION: Dump and manifest saw concurrent write!"
    }
    Write-Host "SNAPSHOT CONSISTENCY CONFIRMED: Dump and manifest share exactly one snapshot!" -ForegroundColor Green

    # 4. Test Encryption, Checksum, and Decryption Validation
    Write-Host "`n[3/6] Testing GPG symmetric encryption and checksum validation..." -ForegroundColor Yellow
    $encryptedFile = "$dataFile.gpg"
    $testPassphrase = "TestPassphrase123!Secure"
    
    # Encrypt data dump using GPG in WSL Ubuntu
    $winDataFile = (Resolve-Path $dataFile).Path
    $wslDataFile = ($winDataFile -replace '\\', '/' -replace 'C:', '/mnt/c')
    $wslEncFile = "$wslDataFile.gpg"
    
    wsl -d Ubuntu -- gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase $testPassphrase -o $wslEncFile $wslDataFile
    if ($LASTEXITCODE -ne 0) { throw "GPG encryption failed." }
    Write-Host "Encrypted data file generated: $encryptedFile" -ForegroundColor Green

    # Test decryption to verify passphrase & integrity
    $verifyTempFile = Join-Path $synthDir "verify_data.tmp"
    $wslVerifyFile = ($verifyTempFile -replace '\\', '/' -replace 'C:', '/mnt/c')
    wsl -d Ubuntu -- gpg --batch --yes --decrypt --passphrase $testPassphrase -o $wslVerifyFile $wslEncFile
    if ($LASTEXITCODE -ne 0) { throw "GPG decryption verification failed." }

    $hashOriginal = (Get-FileHash -Algorithm SHA256 $dataFile).Hash
    $hashDecrypted = (Get-FileHash -Algorithm SHA256 $verifyTempFile).Hash
    Remove-Item $verifyTempFile -Force

    if ($hashOriginal -ne $hashDecrypted) {
        throw "DECRYPTION INTEGRITY FAILED: Decrypted file hash does not match original!"
    }
    Write-Host "Decryption round-trip verified (SHA-256 match: $hashOriginal)." -ForegroundColor Green

    # Secure cleanup: Remove unencrypted data file
    Remove-Item $dataFile -Force
    Write-Host "Unencrypted data dump removed; only .gpg retained." -ForegroundColor Green

    # 5. Test Restore onto Isolated Rehearsal Target
    Write-Host "`n[4/6] Starting synthetic rehearsal target database container..." -ForegroundColor Yellow
    docker run -d --name $targetContainer -e POSTGRES_PASSWORD=rehearsalpass postgres:17-alpine | Out-Null
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        $null = docker exec $targetContainer pg_isready -U postgres 2>&1
        if ($LASTEXITCODE -eq 0) { break }
    }

    Write-Host "Scaffolding target database with roles and extensions..." -ForegroundColor Yellow
    Get-Content -Raw "scripts/rehearsal/01_scaffold_rehearsal.sql" | docker exec -i $targetContainer psql -U postgres -d postgres -v ON_ERROR_STOP=1 | Out-Null

    Write-Host "Restoring Pre-Data DDL..." -ForegroundColor Yellow
    Get-Content -Raw $preDataFile | docker exec -i $targetContainer psql -U postgres -d postgres -v ON_ERROR_STOP=1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Restoring pre-data failed." }

    Write-Host "Decrypting and restoring Table Data (with replica replication role)..." -ForegroundColor Yellow
    # Decrypt in WSL and pipe directly to docker target
    wsl -d Ubuntu -- gpg --batch --yes --decrypt --passphrase $testPassphrase $wslEncFile |
        docker exec -i $targetContainer psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "SET session_replication_role = replica;" -f - | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Restoring data failed." }

    Write-Host "Restoring Post-Data Constraints & Foreign Keys..." -ForegroundColor Yellow
    Get-Content -Raw $postDataFile | docker exec -i $targetContainer psql -U postgres -d postgres -v ON_ERROR_STOP=1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Restoring post-data failed." }

    # 6. Apply Security Hardening & Verify Effective Privileges
    Write-Host "`n[5/6] Applying security hardening and testing effective privileges..." -ForegroundColor Yellow
    Get-Content -Raw "scripts/rehearsal/02_post_restore_security.sql" | docker exec -i $targetContainer psql -U postgres -d postgres -v ON_ERROR_STOP=1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Applying post-restore security failed." }

    # Test Effective Privileges (Anon/Authenticated must have 0 access; Postgres must have full access)
    $privTestSql = @"
SELECT 
  has_table_privilege('anon', 'public.parent_nodes', 'SELECT') AS anon_can_select,
  has_table_privilege('public', 'public.parent_nodes', 'SELECT') AS public_can_select,
  has_table_privilege('postgres', 'public.parent_nodes', 'SELECT') AS postgres_can_select,
  has_table_privilege('service_role', 'public.parent_nodes', 'SELECT') AS service_can_select;
"@
    $privResults = $privTestSql | docker exec -i $targetContainer psql -U postgres -d postgres -t -A
    Write-Host "Privilege Check Results (anon, public, postgres, service_role): $privResults"
    if ($privResults -ne "f|f|t|t") {
        throw "EFFECTIVE PRIVILEGE TEST FAILED! Expected f|f|t|t, got $privResults"
    }
    Write-Host "Effective privileges verified: anon/public blocked, postgres/service_role permitted." -ForegroundColor Green

    # Test Foreign Key Integrity (Check for orphaned rows)
    Write-Host "Verifying real Foreign Key referential integrity..." -ForegroundColor Yellow
    $fkAuditSql = @"
SELECT count(*) 
FROM public.sensor_readings c 
LEFT JOIN public.parent_nodes p ON c.node_id = p.id 
WHERE c.node_id IS NOT NULL AND p.id IS NULL;
"@
    $orphans = ($fkAuditSql | docker exec -i $targetContainer psql -U postgres -d postgres -t -A).Trim()
    if ($orphans -ne "0") {
        throw "FK INTEGRITY FAILURE: Found $orphans orphaned sensor readings!"
    }
    Write-Host "Foreign key integrity verified: 0 orphaned rows." -ForegroundColor Green

    # Verify Manifest Parity
    Write-Host "Verifying row count parity against snapshot manifest..." -ForegroundColor Yellow
    foreach ($mLine in $manifestLines) {
        if ([string]::IsNullOrWhiteSpace($mLine)) { continue }
        $parts = $mLine.Split("`t")
        $tbl = $parts[0]
        $exp = [int64]$parts[1]
        $actual = [int64](docker exec $targetContainer psql -U postgres -d postgres -t -A -c "SELECT count(*) FROM public.`"$tbl`";").Trim()
        if ($exp -ne $actual) {
            throw "Row count mismatch for ${tbl}: expected $exp, got $actual"
        }
        Write-Host "  [PARITY PASS] $tbl : $actual rows match snapshot manifest exactly." -ForegroundColor Green
    }

    Write-Host "`n========================================================================" -ForegroundColor Green
    Write-Host "  ALL PREFLIGHT CHECKS PASSED: SYNTHETIC REHEARSAL 100% SUCCESSFUL" -ForegroundColor Green
    Write-Host "========================================================================" -ForegroundColor Green
}
finally {
    Write-Host "`n[6/6] Cleaning up synthetic test containers..." -ForegroundColor Yellow
    docker rm -f $sourceContainer $targetContainer 2>$null | Out-Null
    if (Test-Path $synthDir) { Remove-Item -Recurse -Force $synthDir }
    Write-Host "Synthetic test containers and temporary files cleaned up." -ForegroundColor Green
}
