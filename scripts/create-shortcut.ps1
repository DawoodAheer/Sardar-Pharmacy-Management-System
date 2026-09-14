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

$DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)

# -----------------------------------------------------------------
# Shortcut 1: Docker Launcher (Start-Sardar-Pharmacy.bat)
# -----------------------------------------------------------------
$ShortcutPath = Join-Path $DesktopPath "Sardar Medical Store.lnk"
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
    $Shortcut.Description = "Launch Sardar Medical Store Management System (1-Click)"
    
    # Try to set standard shell icon
    $shell32Path = "$env:SystemRoot\System32\shell32.dll"
    if (Test-Path $shell32Path) {
        $Shortcut.IconLocation = "$shell32Path, 14"
    }
    
    $Shortcut.Save()

    Write-Host "[OK] DESKTOP SHORTCUT 1 CREATED: Sardar Medical Store.lnk" -ForegroundColor Green
    Write-Host "     (Docker launcher + full startup pipeline)" -ForegroundColor Gray
} catch {
    Write-Host "[ERROR] Failed to create desktop shortcut: $_" -ForegroundColor Red
}

# -----------------------------------------------------------------
# Shortcut 2: Desktop App Window (Chrome/Edge --app mode)
# -----------------------------------------------------------------
Write-Host ""
Write-Host "Creating Desktop App Window shortcut..." -ForegroundColor Yellow

$AppShortcutPath = Join-Path $DesktopPath "Sardar Medical Store App.lnk"
$AppUrl = "http://localhost:5173"

# Detect browser path: prefer Chrome, then Edge
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

if ($BrowserPath) {
    try {
        $WshShell2 = New-Object -ComObject WScript.Shell
        $AppShortcut = $WshShell2.CreateShortcut($AppShortcutPath)
        $AppShortcut.TargetPath = $BrowserPath
        $AppShortcut.Arguments = "--app=$AppUrl --new-window"
        $AppShortcut.WorkingDirectory = $ProjectRoot
        $AppShortcut.Description = "Sardar Medical Store - Desktop App Window (No Address Bar)"
        
        # Use browser icon
        $AppShortcut.IconLocation = "$BrowserPath, 0"
        
        $AppShortcut.Save()

        Write-Host "[OK] DESKTOP SHORTCUT 2 CREATED: Sardar Medical Store App.lnk" -ForegroundColor Green
        Write-Host "     (Opens in $BrowserName as a frameless desktop app window)" -ForegroundColor Gray
    } catch {
        Write-Host "[ERROR] Failed to create app shortcut: $_" -ForegroundColor Red
    }
} else {
    Write-Host "[WARN] Neither Google Chrome nor Microsoft Edge found." -ForegroundColor Yellow
    Write-Host "       Skipping desktop app shortcut creation." -ForegroundColor Yellow
}

# -----------------------------------------------------------------
# Summary
# -----------------------------------------------------------------
Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  SHORTCUTS CREATED ON YOUR DESKTOP:" -ForegroundColor Green
Write-Host "  1. Sardar Medical Store        — Full Docker launcher" -ForegroundColor White
Write-Host "  2. Sardar Medical Store App    — Desktop app window" -ForegroundColor White
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Desktop Location: $DesktopPath" -ForegroundColor Gray
Write-Host ""
Write-Host "Press any key to close..." -ForegroundColor Gray
try { $null = [Console]::ReadKey() } catch {}
