# =====================================================================
# Sardar Pharmacy - Backup Verification Utility (PowerShell)
# =====================================================================

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path "$ScriptDir\..").Path

Set-Location $ProjectRoot

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "       [INFO] SARDAR PHARMACY BACKUP VERIFIER        " -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "Project Location: $ProjectRoot" -ForegroundColor Gray
Write-Host ""

$BackupBaseDir = Join-Path $ProjectRoot "backups"

$archives = Get-ChildItem -Path $BackupBaseDir -Recurse -Filter "*.archive.gz" | Sort-Object CreationTime -Descending

if ($archives.Count -eq 0) {
    Write-Host "[WARN] No backup archive files found in $BackupBaseDir" -ForegroundColor Red
    Read-Host "Press Enter to exit..."
    exit 1
}

Write-Host "Verifying $($archives.Count) backup archive(s)..." -ForegroundColor Yellow
Write-Host ""

$validCount = 0
$invalidCount = 0

foreach ($file in $archives) {
    Write-Host "Checking: $($file.Name)... " -NoNewline -ForegroundColor Cyan
    
    # Check 1: File size > 0
    if ($file.Length -eq 0) {
        Write-Host "[FAIL] (File size is 0 bytes)" -ForegroundColor Red
        $invalidCount++
        continue
    }

    # Check 2: Test Gzip Magic Header (0x1F, 0x8B)
    try {
        $stream = [System.IO.File]::OpenRead($file.FullName)
        $b1 = $stream.ReadByte()
        $b2 = $stream.ReadByte()
        $stream.Close()

        if ($b1 -eq 0x1F -and $b2 -eq 0x8B) {
            $sizeMB = [math]::Round($file.Length / 1MB, 2)
            Write-Host "[VALID GZIP ARCHIVE] ($sizeMB MB - $($file.CreationTime))" -ForegroundColor Green
            $validCount++
        } else {
            Write-Host "[CORRUPTED] (Invalid Gzip header)" -ForegroundColor Red
            $invalidCount++
        }
    } catch {
        Write-Host "[ERROR] reading file: $_" -ForegroundColor Red
        $invalidCount++
    }
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "VERIFICATION SUMMARY:" -ForegroundColor Yellow
Write-Host "  * Total Archives Verified : $($archives.Count)" -ForegroundColor White
Write-Host "  * Valid Archives          : $validCount" -ForegroundColor Green
$invalidColor = "Gray"
if ($invalidCount -gt 0) { $invalidColor = "Red" }
Write-Host "  * Corrupted / Empty       : $invalidCount" -ForegroundColor $invalidColor
Write-Host "=====================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "Press any key to close..." -ForegroundColor Gray
try { $null = [Console]::ReadKey() } catch {}
