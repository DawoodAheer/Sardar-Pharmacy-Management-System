param (
    [switch]$NoPause
)

# =====================================================================
# Sardar Medical Store - Windows Desktop Shortcut Creator
# Creates ONE shortcut: Start-Sardar-Pharmacy.bat launcher
# (App opens in Chrome/Edge app mode via the launcher itself)
# =====================================================================

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path "$ScriptDir\..").Path

# Find all valid Desktop paths (Personal Desktop, OneDrive Desktop, Public Desktop)
$PossibleDesktopPaths = @(
    [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop),
    [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::CommonDesktopDirectory),
    "$env:USERPROFILE\Desktop",
    "$env:USERPROFILE\OneDrive\Desktop"
) | Where-Object { [string]::IsNullOrWhiteSpace($_) -eq $false } | Select-Object -Unique | Where-Object { Test-Path $_ }

$TargetBat = Join-Path $ProjectRoot "Start-Sardar-Pharmacy.bat"

if (-not (Test-Path $TargetBat)) {
    Write-Host "[ERROR] Launcher file not found: $TargetBat" -ForegroundColor Red
    if (-not $NoPause) { Read-Host "Press Enter to exit..." }
    exit 1
}

# Pick a nice icon - use a pharmacy/store icon from shell32
$IconPath = "$env:SystemRoot\System32\shell32.dll"
$IconIndex = 14  # briefcase/store style icon

$WshShell = New-Object -ComObject WScript.Shell

$created = 0
foreach ($DesktopFolder in $PossibleDesktopPaths) {
    $ShortcutPath = Join-Path $DesktopFolder "Sardar Medical Store.lnk"

    try {
        $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
        $Shortcut.TargetPath       = $TargetBat
        $Shortcut.WorkingDirectory = $ProjectRoot
        $Shortcut.Description      = "Sardar Medical Store - 1-Click Launch"
        $Shortcut.WindowStyle      = 1
        if (Test-Path $IconPath) {
            $Shortcut.IconLocation = "$IconPath, $IconIndex"
        }
        $Shortcut.Save()
        Write-Host "[OK] Desktop shortcut created / updated: $ShortcutPath" -ForegroundColor Green
        $created++
    } catch {
        Write-Host "[WARN] Could not create shortcut at $DesktopFolder : $_" -ForegroundColor Yellow
    }
}

if ($created -gt 0) {
    Write-Host ""
    Write-Host "  Double-click 'Sardar Medical Store' on your Desktop to launch!" -ForegroundColor Cyan
}

if (-not $NoPause) {
    Write-Host ""
    Write-Host "Press any key to close..." -ForegroundColor DarkGray
    try { $null = [Console]::ReadKey() } catch {}
}
