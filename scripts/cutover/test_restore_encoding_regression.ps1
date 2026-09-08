<#
.SYNOPSIS
    Focused regression test validating UTF-8 BOM removal, multi-file psql transport,
    non-ASCII round-trip preservation, and atomic single-transaction rollback.
.DESCRIPTION
    Reuses production functions from scripts/cutover/restore_singapore_dev.ps1 via dot-sourcing (-FunctionsOnly).
    Runs against an isolated local PostgreSQL 17 container on a dedicated bridge network.
    Tests:
      1. Extraction and sanitization producing strictly UTF-8 without BOM.
      2. Multi-file -f transport with PGCLIENTENCODING=UTF8.
      3. Non-ASCII / Unicode exact bit-for-bit round-trip verification.
      4. Complete schema and constraint restoration alongside ensure_rls event trigger.
      5. Single-transaction atomic rollback on injected SQL error.
#>
[CmdletBinding()]
param (
    [string]$ContainerName = "melon-restore-encoding-test",
    [string]$NetworkName = "melon-restore-test-net"
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "  FOCUSED REGRESSION TEST: UTF-8 ENCODING & RESTORE TRANSPORT PATH" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan

# 1. Reuse actual production functions from restore_singapore_dev.ps1
$restoreScriptPath = (Resolve-Path "scripts/cutover/restore_singapore_dev.ps1").Path
Write-Host "`n[1/6] Dot-sourcing production functions from restore_singapore_dev.ps1..." -ForegroundColor Yellow
. $restoreScriptPath -FunctionsOnly

if (-not (Get-Command Sanitize-PreDataSql -ErrorAction SilentlyContinue)) {
    throw "Failed to load Sanitize-PreDataSql from production script."
}
if (-not (Get-Command Prepare-PostDataSql -ErrorAction SilentlyContinue)) {
    throw "Failed to load Prepare-PostDataSql from production script."
}
if (-not (Get-Command Remove-LeadingBom -ErrorAction SilentlyContinue)) {
    throw "Failed to load Remove-LeadingBom from production script."
}
if (-not (Get-Command Invoke-PsqlCommand -ErrorAction SilentlyContinue)) {
    throw "Failed to load Invoke-PsqlCommand from production script."
}
if (-not (Get-Command Verify-SingaporeDevBaseline -ErrorAction SilentlyContinue)) {
    throw "Failed to load Verify-SingaporeDevBaseline from production script."
}
Write-Host "  [OK] Production functions loaded successfully: Sanitize-PreDataSql, Prepare-PostDataSql, Remove-LeadingBom, Invoke-PsqlCommand, Verify-SingaporeDevBaseline." -ForegroundColor Green

# Resolve test directories and file paths
$testDir = Join-Path (Resolve-Path "scripts/cutover").Path "test_staging"
if (-not (Test-Path $testDir)) {
    New-Item -ItemType Directory -Path $testDir -Force | Out-Null
}

$preDataPath       = (Resolve-Path "backups/cutover/dev_20260908_025808/dev_pre_data.sql").Path
$postDataPath      = (Resolve-Path "backups/cutover/dev_20260908_025808/dev_post_data.sql").Path
$cleanPrePath      = Join-Path $testDir "clean_pre_data.tmp.sql"
$cleanPostPath     = Join-Path $testDir "clean_post_data.tmp.sql"
$syntheticDataPath = Join-Path $testDir "synthetic_data.tmp.sql"
$errorSqlPath      = Join-Path $testDir "error.tmp.sql"

function Safe-DockerCleanup {
    param([string]$cName, [string]$nName)
    $origPref = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    try {
        $foundContainer = docker ps -a -q -f "name=^${cName}$" 2>$null
        if ($foundContainer) {
            docker rm -f $cName 2>$null | Out-Null
        }
        $foundNetwork = docker network ls -q -f "name=^${nName}$" 2>$null
        if ($foundNetwork) {
            docker network rm $nName 2>$null | Out-Null
        }
    } finally {
        $ErrorActionPreference = $origPref
    }
}

# Cleanup any pre-existing container or network
Safe-DockerCleanup -cName $ContainerName -nName $NetworkName

try {
    # Create isolated Docker bridge network
    docker network create $NetworkName 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Failed to create Docker bridge network $NetworkName." }

    # 2. Launch isolated PostgreSQL 17 test container
    Write-Host "`n[2/6] Launching isolated PostgreSQL 17 container on network $NetworkName..." -ForegroundColor Yellow
    $cid = docker run -d --name $ContainerName --network $NetworkName -e POSTGRES_PASSWORD=testpass postgres:17-alpine
    if (-not $cid) { throw "Failed to start container." }

    # Wait for PostgreSQL to become ready
    $ready = $false
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        $check = docker exec $ContainerName pg_isready -U postgres 2>$null
        if ($LASTEXITCODE -eq 0 -and $check -match "accepting connections") {
            $ready = $true
            break
        }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw "PostgreSQL test container failed to become ready in 15 seconds." }
    Write-Host "  [OK] PostgreSQL container running and accepting connections." -ForegroundColor Green

    # 3. Setup Supabase platform baseline (rls_auto_enable function + ensure_rls event trigger)
    Write-Host "`n[3/6] Initializing Supabase platform baseline (rls_auto_enable + ensure_rls)..." -ForegroundColor Yellow
    $initPlatformSql = @(
        'CREATE OR REPLACE FUNCTION public.rls_auto_enable()',
        ' RETURNS event_trigger',
        ' LANGUAGE plpgsql',
        ' SECURITY DEFINER',
        ' SET search_path TO ''pg_catalog''',
        'AS $function$',
        'DECLARE',
        '  cmd record;',
        'BEGIN',
        '  FOR cmd IN',
        '    SELECT *',
        '    FROM pg_event_trigger_ddl_commands()',
        '    WHERE command_tag IN (''CREATE TABLE'', ''CREATE TABLE AS'', ''SELECT INTO'')',
        '      AND object_type IN (''table'',''partitioned table'')',
        '  LOOP',
        '     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN (''public'') AND cmd.schema_name NOT IN (''pg_catalog'',''information_schema'') AND cmd.schema_name NOT LIKE ''pg_toast%'' AND cmd.schema_name NOT LIKE ''pg_temp%'' THEN',
        '      BEGIN',
        '        EXECUTE format(''alter table if exists %s enable row level security'', cmd.object_identity);',
        '        RAISE LOG ''rls_auto_enable: enabled RLS on %'', cmd.object_identity;',
        '      EXCEPTION',
        '        WHEN OTHERS THEN',
        '          RAISE LOG ''rls_auto_enable: failed to enable RLS on %'', cmd.object_identity;',
        '      END;',
        '     ELSE',
        '        RAISE LOG ''rls_auto_enable: skip % (either system schema or not in enforced list: %.)'', cmd.object_identity, cmd.schema_name;',
        '     END IF;',
        '  END LOOP;',
        'END;',
        '$function$;',
        '',
        'CREATE EVENT TRIGGER ensure_rls ON ddl_command_end',
        'WHEN TAG IN (''CREATE TABLE'', ''CREATE TABLE AS'', ''SELECT INTO'')',
        'EXECUTE FUNCTION public.rls_auto_enable();'
    ) -join "`n"

    docker exec -i $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "$initPlatformSql" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Failed to initialize platform baseline." }

    $triggerCount = (docker exec -i $ContainerName psql -U postgres -d postgres -t -A -c "SELECT count(*) FROM pg_event_trigger WHERE evtname = 'ensure_rls' AND evtenabled = 'O';").Trim()
    if ($triggerCount -ne "1") { throw "Event trigger ensure_rls was not created." }
    Write-Host "  [OK] ensure_rls event trigger created and enabled." -ForegroundColor Green

    # 4. Generate production inputs using actual functions & verify BOM removal
    Write-Host "`n[4/6] Generating sanitized files & synthetic non-ASCII payload..." -ForegroundColor Yellow

    # Run production sanitizer on dev_pre_data.sql
    Sanitize-PreDataSql -SourcePath $preDataPath -DestinationPath $cleanPrePath
    Prepare-PostDataSql -SourcePath $postDataPath -DestinationPath $cleanPostPath

    # Synthetic non-ASCII test data targeting public.sites table (which exists in pre-data DDL)
    $deg = [char]0x00B0
    $delta = [char]0x0394
    $lambda = [char]0x03BB
    $omega = [char]0x03A9
    $plusminus = [char]0x00B1
    $melon = [char]::ConvertFromUtf32(0x1F348)
    $water = [char]::ConvertFromUtf32(0x1F4A7)
    $zap = [char]0x26A1

    $testSiteId1 = "11111111-1111-1111-1111-111111111111"
    $testSiteId2 = "22222222-2222-2222-2222-222222222222"
    $testSiteId3 = "33333333-3333-3333-3333-333333333333"

    $testSiteName1 = "Kebun Melon Sukatani: Suhu 28.5${deg}C, Debit 1.5 L/mnt, pH 6.8 & EC 2.1 mS/cm"
    $testSiteName2 = "Caf" + [char]0x00E9 + " & P" + [char]0x00E2 + "tisserie Agritech: " + [char]0x00FC + [char]0x00F1 + [char]0x00EE + [char]0x00E7 + [char]0x00F8 + [char]0x00E4 + [char]0x00E8 + " test"
    $testSiteName3 = "Melon $melon & Water $water & Sensor $zap`: ${delta}T = 2.5${deg}C $plusminus 0.1, $lambda = 650nm, ${omega}" + [char]0x00B7 + "m"

    $syntheticSql = @(
        "SET statement_timeout = 0;",
        "SET lock_timeout = 0;",
        "SET client_encoding = 'UTF8';",
        "",
        "INSERT INTO public.sites (id, site_code, name, created_at, updated_at) VALUES",
        "  ('$testSiteId1', 'SITE-001', '$testSiteName1', NOW(), NOW()),",
        "  ('$testSiteId2', 'SITE-002', '$testSiteName2', NOW(), NOW()),",
        "  ('$testSiteId3', 'SITE-003', '$testSiteName3', NOW(), NOW());"
    ) -join "`n"

    # Write synthetic data with a UTF-8 BOM first (simulating legacy Out-File -Encoding utf8 behavior)
    $utf8WithBom = New-Object System.Text.UTF8Encoding($true)
    [System.IO.File]::WriteAllText($syntheticDataPath, $syntheticSql, $utf8WithBom)

    # Verify BOM exists before stripping
    $rawSyntheticBytes = [System.IO.File]::ReadAllBytes($syntheticDataPath)
    if ($rawSyntheticBytes[0] -ne 0xEF -or $rawSyntheticBytes[1] -ne 0xBB -or $rawSyntheticBytes[2] -ne 0xBF) {
        throw "Test setup error: synthetic data file did not contain expected BOM."
    }

    # Use production Remove-LeadingBom function to strip the BOM
    $bomStripped = Remove-LeadingBom -FilePath $syntheticDataPath
    if (-not $bomStripped) {
        throw "Remove-LeadingBom returned false; failed to strip BOM."
    }

    # Verify zero BOM across all 3 input files
    foreach ($f in @($cleanPrePath, $syntheticDataPath, $cleanPostPath)) {
        $bytes = [System.IO.File]::ReadAllBytes($f)
        if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
            throw "BOM check failed: $f still starts with UTF-8 BOM!"
        }
    }
    Write-Host "  [OK] Verified 0 BOM bytes across clean_pre_data, synthetic_data, and clean_post_data." -ForegroundColor Green

    # 5. Execute Multi-File Restore Path via psql with PGCLIENTENCODING=UTF8
    Write-Host "`n[5/6] Executing multi-file psql restore path with PGCLIENTENCODING=UTF8..." -ForegroundColor Yellow

    $dockerMount = "$($testDir.Replace('\', '/')):/test_backup:ro"
    $restoreArgs = "run -i --rm -e PGPASSWORD=testpass -e PGCLIENTENCODING=UTF8 --network $NetworkName -v $dockerMount postgres:17-alpine psql -h $ContainerName -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction --quiet -f /test_backup/clean_pre_data.tmp.sql -f /test_backup/synthetic_data.tmp.sql -f /test_backup/clean_post_data.tmp.sql"

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "docker"
    $psi.Arguments = $restoreArgs
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
    $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8

    $p = [System.Diagnostics.Process]::Start($psi)
    $pOut = $p.StandardOutput.ReadToEnd()
    $pErr = $p.StandardError.ReadToEnd()
    $p.WaitForExit()

    Write-Host "  Multi-file Restore Exit Code: $($p.ExitCode) (Expected: 0)"
    if ($p.ExitCode -ne 0) {
        Write-Host "PostgreSQL Error Output:" -ForegroundColor Red
        Write-Host $pErr -ForegroundColor Red
        throw "Multi-file restore path failed with exit code $($p.ExitCode)."
    }
    Write-Host "  [OK] Multi-file direct -f atomic restoration succeeded." -ForegroundColor Green

    # Verify Database State & Non-ASCII Exact Round-Trip
    Write-Host "`n  Verifying table counts, constraints, and exact non-ASCII round-trip..."
    $verifySql = @(
        'SELECT json_build_object(',
        '    ''table_count'', (SELECT count(*) FROM information_schema.tables WHERE table_schema = ''public''),',
        '    ''foreign_key_count'', (SELECT count(*) FROM pg_constraint WHERE contype = ''f'' AND connamespace = ''public''::regnamespace),',
        '    ''enum_count'', (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = ''public'' AND t.typtype = ''e''),',
        '    ''trigger_count'', (SELECT count(*) FROM pg_event_trigger WHERE evtname = ''ensure_rls'' AND evtenabled = ''O''),',
        '    ''function_exists'', (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = ''public'' AND p.proname = ''rls_auto_enable''),',
        '    ''site_rows'', (SELECT json_agg(json_build_object(''id'', id::text, ''name'', name)) FROM public.sites)',
        ')::text;'
    ) -join "`n"

    $verifyOut = Invoke-PsqlCommand -TargetHost $ContainerName -TargetPort 5432 -TargetUser "postgres" -TargetDb "postgres" -PlainPassword "testpass" -Sql $verifySql -TuplesOnly -Network $NetworkName
    $vData = $verifyOut | ConvertFrom-Json

    Write-Host "  Public Table Count      : $($vData.table_count) (Expected: 26)"
    Write-Host "  Foreign Key Count       : $($vData.foreign_key_count) (Expected: 28)"
    Write-Host "  Enum Count              : $($vData.enum_count) (Expected: 8)"
    Write-Host "  ensure_rls Trigger      : $($vData.trigger_count) (Expected: 1)"
    Write-Host "  rls_auto_enable Function: $($vData.function_exists) (Expected: 1)"

    if ($vData.table_count -ne 26) { throw "Table count mismatch! Expected 26, got $($vData.table_count)" }
    if ($vData.foreign_key_count -ne 28) { throw "FK count mismatch! Expected 28, got $($vData.foreign_key_count)" }
    if ($vData.enum_count -ne 8) { throw "Enum count mismatch! Expected 8, got $($vData.enum_count)" }
    if ($vData.trigger_count -ne 1) { throw "ensure_rls trigger missing or disabled!" }
    if ($vData.function_exists -ne 1) { throw "rls_auto_enable function missing!" }

    # Assert exact bit-for-bit non-ASCII string match
    $retrievedSites = $vData.site_rows
    $site1 = $retrievedSites | Where-Object { $_.id -eq $testSiteId1 }
    $site2 = $retrievedSites | Where-Object { $_.id -eq $testSiteId2 }
    $site3 = $retrievedSites | Where-Object { $_.id -eq $testSiteId3 }

    if (-not $site1 -or $site1.name -ne $testSiteName1) {
        throw "Unicode Round-Trip Mismatch for Site 1!`nExpected: $testSiteName1`nReceived: $($site1.name)"
    }
    if (-not $site2 -or $site2.name -ne $testSiteName2) {
        throw "Unicode Round-Trip Mismatch for Site 2!`nExpected: $testSiteName2`nReceived: $($site2.name)"
    }
    if (-not $site3 -or $site3.name -ne $testSiteName3) {
        throw "Unicode Round-Trip Mismatch for Site 3!`nExpected: $testSiteName3`nReceived: $($site3.name)"
    }
    Write-Host "  [OK] 100% exact round-trip match verified for Indonesian text, accented characters, emoji, and math symbols." -ForegroundColor Green
    
    # Verify Invoke-PsqlCommand handles complex multiline DO blocks without quote corruption
    Write-Host "`n  Testing Invoke-PsqlCommand with dynamic orphan check DO block..."
    $orphanTestSql = @'
DO $$
DECLARE
  total_orphans BIGINT := 0;
BEGIN
  RAISE NOTICE 'Orphan check verification passed';
END $$;
'@
    $null = Invoke-PsqlCommand -TargetHost $ContainerName -TargetPort 5432 -TargetUser "postgres" -TargetDb "postgres" -PlainPassword "testpass" -Sql $orphanTestSql -Network $NetworkName
    Write-Host "  [OK] Invoke-PsqlCommand successfully executed multiline DO block without quote corruption." -ForegroundColor Green

    # 6. Test Single-Transaction Atomic Rollback on Injected SQL Error
    Write-Host "`n[6/6] Testing single-transaction atomic rollback on injected error..." -ForegroundColor Yellow

    # Reset container public schema
    $resetSql = @(
        'DROP SCHEMA public CASCADE;',
        'CREATE SCHEMA public;',
        'GRANT ALL ON SCHEMA public TO postgres;',
        'GRANT ALL ON SCHEMA public TO public;',
        '',
        'CREATE OR REPLACE FUNCTION public.rls_auto_enable()',
        ' RETURNS event_trigger',
        ' LANGUAGE plpgsql',
        ' SECURITY DEFINER',
        ' SET search_path TO ''pg_catalog''',
        'AS $function$',
        'DECLARE',
        '  cmd record;',
        'BEGIN',
        '  FOR cmd IN',
        '    SELECT *',
        '    FROM pg_event_trigger_ddl_commands()',
        '    WHERE command_tag IN (''CREATE TABLE'', ''CREATE TABLE AS'', ''SELECT INTO'')',
        '      AND object_type IN (''table'',''partitioned table'')',
        '  LOOP',
        '     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN (''public'') AND cmd.schema_name NOT IN (''pg_catalog'',''information_schema'') AND cmd.schema_name NOT LIKE ''pg_toast%'' AND cmd.schema_name NOT LIKE ''pg_temp%'' THEN',
        '      BEGIN',
        '        EXECUTE format(''alter table if exists %s enable row level security'', cmd.object_identity);',
        '        RAISE LOG ''rls_auto_enable: enabled RLS on %'', cmd.object_identity;',
        '      EXCEPTION',
        '        WHEN OTHERS THEN',
        '          RAISE LOG ''rls_auto_enable: failed to enable RLS on %'', cmd.object_identity;',
        '      END;',
        '     ELSE',
        '        RAISE LOG ''rls_auto_enable: skip % (either system schema or not in enforced list: %.)'', cmd.object_identity, cmd.schema_name;',
        '     END IF;',
        '  END LOOP;',
        'END;',
        '$function$;',
        '',
        'CREATE EVENT TRIGGER ensure_rls ON ddl_command_end',
        'WHEN TAG IN (''CREATE TABLE'', ''CREATE TABLE AS'', ''SELECT INTO'')',
        'EXECUTE FUNCTION public.rls_auto_enable();'
    ) -join "`n"

    docker exec -i $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "$resetSql" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Failed to reset test container." }

    # Create error SQL file without BOM
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines($errorSqlPath, @("SELECT 1/0 AS intentional_injected_error;"), $utf8NoBom)

    $errorArgs = "run -i --rm -e PGPASSWORD=testpass -e PGCLIENTENCODING=UTF8 --network $NetworkName -v $dockerMount postgres:17-alpine psql -h $ContainerName -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction --quiet -f /test_backup/clean_pre_data.tmp.sql -f /test_backup/error.tmp.sql -f /test_backup/clean_post_data.tmp.sql"

    $psiErr = New-Object System.Diagnostics.ProcessStartInfo
    $psiErr.FileName = "docker"
    $psiErr.Arguments = $errorArgs
    $psiErr.UseShellExecute = $false
    $psiErr.RedirectStandardOutput = $true
    $psiErr.RedirectStandardError = $true
    $psiErr.StandardOutputEncoding = [System.Text.Encoding]::UTF8
    $psiErr.StandardErrorEncoding = [System.Text.Encoding]::UTF8

    $pErrProc = [System.Diagnostics.Process]::Start($psiErr)
    $errOut = $pErrProc.StandardOutput.ReadToEnd()
    $errText = $pErrProc.StandardError.ReadToEnd()
    $pErrProc.WaitForExit()

    Write-Host "  Injected Error Restore Exit Code: $($pErrProc.ExitCode) (Expected non-zero, e.g. 3)"
    if ($pErrProc.ExitCode -eq 0) {
        throw "Injected error restore unexpectedly succeeded!"
    }
    if ($errText -notmatch "division by zero") {
        throw "Expected division by zero error, got: $errText"
    }
    Write-Host "  [VERIFIED] Intentionally halted with division by zero." -ForegroundColor Green

    # Verify rollback
    $tablesAfterRollback = (docker exec -i $ContainerName psql -U postgres -d postgres -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';").Trim()
    $triggerAfterRollback = (docker exec -i $ContainerName psql -U postgres -d postgres -t -A -c "SELECT count(*) FROM pg_event_trigger WHERE evtname = 'ensure_rls' AND evtenabled = 'O';").Trim()

    Write-Host "  Public tables after rollback : $tablesAfterRollback (Expected: 0)"
    Write-Host "  ensure_rls trigger intact    : $triggerAfterRollback (Expected: 1)"

    if ($tablesAfterRollback -ne "0") { throw "Rollback failed! Partial tables remain after error." }
    if ($triggerAfterRollback -ne "1") { throw "ensure_rls trigger missing or corrupted after rollback!" }
    Write-Host "  [SUCCESS] Atomic single-transaction rollback verified: exactly 0 tables remain." -ForegroundColor Green

    Write-Host "`n========================================================================" -ForegroundColor Green
    Write-Host "  ALL ENCODING & TRANSPORT REGRESSION CHECKS PASSED (EXIT CODE 0)!" -ForegroundColor Green
    Write-Host "========================================================================" -ForegroundColor Green
    exit 0
}
finally {
    # Cleanup container, network, and temporary files
    Write-Host "`n[CLEANUP] Stopping test container $ContainerName and removing network $NetworkName..." -ForegroundColor Gray
    Safe-DockerCleanup -cName $ContainerName -nName $NetworkName
    if (Test-Path $testDir) {
        Remove-Item -Recurse -Force $testDir 2>$null
        Write-Host "  [CLEANUP] Deleted test directory: $testDir" -ForegroundColor Gray
    }
}
