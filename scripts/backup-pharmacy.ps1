# =====================================================================
# Sardar Pharmacy — Database & Uploads Backup Utility (PowerShell)
# =====================================================================

param(
    [string]$BackupType = "manual"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path "$ScriptDir\.." | Select-Object -ExpandProperty Path

Set-Location $ProjectRoot

$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BackupBaseDir = Join-Path $ProjectRoot "backups"
$TargetDir = Join-Path $BackupBaseDir $BackupType
$LogDir = Join-Path $BackupBaseDir "logs"

# Ensure backup folders exist
$requiredDirs = @(
    $TargetDir,
    $LogDir,
    (Join-Path $BackupBaseDir "hourly"),
    (Join-Path $BackupBaseDir "daily"),
    (Join-Path $BackupBaseDir "pre-update"),
    (Join-Path $BackupBaseDir "pre-restore"),
    (Join-Path $BackupBaseDir "emergency")
)
foreach ($dir in $requiredDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

$LogFile = Join-Path $LogDir "backup.log"

function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    $timeStr = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logLine = "[$timeStr] [$Level] $Message"
    Add-Content -Path $LogFile -Value $logLine
    switch ($Level) {
        "ERROR"   { Write-Host $Message -ForegroundColor Red }
        "WARN"    { Write-Host $Message -ForegroundColor Yellow }
        "SUCCESS" { Write-Host $Message -ForegroundColor Green }
        Default   { Write-Host $Message -ForegroundColor Cyan }
    }
}

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "       SARDAR PHARMACY BACKUP GENERATOR              " -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "Backup Type: $BackupType" -ForegroundColor Gray
Write-Host "Timestamp  : $Timestamp" -ForegroundColor Gray
Write-Host ""

# 1. Verify Docker Engine & Container Status
Write-Log -Message "Checking MongoDB container status (pharmadesk-mongodb)..." -Level "INFO"

$containerRunning = $false
try {
    $statusOutput = & docker inspect --format='{{.State.Running}}' pharmadesk-mongodb 2>$null
    if ($statusOutput -eq "true") {
        $containerRunning = $true
    }
}
catch {}

if (-not $containerRunning) {
    Write-Log -Message "MongoDB container not running! Attempting to start..." -Level "WARN"
    try {
        & docker compose up -d mongodb
        Start-Sleep -Seconds 5
    }
    catch {
        Write-Log -Message "CRITICAL: Could not start MongoDB container for backup." -Level "ERROR"
        try { $null = [Console]::ReadKey() } catch {}
        exit 1
    }
}

# 2. Generate Compressed Database Backup via mongodump inside container
$DbArchiveFilename = "pharmacydb_${BackupType}_${Timestamp}.archive.gz"
$ContainerArchivePath = "/tmp/$DbArchiveFilename"
$HostArchivePath = Join-Path $TargetDir $DbArchiveFilename

Write-Log -Message "Creating compressed MongoDB dump file..." -Level "INFO"

try {
    # Execute mongodump directly inside MongoDB container
    & docker exec pharmadesk-mongodb mongodump --db=pharmadesk --archive=$ContainerArchivePath --gzip
    if ($LASTEXITCODE -ne 0) {
        throw "mongodump failed inside container (exit code $LASTEXITCODE)"
    }

    # Copy dump archive from container to host
    & docker cp "pharmadesk-mongodb:${ContainerArchivePath}" $HostArchivePath
    if ($LASTEXITCODE -ne 0) {
        throw "docker cp failed to copy archive to host"
    }

    # Remove temporary file inside container
    & docker exec pharmadesk-mongodb rm -f $ContainerArchivePath 2>$null

    if (Test-Path $HostArchivePath) {
        $fileSize = (Get-Item $HostArchivePath).Length
        $sizeMB = [math]::Round($fileSize / 1MB, 2)
        Write-Log -Message "Database archive created: $HostArchivePath [$sizeMB MB]" -Level "SUCCESS"
    }
    else {
        throw "Archive not found on host after copy"
    }
}
catch {
    $errMsg = $_.ToString()
    Write-Log -Message "Database backup failed: $errMsg" -Level "ERROR"
    try { $null = [Console]::ReadKey() } catch {}
    exit 1
}

# 3. Backup Uploads Directory (Photos, Receipts, OCR Scans)
$UploadsSource = Join-Path $ProjectRoot "server\uploads"
$UploadsZipFilename = "uploads_${BackupType}_${Timestamp}.zip"
$UploadsZipPath = Join-Path $TargetDir $UploadsZipFilename

if (Test-Path $UploadsSource) {
    Write-Log -Message "Backing up uploaded files directory..." -Level "INFO"
    try {
        Compress-Archive -Path "$UploadsSource\*" -DestinationPath $UploadsZipPath -Force
        Write-Log -Message "Uploads backup created: $UploadsZipPath" -Level "SUCCESS"
    }
    catch {
        Write-Log -Message "Could not zip uploads folder." -Level "WARN"
    }
}

# 4. Retention Policy — keep latest 30 backups
if ($BackupType -eq "daily" -or $BackupType -eq "manual") {
    Write-Log -Message "Applying backup retention policy (max 30)..." -Level "INFO"
    $existingBackups = Get-ChildItem -Path $TargetDir -Filter "pharmacydb_*.archive.gz" |
        Sort-Object CreationTime -Descending
    if ($existingBackups.Count -gt 30) {
        $toDelete = $existingBackups | Select-Object -Skip 30
        foreach ($oldFile in $toDelete) {
            Remove-Item $oldFile.FullName -Force
            Write-Log -Message "Pruned old backup: $($oldFile.Name)" -Level "INFO"
        }
    }
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "     BACKUP COMPLETED SUCCESSFULLY!                  " -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "Database Archive: $HostArchivePath" -ForegroundColor White
if (Test-Path $UploadsZipPath) {
    Write-Host "Uploads Archive : $UploadsZipPath" -ForegroundColor White
}
Write-Host ""
Write-Host "Press any key to close..." -ForegroundColor Gray
try { $null = [Console]::ReadKey() } catch {}
