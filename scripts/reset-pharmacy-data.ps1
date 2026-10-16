$ErrorActionPreference = 'Stop'
$projectDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $projectDirectory
. (Join-Path $PSScriptRoot 'docker-path.ps1')
function Invoke-ResetDocker {
    param([string[]]$Arguments)
    & docker @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed ($LASTEXITCODE). Reset stopped." }
}
$servicesStopped = $false
try {
    Invoke-ResetDocker -Arguments @('info', '--format', '{{.ServerVersion}}')
    # Refuse to operate on an installation belonging to another extracted folder.
    foreach ($container in @('pharmadesk-mongodb', 'pharmadesk-backend', 'pharmadesk-frontend')) {
        $details = & docker inspect $container
        if ($LASTEXITCODE -ne 0) { throw 'Start this installation once before using reset.' }
        $owner = ($details | ConvertFrom-Json)[0].Config.Labels.'com.docker.compose.project.working_dir'
        if (-not $owner) { throw 'Installation identity is missing; reset refused.' }
        $owner = $owner.Replace('/', '\').TrimEnd('\')
        if ($owner -ine $projectDirectory.TrimEnd('\')) { throw "Another installation owns $container. Use Reset-Pharmacy-Data.bat in its folder: $owner" }
    }
    Write-Host 'WARNING: This removes ALL business records: medicines, batches, bills, refunds, udhar, suppliers, cash records, imports and audit history.' -ForegroundColor Yellow
    Write-Host 'Existing login accounts/passwords remain. Program files, Docker images, volumes and uploaded files are not deleted.'
    Write-Host 'Close the pharmacy on all windows/devices. A full database backup will be made before any deletion.'
    if ((Read-Host 'Type RESET PHARMACY DATA to confirm') -cne 'RESET PHARMACY DATA') {
        Write-Host 'Cancelled. No data changed.'
        exit 0
    }
    $servicesStopped = $true
    Invoke-ResetDocker -Arguments @('compose', 'stop', 'frontend', 'backend')
    Invoke-ResetDocker -Arguments @('start', 'pharmadesk-mongodb')
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
    $backupDirectory = Join-Path $projectDirectory 'backup-exports'
    New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
    $filename = "before-reset-$stamp.archive.gz"
    $containerArchive = "/tmp/$filename"
    $hostArchive = Join-Path $backupDirectory $filename
    Invoke-ResetDocker -Arguments @('exec', 'pharmadesk-mongodb', 'mongodump', '--db=pharmadesk', "--archive=$containerArchive", '--gzip')
    Invoke-ResetDocker -Arguments @('cp', "pharmadesk-mongodb:$containerArchive", $hostArchive)
    if ((Get-Item -LiteralPath $hostArchive).Length -le 0) { throw 'Backup is empty. No reset performed.' }
    $hostHash = (Get-FileHash -LiteralPath $hostArchive -Algorithm SHA256).Hash.ToLowerInvariant()
    $containerHash = & docker exec pharmadesk-mongodb sha256sum $containerArchive
    if ($LASTEXITCODE -ne 0 -or ($containerHash -split '\s+')[0] -cne $hostHash) { throw 'Backup copy checksum mismatch. No reset performed.' }
    Set-Content -LiteralPath "$hostArchive.sha256" -Value $hostHash -Encoding ASCII
    # Parse the archive before deleting anything. No restore is performed by this check.
    Invoke-ResetDocker -Arguments @('exec', 'pharmadesk-mongodb', 'mongorestore', "--archive=$containerArchive", '--gzip', '--dryRun')
    Write-Host "Safety backup: $hostArchive" -ForegroundColor Green
    Invoke-ResetDocker -Arguments @('cp', (Join-Path $PSScriptRoot 'reset-business-data.mongo.js'), 'pharmadesk-mongodb:/tmp/reset-business-data.mongo.js')
    Invoke-ResetDocker -Arguments @('exec', 'pharmadesk-mongodb', 'mongosh', '--quiet', 'pharmadesk', '--file', '/tmp/reset-business-data.mongo.js')
    Write-Host 'Reset complete. Medicines and bills are now empty; existing accounts still work.' -ForegroundColor Green
} catch {
    Write-Host "Reset stopped: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Keep the safety backup. Do not delete Docker volumes or use Clean/Purge data.'
    exit 1
} finally {
    if ($servicesStopped) {
        # Start without rebuilding or changing the existing application port.
        & docker start pharmadesk-backend pharmadesk-frontend
        if ($LASTEXITCODE -ne 0) { Write-Host 'Services could not restart. Run Start-Sardar-Pharmacy.bat.' -ForegroundColor Red }
        else { Write-Host 'Reopen the desktop shortcut and refresh the page. If services are still starting, wait briefly.' }
    }
}
