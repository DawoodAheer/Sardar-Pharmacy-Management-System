# =====================================================================
# Sardar Medical Store - 1-Click Desktop Launcher Script (PowerShell)
# Fast: ~5s if Docker already running, ~60s cold start
# =====================================================================

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path "$ScriptDir\..").Path
$AppUrl = "http://localhost:5173"

Set-Location $ProjectRoot

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "       Sardar Medical Store - Starting...             " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------------------
# Step 1: Check Docker Installation
# ---------------------------------------------------------------------
Write-Host "[1/4] Checking Docker..." -ForegroundColor Yellow

$dockerCli = Get-Command "docker" -ErrorAction SilentlyContinue
if (-not $dockerCli) {
    Write-Host "[ERROR] Docker is not installed!" -ForegroundColor Red
    Write-Host "Install Docker Desktop from: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    Read-Host "Press Enter to exit..."
    exit 1
}

# Check if Docker daemon is already running
$isDockerRunning = $false
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -eq 0) { $isDockerRunning = $true }
} catch {}

if (-not $isDockerRunning) {
    Write-Host "[INFO] Docker not running - starting Docker Desktop..." -ForegroundColor Yellow

    $dockerDesktopPaths = @(
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Programs\Docker\Docker\Docker Desktop.exe"
    )
    $dockerExe = $dockerDesktopPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

    if (-not $dockerExe) {
        Write-Host "[ERROR] Docker Desktop not found. Please start it manually then re-run." -ForegroundColor Red
        Read-Host "Press Enter to exit..."
        exit 1
    }

    Start-Process -FilePath $dockerExe
    Write-Host "[INFO] Waiting for Docker Engine (up to 90 seconds)..." -ForegroundColor Yellow

    $waited = 0
    while ($waited -lt 90) {
        Start-Sleep -Seconds 3
        $waited += 3
        try {
            $null = docker info 2>&1
            if ($LASTEXITCODE -eq 0) { $isDockerRunning = $true; break }
        } catch {}
        Write-Host "." -NoNewline -ForegroundColor Gray
    }
    Write-Host ""

    if (-not $isDockerRunning) {
        Write-Host "[ERROR] Docker failed to start after 90 seconds." -ForegroundColor Red
        Read-Host "Press Enter to exit..."
        exit 1
    }
}

Write-Host "[OK] Docker Engine is running!" -ForegroundColor Green

# ---------------------------------------------------------------------
# Step 2: Start Docker Services (fast - skips already-running ones)
# ---------------------------------------------------------------------
Write-Host ""
Write-Host "[2/4] Starting pharmacy services..." -ForegroundColor Yellow

try {
    docker compose up -d 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "docker compose up failed with code $LASTEXITCODE" }
} catch {
    Write-Host "[ERROR] Failed to start services: $_" -ForegroundColor Red
    Read-Host "Press Enter to exit..."
    exit 1
}

Write-Host "[OK] Services started!" -ForegroundColor Green

# ---------------------------------------------------------------------
# Step 3: Wait for App to be Ready (smart polling, max 90s)
# ---------------------------------------------------------------------
Write-Host ""
Write-Host "[3/4] Waiting for application to be ready..." -ForegroundColor Yellow

$ready = $false
$elapsed = 0
$maxWait = 90

while ($elapsed -lt $maxWait) {
    try {
        $req = [System.Net.WebRequest]::Create($AppUrl)
        $req.Timeout = 2000
        $res = $req.GetResponse()
        $code = [int]$res.StatusCode
        $res.Close()
        if ($code -ge 200 -and $code -lt 400) {
            $ready = $true
            break
        }
    } catch {}
    Start-Sleep -Seconds 2
    $elapsed += 2
    Write-Host "." -NoNewline -ForegroundColor Gray
}
Write-Host ""

if ($ready) {
    Write-Host "[OK] Application is READY! (took ${elapsed}s)" -ForegroundColor Green
} else {
    Write-Host "[WARN] App may still be loading - opening browser anyway..." -ForegroundColor Yellow
}

# ---------------------------------------------------------------------
# Step 4: Open App in Browser (app-mode = no address bar, like desktop app)
# ---------------------------------------------------------------------
Write-Host ""
Write-Host "[4/4] Opening Sardar Medical Store..." -ForegroundColor Yellow

$opened = $false

# Try Chrome app mode first (no address bar - feels like native desktop app)
$ChromePaths = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
foreach ($p in $ChromePaths) {
    if (Test-Path $p) {
        Start-Process -FilePath $p -ArgumentList "--app=$AppUrl", "--new-window"
        Write-Host "[OK] Opened in Google Chrome (app mode - no address bar)" -ForegroundColor Green
        $opened = $true
        break
    }
}

# Try Edge app mode if Chrome not found
if (-not $opened) {
    $EdgePaths = @(
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    )
    foreach ($p in $EdgePaths) {
        if (Test-Path $p) {
            Start-Process -FilePath $p -ArgumentList "--app=$AppUrl", "--new-window"
            Write-Host "[OK] Opened in Microsoft Edge (app mode - no address bar)" -ForegroundColor Green
            $opened = $true
            break
        }
    }
}

# Fallback: open in default browser
if (-not $opened) {
    Start-Process $AppUrl
    Write-Host "[OK] Opened in default browser" -ForegroundColor Green
}

# ---------------------------------------------------------------------
# Create Desktop Shortcut (only if it does not already exist)
# ---------------------------------------------------------------------
$shortcutPath1 = "$env:USERPROFILE\Desktop\Sardar Medical Store.lnk"
$shortcutPath2 = "$env:USERPROFILE\OneDrive\Desktop\Sardar Medical Store.lnk"
$shortcutExists = (Test-Path $shortcutPath1) -or (Test-Path $shortcutPath2)

if (-not $shortcutExists) {
    Write-Host ""
    Write-Host "[INFO] Creating Desktop shortcut (first time only)..." -ForegroundColor Cyan
    try {
        & "$ScriptDir\create-shortcut.ps1" -NoPause
    } catch {
        Write-Host "[WARN] Shortcut creation skipped." -ForegroundColor Yellow
    }
}

# ---------------------------------------------------------------------
# Done!
# ---------------------------------------------------------------------
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   Sardar Medical Store IS RUNNING AND READY!         " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  URL        : $AppUrl" -ForegroundColor White
Write-Host "  Superadmin : aheerdawood014@gmail.com / Dawood@@5786" -ForegroundColor Gray
Write-Host "  Pharmacist : mlksardar6@gmail.com     / Dawood@@5786" -ForegroundColor Gray
Write-Host ""
Write-Host "  To stop safely: run Stop-Sardar-Pharmacy.bat" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Press any key to close this window..." -ForegroundColor DarkGray
try { $null = [Console]::ReadKey() } catch {}
