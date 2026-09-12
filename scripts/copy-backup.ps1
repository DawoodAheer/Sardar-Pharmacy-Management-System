# =====================================================================
# Sardar Pharmacy — Copy Backups to External Drive Utility (PowerShell)
# =====================================================================

param(
    [string]$TargetExternalDrivePath = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path "$ScriptDir\.." | Select-Object -ExpandProperty Path

Set-Location $ProjectRoot

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "     SARDAR PHARMACY EXTERNAL DRIVE BACKUP COPY      " -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

$BackupSourceDir = "$ProjectRoot\backups"

# Resolve Target External Drive Path
if (-not $TargetExternalDrivePath) {
    # Scan available drives (e.g., E:\, F:\, D:\ if external)
    $drives = Get-Volume | Where-Object { $_.DriveType -eq 'Removable' -or ($_.DriveLetter -and $_.DriveLetter -ne 'C') } | Select-Object DriveLetter, FileSystemLabel
    
    if ($drives) {
        Write-Host "Detected Drives:" -ForegroundColor Yellow
        foreach ($d in $drives) {
            Write-Host "  * Drive $($d.DriveLetter): ($($d.FileSystemLabel))" -ForegroundColor Cyan
        }
    }
    
    Write-Host ""
    $inputDrive = Read-Host "Enter external drive letter or full destination folder path (e.g. E:\SardarPharmacyBackups)"
    
    if (-not $inputDrive) {
        Write-Host "[ERROR] No destination path specified. Exiting..." -ForegroundColor Red
        Read-Host "Press Enter to exit..."
        exit 1
    }

    if ($inputDrive.Length -eq 1 -or ($inputDrive.Length -eq 2 -and $inputDrive.EndsWith(":"))) {
        $cleanLetter = $inputDrive.Replace(":", "").ToUpper()
        $TargetExternalDrivePath = "${cleanLetter}:\SardarPharmacyBackups"
    }
    else {
        $TargetExternalDrivePath = $inputDrive
    }
}

Write-Host ""
Write-Host "Source      : $BackupSourceDir" -ForegroundColor White
Write-Host "Destination : $TargetExternalDrivePath" -ForegroundColor White
Write-Host ""

if (-not (Test-Path $TargetExternalDrivePath)) {
    try {
        New-Item -ItemType Directory -Path $TargetExternalDrivePath -Force | Out-Null
        Write-Host "Created destination folder: $TargetExternalDrivePath" -ForegroundColor Cyan
    }
    catch {
        Write-Host "[ERROR] Could not create destination path: $_" -ForegroundColor Red
        Read-Host "Press Enter to exit..."
        exit 1
    }
}

Write-Host "Mirroring backup files to external drive..." -ForegroundColor Cyan

try {
    # Copy all backups and zips recursively while preserving folder hierarchy
    Copy-Item -Path "$BackupSourceDir\*" -Destination $TargetExternalDrivePath -Recurse -Force
    Write-Host ""
    Write-Host "[OK] BACKUP COPY COMPLETED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "[PHYSICAL PROTECTION ACTIVE] Copies stored on external drive ($TargetExternalDrivePath)." -ForegroundColor Cyan
}
catch {
    Write-Host "[ERROR] Error copying backups to external drive: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to close..." -ForegroundColor Gray
try { $null = [Console]::ReadKey() } catch {}
