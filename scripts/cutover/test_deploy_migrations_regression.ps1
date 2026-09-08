<#
.SYNOPSIS
    Focused credential-free regression test for deploy_singapore_dev_migrations.ps1.
.DESCRIPTION
    Runs against an isolated local PostgreSQL 17 container on a dedicated bridge network.
    Validates:
      1. Target identity guard blocking unauthorized targets.
      2. Pre-deploy index reconciliation preventing PostgreSQL error 42P07 on migration 20260820000000.
      3. Clean execution of 'prisma migrate deploy' applying both pending migrations.
      4. Post-deploy validation asserting 13 total rows, 11 applied migrations, 2 preserved rollbacks, 0 failures, 13 performance indexes, and 100% unchanged application table row counts.
#>
[CmdletBinding()]
param (
    [string]$ContainerName = "melon-deploy-test-db",
    [string]$NetworkName   = "melon-deploy-test-net"
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "  TEST: PRISMA MIGRATE DEPLOY RECONCILIATION & VALIDATION REGRESSION" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan

function Safe-DockerCleanup {
    param([string]$cName, [string]$nName)
    $origPref = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    try {
        $found = docker ps -a -q -f "name=^${cName}$" 2>$null
        if ($found) { docker rm -f $cName 2>$null | Out-Null }
        $foundNet = docker network ls -q -f "name=^${nName}$" 2>$null
        if ($foundNet) { docker network rm $nName 2>$null | Out-Null }
    } finally {
        $ErrorActionPreference = $origPref
    }
}

Safe-DockerCleanup -cName $ContainerName -nName $NetworkName

try {
    # 1. Setup isolated Docker network & container
    Write-Host "`n[1/4] Starting isolated PostgreSQL 17 test container..." -ForegroundColor Yellow
    docker network create $NetworkName 2>$null | Out-Null
    $cid = docker run -d --name $ContainerName --network $NetworkName -p 5438:5432 -e POSTGRES_PASSWORD=testpass postgres:17-alpine
    if (-not $cid) { throw "Failed to start container $ContainerName." }

    for ($i = 1; $i -le 30; $i++) {
        $ready = docker exec $ContainerName pg_isready -U postgres 2>$null
        if ($LASTEXITCODE -eq 0 -and $ready -match "accepting connections") { break }
        Start-Sleep -Milliseconds 500
    }

    # 2. Populate container with baseline schema & 11 Prisma migration rows (9 applied, 2 rolled back)
    Write-Host "`n[2/4] Populating container with baseline schema, 13 indexes, and 11 migration rows..." -ForegroundColor Yellow
    $restoreScriptPath = (Resolve-Path "scripts/cutover/restore_singapore_dev.ps1").Path
    . $restoreScriptPath -FunctionsOnly

    $testStaging = Join-Path (Resolve-Path "scripts/cutover").Path "deploy_test_staging"
    if (-not (Test-Path $testStaging)) { New-Item -ItemType Directory -Path $testStaging -Force | Out-Null }
    $cleanPre = Join-Path $testStaging "clean_pre.tmp.sql"
    $cleanPost = Join-Path $testStaging "clean_post.tmp.sql"
    $preSource = (Resolve-Path "backups/cutover/dev_20260908_025808/dev_pre_data.sql").Path
    $postSource = (Resolve-Path "backups/cutover/dev_20260908_025808/dev_post_data.sql").Path

    Sanitize-PreDataSql -SourcePath $preSource -DestinationPath $cleanPre
    Prepare-PostDataSql -SourcePath $postSource -DestinationPath $cleanPost

    Get-Content $cleanPre | docker exec -i $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 | Out-Null
    Get-Content $cleanPost | docker exec -i $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 | Out-Null

    # Insert baseline 11 migrations
    $populateMigrationsSql = @'
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES
('b6e805a5-89bb-4002-a51f-7cbb43fb0879', '2972e9a7e2d8e1d53c39ad53420d5d8479dca249cb68f188e2d0387a6a409d80', NOW(), '0_init', NULL, NULL, NOW(), 1),
('1dedd6cf-b49e-428a-b981-bf5e146bbcf2', 'e6f15a21e5be645ff0c6ec19f48ed0ea8ab391189f004168a40b6d76488096eb', NOW(), '20260730140756_update_device_type_enum', NULL, NULL, NOW(), 1),
('fa441467-9431-4c29-be6d-198f3ebfd3ad', 'cf5a8ebc82404b8c347227228871584568671f0e080c3f3767a8bb3354b9c696', NOW(), '20260731001600_add_user_device_access_active_unique_index', NULL, NULL, NOW(), 1),
('f55ad83a-8619-4e4f-aa92-4a582a864d13', 'dab495bc914144c0968fc07ab3f37370e0721b03c6559681adb6383428584721', NOW(), '20260731170000_remove_legacy_device_types', NULL, NULL, NOW(), 1),
('96a56de7-7898-4d36-870c-a32a39516749', 'f60e1175292baba6ffce7d166c610ac689c6a604a7f22f1eedb213468ac74119', NOW(), '20260802170000_add_faucet_command_events_message_unique', NULL, NULL, NOW(), 1),
('ad7ca5b0-3176-4d6d-93aa-7c5866ee2c5b', '96cb7573b6a3f0dd34515a181e7c7686ab8722f39737f4411b19cce07d520597', NOW(), '20260817000000_add_password_reset_tokens', NULL, NULL, NOW(), 1),
('9bd105e4-35c1-451f-9f0c-dbda79c70307', '20ffda99679f7a30c940a7965ea99d6f00f11cfc27b13398ee6dda27e9afd3de', NULL, '20260817082153_add_email_verification_tokens', NULL, NOW(), NOW(), 0),
('6193326f-3b07-43f5-94a7-f3843db6df16', '20ffda99679f7a30c940a7965ea99d6f00f11cfc27b13398ee6dda27e9afd3de', NOW(), '20260817082153_add_email_verification_tokens', NULL, NULL, NOW(), 1),
('6cb1466f-fc9e-45f5-84b2-69a84a492efc', '1827d0111cd5bf1c2db4d4b9361cda19aa1baa70bf92513c0e908f0e5ffe0ee0', NULL, '20260819000000_task_0802_faucet_command_action', NULL, NOW(), NOW(), 0),
('4e178c9c-f211-492d-814a-10aebaa76e2c', '1827d0111cd5bf1c2db4d4b9361cda19aa1baa70bf92513c0e908f0e5ffe0ee0', NOW(), '20260819000000_task_0802_faucet_command_action', NULL, NULL, NOW(), 1),
('3813c50d-25e9-4485-93e5-94d0b64416c7', 'c61139df4afbe0f46629c3203a9d0bd189920216279b5c3a2aead494e50f279e', NOW(), '20260829170000_add_pending_email_to_email_verification_tokens', NULL, NULL, NOW(), 1);
'@
    docker exec -i $ContainerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "$populateMigrationsSql" | Out-Null

    # Generate dev_manifest.tsv for container test staging
    $manifestSql = @'
SELECT format('%s	%s', table_name, (xpath('/row/cnt/text()', xml_count))[1]::text)
FROM (
    SELECT 
        table_name,
        query_to_xml(format('select count(*) as cnt from %I.%I', table_schema, table_name), false, true, '') as xml_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
) t;
'@
    $manifestLines = (docker exec -i $ContainerName psql -U postgres -d postgres -t -A -c "$manifestSql").Trim().Split("`n") | Where-Object { $_ -match '\S' }
    $testManifestFile = Join-Path $testStaging "dev_manifest.tsv"
    [System.IO.File]::WriteAllLines($testManifestFile, $manifestLines)

    Write-Host "  [OK] Baseline state initialized with 11 migrations and sessions_user_active_idx present." -ForegroundColor Green

    # 3. Test Target Identity Guard in deploy wrapper
    Write-Host "`n[3/4] Testing target identity guard..." -ForegroundColor Yellow
    $deployScriptPath = (Resolve-Path "scripts/cutover/deploy_singapore_dev_migrations.ps1").Path

    $guardBlocked = $false
    try {
        & $deployScriptPath -TargetRef "invalid_ref" 2>$null
    } catch {
        $guardBlocked = $true
    }
    if (-not $guardBlocked) { throw "TargetRef guard failed to reject invalid target!" }
    Write-Host "  [PASS] Target identity guard rejected unauthorized target." -ForegroundColor Green

    # 4. Execute deploy_singapore_dev_migrations.ps1
    Write-Host "`n[4/4] Executing deploy_singapore_dev_migrations.ps1 against test container..." -ForegroundColor Yellow

    & $deployScriptPath `
        -TargetRef "unbyxlkrzqlafolxcypi" `
        -TargetHost $ContainerName `
        -TargetPort 5432 `
        -Network $NetworkName `
        -PrismaHost "localhost" `
        -PrismaPort 5438 `
        -TargetUser "postgres" `
        -TargetDb "postgres" `
        -PlainPassword "testpass" `
        -BackupDir $testStaging `
        -RequireSsl:$false

    if ($LASTEXITCODE -ne 0) {
        throw "deploy_singapore_dev_migrations.ps1 failed with exit code $LASTEXITCODE"
    }

    Write-Host "`n========================================================================" -ForegroundColor Green
    Write-Host "  ALL DEPLOY REGRESSION TESTS PASSED (EXIT CODE 0)!" -ForegroundColor Green
    Write-Host "========================================================================" -ForegroundColor Green
} finally {
    Write-Host "`n[CLEANUP] Cleaning up test container and temporary files..." -ForegroundColor Gray
    Safe-DockerCleanup -cName $ContainerName -nName $NetworkName
    $testStaging = Join-Path (Resolve-Path "scripts/cutover").Path "deploy_test_staging"
    if (Test-Path $testStaging) { Remove-Item -Recurse -Force $testStaging 2>$null }
}
