# =====================================================================
# Sardar Pharmacy - Windows Desktop Shortcut Installer (PowerShell)
# =====================================================================

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path "$ScriptDir\..").Path

Set-Location $ProjectRoot

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "     SARDAR PHARMACY DESKTOP SHORTCUT CREATOR        " -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

$DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$ShortcutPath = Join-Path $DesktopPath "Sardar Pharmacy.lnk"
$TargetBat = Join-Path $ProjectRoot "Start-Sardar-Pharmacy.bat"

if (-not (Test-Path $TargetBat)) {
    Write-Host "[ERROR] Target batch launcher file not found at: $TargetBat" -ForegroundColor Red
    Read-Host "Press Enter to exit..."
    exit 1
}

try {
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = $TargetBat
    $Shortcut.WorkingDirectory = $ProjectRoot
    $Shortcut.Description = "Launch Sardar Pharmacy Management System (1-Click)"
    
    # Try to set standard shell icon
    $shell32Path = "$env:SystemRoot\System32\shell32.dll"
    if (Test-Path $shell32Path) {
        $Shortcut.IconLocation = "$shell32Path, 14"
    }
    
    $Shortcut.Save()

    Write-Host "[OK] DESKTOP SHORTCUT CREATED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "Name    : Sardar Pharmacy.lnk" -ForegroundColor White
    Write-Host "Location: $DesktopPath" -ForegroundColor White
    Write-Host "Target  : $TargetBat" -ForegroundColor White
    Write-Host ""
    Write-Host "You can now double-click 'Sardar Pharmacy' on your Desktop anytime to run the system!" -ForegroundColor Yellow
} catch {
    Write-Host "[ERROR] Failed to create desktop shortcut: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to close..." -ForegroundColor Gray
try { $null = [Console]::ReadKey() } catch {}
