# =====================================================================
# Sardar Medical Store - Windows Desktop Shortcut Installer (PowerShell)
# Creates TWO shortcuts:
#   1. Sardar Medical Store (Docker Launcher)
#   2. Sardar Medical Store App (PWA-like Chrome/Edge window without address bar)
# =====================================================================

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path "$ScriptDir\..").Path

Set-Location $ProjectRoot

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "     Sardar Medical Store DESKTOP SHORTCUT CREATOR        " -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

$PossibleDesktopPaths = @(
    [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop),
    "$env:USERPROFILE\Desktop",
    "$env:USERPROFILE\OneDrive\Desktop"
) | Select-Object -Unique | Where-Object { Test-Path $_ }

$TargetBat = Join-Path $ProjectRoot "Start-Sardar-Pharmacy.bat"

if (-not (Test-Path $TargetBat)) {
    Write-Host "[ERROR] Target batch launcher file not found at: $TargetBat" -ForegroundColor Red
    Read-Host "Press Enter to exit..."
    exit 1
}

# -----------------------------------------------------------------
# Detect browser path: prefer Chrome, then Edge
# -----------------------------------------------------------------
$BrowserPath = ""
$BrowserName = ""

$ChromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$EdgePaths = @(
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)

foreach ($p in $ChromePaths) {
    if (Test-Path $p) {
        $BrowserPath = $p
        $BrowserName = "Google Chrome"
        break
    }
}

if (-not $BrowserPath) {
    foreach ($p in $EdgePaths) {
        if (Test-Path $p) {
            $BrowserPath = $p
            $BrowserName = "Microsoft Edge"
            break
        }
    }
}

$WshShell = New-Object -ComObject WScript.Shell
$AppUrl = "http://localhost:5173"

foreach ($DesktopFolder in $PossibleDesktopPaths) {
    # 1. Launcher Shortcut
    try {
        $ShortcutPath = Join-Path $DesktopFolder "Sardar Medical Store.lnk"
        $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
        $Shortcut.TargetPath = $TargetBat
        $Shortcut.WorkingDirectory = $ProjectRoot
        $Shortcut.Description = "Launch Sardar Medical Store Management System (1-Click)"
        
        $shell32Path = "$env:SystemRoot\System32\shell32.dll"
        if (Test-Path $shell32Path) {
            $Shortcut.IconLocation = "$shell32Path, 14"
        }
        
        $Shortcut.Save()
        Write-Host "[OK] DESKTOP LAUNCHER CREATED: $ShortcutPath" -ForegroundColor Green
    } catch {
        Write-Host "[WARN] Could not create launcher shortcut at $DesktopFolder" -ForegroundColor Yellow
    }

    # 2. App Window Shortcut
    if ($BrowserPath) {
        try {
            $AppShortcutPath = Join-Path $DesktopFolder "Sardar Medical Store App.lnk"
            $AppShortcut = $WshShell.CreateShortcut($AppShortcutPath)
            $AppShortcut.TargetPath = $BrowserPath
            $AppShortcut.Arguments = "--app=$AppUrl --new-window"
            $AppShortcut.WorkingDirectory = $ProjectRoot
            $AppShortcut.Description = "Sardar Medical Store - Desktop App Window (No Address Bar)"
            $AppShortcut.IconLocation = "$BrowserPath, 0"
            $AppShortcut.Save()
            Write-Host "[OK] DESKTOP APP SHORTCUT CREATED: $AppShortcutPath" -ForegroundColor Green
        } catch {
            Write-Host "[WARN] Could not create app shortcut at $DesktopFolder" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  SHORTCUTS CREATED ON YOUR DESKTOP!" -ForegroundColor Green
Write-Host "  1. Sardar Medical Store     -- Full Docker launcher" -ForegroundColor White
Write-Host "  2. Sardar Medical Store App -- Frameless Desktop App Window" -ForegroundColor White
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to close..." -ForegroundColor Gray
try { $null = [Console]::ReadKey() } catch {}
