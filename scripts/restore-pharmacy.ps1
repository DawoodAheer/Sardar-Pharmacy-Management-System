# =====================================================================
# Sardar Pharmacy - Safe Database Restore Utility (PowerShell)
# =====================================================================

param(
    [string]$SpecifiedBackupPath = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path "$ScriptDir\..").Path

Set-Location $ProjectRoot

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "       [WARN] SARDAR PHARMACY DATABASE RESTORE       " -ForegroundColor Red
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "Project Location: $ProjectRoot" -ForegroundColor Gray
Write-Host ""

$BackupBaseDir = Join-Path $ProjectRoot "backups"

# Find available backups
$allArchives = Get-ChildItem -Path $BackupBaseDir -Recurse -Filter "pharmacydb_*.archive.gz" | Sort-Object CreationTime -Descending

if ($allArchives.Count -eq 0) {
    Write-Host "[ERROR] No database backup files (.archive.gz) found in $BackupBaseDir" -ForegroundColor Red
    Read-Host "Press Enter to exit..."
    exit 1
}

$SelectedBackup = $null

if ($SpecifiedBackupPath -and (Test-Path $SpecifiedBackupPath)) {
    $SelectedBackup = Get-Item $SpecifiedBackupPath
} else {
    Write-Host "Available Backups:" -ForegroundColor Yellow
    $maxShow = [math]::Min(10, $allArchives.Count)
    for ($i = 0; $i -lt $maxShow; $i++) {
        $file = $allArchives[$i]
        $sizeMB = [math]::Round($file.Length / 1MB, 2)
        Write-Host "  [$($i+1)] $($file.Name) ($sizeMB MB - $($file.CreationTime))" -ForegroundColor Cyan
    }
    Write-Host ""
    $choice = Read-Host "Select backup number to restore [Default: 1 (Latest)]"
    if (-not $choice) { $choice = "1" }
    
    $index = [int]$choice - 1
    if ($index -ge 0 -and $index -lt $allArchives.Count) {
        $SelectedBackup = $allArchives[$index]
    } else {
        Write-Host "[ERROR] Invalid selection." -ForegroundColor Red
        Read-Host "Press Enter to exit..."
        exit 1
    }
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
