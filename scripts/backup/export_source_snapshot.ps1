<#
.SYNOPSIS
    Securely exports a point-in-time PostgreSQL backup snapshot and consistent table manifest.
.DESCRIPTION
    Executed by the operator. Prompts for credentials via Read-Host -AsSecureString.
    Holds a single REPEATABLE READ transaction open to export a synchronized snapshot ID.
    All dump sections (pre-data, data, post-data, schema) and the table manifest share
    the exact same snapshot. Symmetrically encrypts the data dump with GPG (AES-256),
    verifies decryption integrity, and cleans up unencrypted plaintext data.
.PARAMETER Environment
    The target environment: 'dev' or 'staging'. Default is 'dev'.
.PARAMETER OutputDir
    Directory to save backup artifacts. Default is 'backups/rehearsal'.
#>
[CmdletBinding()]
param (
    [ValidateSet('dev', 'staging')]
    [string]$Environment = 'dev',
    [string]$OutputDir = 'backups/rehearsal'
)

$ErrorActionPreference = 'Stop'

# Project connection mapping (Session Pooler Port 5432)
$projectConfig = @{
    'dev' = @{
        'Host' = 'aws-1-ap-south-1.pooler.supabase.com'
        'Port' = 5432
        'User' = 'postgres.xjsencdgfcbkzdzqcnqx'
        'Database' = 'postgres'
        'Ref' = 'xjsencdgfcbkzdzqcnqx'
    }
    'staging' = @{
        'Host' = 'aws-0-ap-south-1.pooler.supabase.com'
        'Port' = 5432
        'User' = 'postgres.scqrbtfilmttqrutynyo'
        'Database' = 'postgres'
        'Ref' = 'scqrbtfilmttqrutynyo'
    }
}

$cfg = $projectConfig[$Environment]

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "  KEBUN MELON: SECURE CONSISTENT SNAPSHOT EXPORT ($($Environment.ToUpper()))" -ForegroundColor Cyan
Write-Host "  Target Host: $($cfg.Host):$($cfg.Port) (Database: $($cfg.Database))" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan

# 1. Output Directory Guard
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

# 2. Check Prerequisites: Docker daemon & GPG
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
    Write-Host "[!] Docker CLI not found. Docker Desktop is required." -ForegroundColor Red
    exit 1
}
try {
    $null = docker ps 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Docker daemon not running." }
} catch {
    Write-Host "[!] Docker daemon is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Check for GPG in native PATH or WSL
$hasNativeGpg = Get-Command gpg -ErrorAction SilentlyContinue
$useWslGpg = $false
if (-not $hasNativeGpg) {
    $wslCheck = wsl -d Ubuntu -- which gpg 2>$null
    if ($LASTEXITCODE -eq 0 -and $wslCheck) {
        $useWslGpg = $true
    } else {
        Write-Host "[!] GPG is required for encryption but was not found in Windows PATH or WSL Ubuntu." -ForegroundColor Red
        exit 1
    }
}

# 3. Prompt for Database Password & Encryption Passphrase
$secPass = Read-Host -Prompt "Enter password for Mumbai $($Environment.ToUpper()) ($($cfg.User))" -AsSecureString
if ($null -eq $secPass -or $secPass.Length -eq 0) {
    Write-Error "Database password cannot be empty."
    exit 1
}

$secGpgPass = Read-Host -Prompt "Enter encryption passphrase for backup .gpg archive" -AsSecureString
if ($null -eq $secGpgPass -or $secGpgPass.Length -eq 0) {
    Write-Error "Encryption passphrase cannot be empty."
    exit 1
}

$bstrDb = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPass)
$plainDbPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstrDb)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstrDb)
$secPass = $null

$bstrGpg = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secGpgPass)
$plainGpgPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstrGpg)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstrGpg)
$secGpgPass = $null

$preDataPath = Join-Path $OutputDir "${Environment}_pre_data.sql"
$dataPath = Join-Path $OutputDir "${Environment}_data.sql"
$dataGpgPath = Join-Path $OutputDir "${Environment}_data.sql.gpg"
$postDataPath = Join-Path $OutputDir "${Environment}_post_data.sql"
$schemaPath = Join-Path $OutputDir "${Environment}_schema.sql"
$manifestPath = Join-Path $OutputDir "${Environment}_manifest.tsv"
$checksumsPath = Join-Path $OutputDir "${Environment}_checksums.sha256"

# Remove any previous incomplete files
@($preDataPath, $dataPath, $dataGpgPath, $postDataPath, $schemaPath, $manifestPath, $checksumsPath) |
    ForEach-Object { if (Test-Path $_) { Remove-Item -Force $_ } }

$holderProc = $null
$exportSuccess = $false

try {
    Write-Host "`n[1/6] Establishing Snapshot Holder transaction on remote database..." -ForegroundColor Yellow

    # Start interactive containerized psql process to hold the transaction
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "docker"
    $psi.Arguments = "run -i --rm -e PGPASSWORD=$plainDbPass -e PGSSLMODE=require postgres:17-alpine psql -h $($cfg.Host) -p $($cfg.Port) -U $($cfg.User) -d $($cfg.Database) -q"
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $holderProc = [System.Diagnostics.Process]::Start($psi)

    $holderProc.StandardInput.WriteLine("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;")
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
        $errText = $holderProc.StandardError.ReadToEnd()
        throw "Failed to obtain snapshot ID from PostgreSQL: $errText"
    }

    Write-Host "Active Synchronized Snapshot ID: $snapshotId" -ForegroundColor Green
    Write-Host "Snapshot transaction is locked open (READ ONLY). All export sections and manifest will share this exact snapshot." -ForegroundColor Cyan

    # 4. Dump Pre-Data DDL using snapshot
    Write-Host "`n[2/6] Dumping Pre-Data DDL (Tables, types, sequences) using snapshot..." -ForegroundColor Yellow
    docker run --rm `
        -e "PGPASSWORD=$plainDbPass" `
        -e "PGSSLMODE=require" `
        postgres:17-alpine `
        pg_dump -h $cfg.Host -p $cfg.Port -U $cfg.User -d $cfg.Database `
            --snapshot=$snapshotId --section=pre-data --clean --if-exists --no-owner --no-privileges --schema=public |
        Out-File -FilePath $preDataPath -Encoding utf8
    if ($LASTEXITCODE -ne 0) { throw "Pre-data export failed with exit code $LASTEXITCODE." }

    # 5. Dump Table Data using snapshot
    Write-Host "`n[3/6] Dumping Table Data (INSERT format) using snapshot..." -ForegroundColor Yellow
    docker run --rm `
        -e "PGPASSWORD=$plainDbPass" `
        -e "PGSSLMODE=require" `
        postgres:17-alpine `
        pg_dump -h $cfg.Host -p $cfg.Port -U $cfg.User -d $cfg.Database `
            --snapshot=$snapshotId --section=data --inserts --no-owner --no-privileges --schema=public |
        Out-File -FilePath $dataPath -Encoding utf8
    if ($LASTEXITCODE -ne 0) { throw "Data export failed with exit code $LASTEXITCODE." }

    # 6. Dump Post-Data Constraints using snapshot
    Write-Host "`n[4/6] Dumping Post-Data Constraints & Foreign Keys using snapshot..." -ForegroundColor Yellow
    docker run --rm `
        -e "PGPASSWORD=$plainDbPass" `
        -e "PGSSLMODE=require" `
        postgres:17-alpine `
        pg_dump -h $cfg.Host -p $cfg.Port -U $cfg.User -d $cfg.Database `
            --snapshot=$snapshotId --section=post-data --no-owner --no-privileges --schema=public |
        Out-File -FilePath $postDataPath -Encoding utf8
    if ($LASTEXITCODE -ne 0) { throw "Post-data export failed with exit code $LASTEXITCODE." }

    # Also dump complete schema DDL as fallback
    docker run --rm `
        -e "PGPASSWORD=$plainDbPass" `
        -e "PGSSLMODE=require" `
        postgres:17-alpine `
        pg_dump -h $cfg.Host -p $cfg.Port -U $cfg.User -d $cfg.Database `
            --snapshot=$snapshotId --schema-only --clean --if-exists --no-owner --no-privileges --schema=public |
        Out-File -FilePath $schemaPath -Encoding utf8
    if ($LASTEXITCODE -ne 0) { throw "Schema export failed with exit code $LASTEXITCODE." }

    # 7. Generate Snapshot Table Manifest using the same snapshot (Pure Read-Only)
    Write-Host "`n[5/6] Generating Table Row Count Manifest using snapshot (pure read-only query)..." -ForegroundColor Yellow
    $tableListSql = "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
    $tablesRaw = $tableListSql | docker run --rm -i `
        -e "PGPASSWORD=$plainDbPass" `
        -e "PGSSLMODE=require" `
        postgres:17-alpine `
        psql -h $cfg.Host -p $cfg.Port -U $cfg.User -d $cfg.Database -t -A
    if ($LASTEXITCODE -ne 0) { throw "Table listing for manifest failed with exit code $LASTEXITCODE." }

    $validTables = ($tablesRaw -split "`r?`n") | Where-Object { $_ -match '^[a-zA-Z0-9_]+$' }
    if ($validTables.Count -eq 0) { throw "No public tables discovered for manifest." }

    $unionClauses = ($validTables | ForEach-Object {
        "SELECT '$_' AS tbl, count(*)::text AS cnt FROM public.`"$_`""
    }) -join " UNION ALL "

    $manifestSql = @"
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET TRANSACTION SNAPSHOT '$snapshotId';
SELECT tbl || E'\t' || cnt
FROM (
$unionClauses
) q
ORDER BY tbl;
COMMIT;
"@
    $manifestOutput = $manifestSql | docker run --rm -i `
        -e "PGPASSWORD=$plainDbPass" `
        -e "PGSSLMODE=require" `
        postgres:17-alpine `
        psql -h $cfg.Host -p $cfg.Port -U $cfg.User -d $cfg.Database -t -A
    if ($LASTEXITCODE -ne 0) { throw "Manifest generation failed with exit code $LASTEXITCODE." }

    # Filter out empty or notice lines
    $cleanManifest = ($manifestOutput -split "`r?`n") | Where-Object { $_ -match "^[a-zA-Z0-9_]+`t\d+$" }
    $cleanManifest | Out-File -FilePath $manifestPath -Encoding utf8
    Write-Host "Manifest saved with $($cleanManifest.Count) verified public tables." -ForegroundColor Green

    # Commit and close the snapshot holder
    $holderProc.StandardInput.WriteLine("COMMIT;")
    $holderProc.StandardInput.Flush()
    $holderProc.StandardInput.Close()
    $holderProc.WaitForExit()
    $holderProc = $null
    Write-Host "Snapshot transaction cleanly committed and closed." -ForegroundColor Green

    # 8. Symmetrically Encrypt Data Dump with GPG (AES-256)
    Write-Host "`n[6/6] Symmetrically encrypting data dump with GPG (AES-256)..." -ForegroundColor Yellow
    $absDataPath = (Resolve-Path $dataPath).Path
    $absEncPath = "$absDataPath.gpg"

    if ($useWslGpg) {
        $wslDataPath = ($absDataPath -replace '\\', '/' -replace 'C:', '/mnt/c')
        $wslEncPath = "$wslDataPath.gpg"
        wsl -d Ubuntu -- gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase $plainGpgPass -o $wslEncPath $wslDataPath
        if ($LASTEXITCODE -ne 0) { throw "GPG encryption failed via WSL." }
    } else {
        $plainGpgPass | gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase-fd 0 -o $absEncPath $absDataPath
        if ($LASTEXITCODE -ne 0) { throw "GPG encryption failed via native gpg." }
    }

    # Verify decryption integrity
    Write-Host "Verifying decryption integrity and key validity..." -ForegroundColor Yellow
    $verifyTemp = Join-Path $OutputDir "temp_verify.tmp"
    if ($useWslGpg) {
        $wslVerifyTemp = ($verifyTemp -replace '\\', '/' -replace 'C:', '/mnt/c')
        wsl -d Ubuntu -- gpg --batch --yes --decrypt --passphrase $plainGpgPass -o $wslVerifyTemp $wslEncPath
    } else {
        $plainGpgPass | gpg --batch --yes --decrypt --passphrase-fd 0 -o $verifyTemp $absEncPath
    }
    if ($LASTEXITCODE -ne 0) { throw "GPG decryption validation failed." }

    $hashOriginal = (Get-FileHash -Algorithm SHA256 $dataPath).Hash
    $hashDecrypted = (Get-FileHash -Algorithm SHA256 $verifyTemp).Hash
    Remove-Item -Force $verifyTemp 2>$null

    if ($hashOriginal -ne $hashDecrypted) {
        throw "Decryption hash mismatch! Plaintext did not match decrypted archive."
    }
    Write-Host "Decryption round-trip verified successfully (SHA-256 match)." -ForegroundColor Green

    # Restricted Plaintext Handling: Remove unencrypted data file
    Remove-Item -Force $dataPath 2>$null
    Write-Host "Unencrypted data dump removed. Only encrypted archive '$dataGpgPath' is retained." -ForegroundColor Green

    # 9. Generate Cryptographic Checksums
    Write-Host "`nComputing final SHA-256 checksums..." -ForegroundColor Yellow
    Get-FileHash -Algorithm SHA256 $preDataPath, $dataGpgPath, $postDataPath, $schemaPath, $manifestPath |
        Select-Object Path, Hash | Format-Table -AutoSize | Out-String | Out-File -FilePath $checksumsPath -Encoding utf8
    Write-Host "Checksums written to $checksumsPath." -ForegroundColor Green

    $exportSuccess = $true
    Write-Host "`n========================================================================" -ForegroundColor Green
    Write-Host "  EXPORT SUCCESSFUL: Consistent snapshot artifacts created in '$OutputDir'." -ForegroundColor Green
    Write-Host "========================================================================" -ForegroundColor Green
}
catch {
    Write-Host "`n[!] ERROR: Export failed: $_" -ForegroundColor Red
    # Abort without creating a valid manifest; delete partial files
    Remove-Item -Force $manifestPath, $checksumsPath, $dataPath 2>$null
    exit 1
}
finally {
    if ($holderProc -and -not $holderProc.HasExited) {
        try {
            $holderProc.StandardInput.WriteLine("ROLLBACK;")
            $holderProc.StandardInput.Flush()
            $holderProc.Kill()
        } catch {}
    }
    # Securely purge credentials from memory
    $plainDbPass = $null
    $plainGpgPass = $null
    [System.GC]::Collect()
}
