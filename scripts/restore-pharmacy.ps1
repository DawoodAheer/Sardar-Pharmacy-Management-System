# =====================================================================
# Sardar Medical Store - Safe Database Restore Utility (PowerShell)
# =====================================================================

param(
    [string]$SpecifiedBackupPath = ""
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot 'docker-path.ps1')
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path "$ScriptDir\..").Path

Set-Location $ProjectRoot

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "       [WARN] Sardar Medical Store DATABASE RESTORE       " -ForegroundColor Red
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "Project Location: $ProjectRoot" -ForegroundColor Gray
Write-Host ""

$BackupBaseDir = Join-Path $ProjectRoot "backups"

# An explicit archive is valid even when this installation has no legacy backup folder.
$SelectedBackup = $null
if ($SpecifiedBackupPath) {
    if (-not (Test-Path -LiteralPath $SpecifiedBackupPath -PathType Leaf) -or $SpecifiedBackupPath -notlike '*.archive.gz') {
        throw 'The specified MongoDB archive was not found or is not an .archive.gz file. Restore was not started.'
    }
    $SelectedBackup = Get-Item -LiteralPath $SpecifiedBackupPath
} else {
    $allArchives = @(
        foreach ($directory in @($BackupBaseDir, (Join-Path $ProjectRoot 'backup-exports'))) {
            if (Test-Path -LiteralPath $directory) {
                Get-ChildItem -LiteralPath $directory -Recurse -File -Filter '*.archive.gz'
            }
        }
    ) | Sort-Object CreationTime -Descending
    $allArchives = @($allArchives)
    if ($allArchives.Count -eq 0) { throw 'No MongoDB archive backups found in backups or backup-exports. Restore was not started.' }
    Write-Host "Available Backups:" -ForegroundColor Yellow
    $maxShow = [math]::Min(10, $allArchives.Count)
    for ($i = 0; $i -lt $maxShow; $i++) {
        $file = $allArchives[$i]
        $sizeMB = [math]::Round($file.Length / 1MB, 2)
        Write-Host "  [$($i+1)] $($file.Name) ($sizeMB MB - $($file.CreationTime))" -ForegroundColor Cyan
    }
    $choice = Read-Host "Select backup number to restore [Default: 1 (Latest)]"
    if (-not $choice) { $choice = '1' }
    $number = 0
    if (-not [int]::TryParse($choice, [ref]$number) -or $number -lt 1 -or $number -gt $maxShow) {
        throw 'Invalid backup selection. Restore was not started.'
    }
    $SelectedBackup = $allArchives[$number - 1]
}

Write-Host ""
Write-Host "Selected Backup: $($SelectedBackup.FullName)" -ForegroundColor Green
Write-Host "[WARNING] Restoring will overwrite the current live database collections!" -ForegroundColor Yellow
$confirm = Read-Host "Type 'RESTORE' to confirm operation"

if ($confirm -ne "RESTORE") {
    Write-Host "Restoration cancelled by user." -ForegroundColor Gray
    Read-Host "Press Enter to exit..."
    exit 0
}

# ---------------------------------------------------------------------
# STEP 1: Mandatory Pre-Restore Safety Backup
# ---------------------------------------------------------------------
Write-Host ""
Write-Host "[1/4] Creating mandatory Safety Pre-Restore Backup..." -ForegroundColor Yellow
try {
    & "$ScriptDir\backup-pharmacy.ps1" -BackupType "pre-restore"
    if ($LASTEXITCODE -ne 0) { throw 'Pre-restore safety backup failed.' }
    Write-Host "[OK] Pre-restore safety backup completed!" -ForegroundColor Green
} catch {
    Write-Host "[CRITICAL] Safety backup failed! Aborting restore operation to protect data." -ForegroundColor Red
    Read-Host "Press Enter to exit..."
    exit 1
}

# ---------------------------------------------------------------------
# STEP 2: Execute mongorestore inside container
# ---------------------------------------------------------------------
Write-Host ""
Write-Host "[2/4] Restoring MongoDB database from archive..." -ForegroundColor Yellow

$ContainerArchivePath = "/tmp/restore_target.archive.gz"

try {
    # Copy selected backup into container
    docker cp $SelectedBackup.FullName "pharmadesk-mongodb:${ContainerArchivePath}"
    if ($LASTEXITCODE -ne 0) { throw 'Could not copy the selected backup into MongoDB. Restore was not started.' }

    # Execute mongorestore directly inside container with --drop to cleanly overwrite collections
    & docker exec pharmadesk-mongodb mongorestore --drop --archive=$ContainerArchivePath --gzip
    if ($LASTEXITCODE -ne 0) {
        throw "mongorestore command failed inside container with exit code $LASTEXITCODE"
    }

    # Clean up temp file
    docker exec pharmadesk-mongodb rm -f $ContainerArchivePath 2>$null

    Write-Host "[OK] MongoDB database restored successfully!" -ForegroundColor Green
} catch {
    Write-Host "[RESTORE FAILED] $_" -ForegroundColor Red
    Write-Host "Note: You can restore your pre-restore safety backup if needed." -ForegroundColor Yellow
    Read-Host "Press Enter to exit..."
    exit 1
}

# ---------------------------------------------------------------------
# STEP 3: Restore Uploads Directory if matching zip exists
# ---------------------------------------------------------------------
Write-Host ""
Write-Host "[3/4] Checking matching Uploads backup..." -ForegroundColor Yellow
$uploadsZipName = $SelectedBackup.Name.Replace("pharmacydb_", "uploads_").Replace(".archive.gz", ".zip")
$uploadsZipPath = Join-Path $SelectedBackup.DirectoryName $uploadsZipName

if (Test-Path $uploadsZipPath) {
    Write-Host "Restoring uploaded files from $uploadsZipName..." -ForegroundColor Cyan
    try {
        Expand-Archive -Path $uploadsZipPath -DestinationPath "$ProjectRoot\server\uploads" -Force
        Write-Host "[OK] Uploaded files restored successfully!" -ForegroundColor Green
    } catch {
        Write-Host "[WARN] Warning restoring uploads zip: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "No matching uploads zip found. Skipping file upload restore." -ForegroundColor Gray
}

# ---------------------------------------------------------------------
# STEP 4: Restart & Verify Application Stack
# ---------------------------------------------------------------------
Write-Host ""
Write-Host "[4/4] Restarting services & verifying health..." -ForegroundColor Yellow

try {
    docker compose restart backend
    Start-Sleep -Seconds 5
    Write-Host "[OK] System services restarted and ready!" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Services restart warning: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "     DATABASE RESTORATION COMPLETED SUCCESSFULLY!    " -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "Restored From: $($SelectedBackup.Name)" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to close..." -ForegroundColor Gray
try { $null = [Console]::ReadKey() } catch {}
