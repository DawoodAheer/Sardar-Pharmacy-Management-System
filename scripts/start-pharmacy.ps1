# =====================================================================
# Sardar Medical Store - 1-Click Desktop Launcher Script (PowerShell)
# Fast, Clean, Crash-proof startup
# =====================================================================

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path "$ScriptDir\..").Path
$AppUrl = "http://localhost:5174"

Set-Location $ProjectRoot

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "       Sardar Medical Store - Starting...             " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------------------
# Step 1: Ensure Desktop Shortcut is created
# ---------------------------------------------------------------------
try {
    & "$ScriptDir\create-shortcut.ps1" -NoPause
} catch {}

# ---------------------------------------------------------------------
# Step 2: Check Docker Installation & Status
# ---------------------------------------------------------------------
Write-Host ""
Write-Host "[1/3] Checking Docker..." -ForegroundColor Yellow

$dockerCli = Get-Command "docker" -ErrorAction SilentlyContinue
if (-not $dockerCli) {
    Write-Host "[ERROR] Docker is not installed!" -ForegroundColor Red
    Write-Host "Install Docker Desktop from: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    Read-Host "Press Enter to exit..."
    exit 1
}

# Check if Docker daemon is running
$isDockerRunning = $false
try {
    $null = docker info 2>$null
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
        Write-Host "[ERROR] Docker Desktop not found. Please start Docker Desktop manually then re-run." -ForegroundColor Red
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
            $null = docker info 2>$null
            if ($LASTEXITCODE -eq 0) { $isDockerRunning = $true; break }
        } catch {}
        Write-Host "." -NoNewline -ForegroundColor Gray
    }
    Write-Host ""

    if (-not $isDockerRunning) {
        Write-Host "[ERROR] Docker failed to start after 90 seconds. Please start Docker Desktop and try again." -ForegroundColor Red
        Read-Host "Press Enter to exit..."
        exit 1
    }
}

Write-Host "[OK] Docker Engine is running!" -ForegroundColor Green

# ---------------------------------------------------------------------
# Step 3: Fast Instant Startup (Runs docker compose up safely)
# ---------------------------------------------------------------------
Write-Host ""
Write-Host "[2/3] Starting pharmacy services..." -ForegroundColor Yellow

# Run docker compose and capture exit code
$composeOutput = cmd /c "docker compose up -d 2>&1"
$composeExitCode = $LASTEXITCODE

if ($composeExitCode -ne 0) {
    Write-Host "[ERROR] Docker Compose failed to start services!" -ForegroundColor Red
    Write-Host $composeOutput -ForegroundColor Yellow
    Read-Host "Press Enter to exit..."
    exit 1
}

# Self-heal replica set member host so backend can always resolve internal mongodb:27017
$fixJs = 'try { let c = rs.conf(); if (c.members[0].host !== "mongodb:27017") { c.members[0].host = "mongodb:27017"; rs.reconfig(c, { force: true }); } } catch (e) {}'
docker exec pharmadesk-mongodb mongosh --quiet --eval $fixJs 2>$null

Write-Host "[OK] Containers launched!" -ForegroundColor Green

# ---------------------------------------------------------------------
# Step 4: Verify Health of MongoDB, Backend, and Frontend
# ---------------------------------------------------------------------
Write-Host ""
Write-Host "[3/3] Verifying services health (MongoDB, Backend, Frontend)..." -ForegroundColor Yellow

$mongoHealthy = $false
$backendHealthy = $false
$frontendHealthy = $false
$elapsed = 0
$maxWait = 60

while ($elapsed -lt $maxWait) {
    # 1. Check MongoDB container health
    if (-not $mongoHealthy) {
        $mStatus = & docker inspect --format='{{json .State.Health.Status}}' pharmadesk-mongodb 2>$null
        if ($mStatus -like '*healthy*') {
            $mongoHealthy = $true
            Write-Host " [MongoDB: HEALTHY]" -ForegroundColor Green -NoNewline
        }
    }

    # 2. Check Backend container health
    if (-not $backendHealthy) {
        $bStatus = & docker inspect --format='{{json .State.Health.Status}}' pharmadesk-backend 2>$null
        if ($bStatus -like '*healthy*') {
            $backendHealthy = $true
            Write-Host " [Backend: HEALTHY]" -ForegroundColor Green -NoNewline
        }
    }

    # 3. Check Frontend HTTP response on 5174 then 5173
    foreach ($url in @("http://localhost:5174", "http://localhost:5173")) {
        try {
            $req = [System.Net.WebRequest]::Create($url)
            $req.Timeout = 1500
            $res = $req.GetResponse()
            $code = [int]$res.StatusCode
            $res.Close()
            if ($code -ge 200 -and $code -lt 400) {
                $AppUrl = $url
                $frontendHealthy = $true
                break
            }
        } catch {}
    }

    if ($mongoHealthy -and $backendHealthy -and $frontendHealthy) {
        break
    }

    Start-Sleep -Seconds 2
    $elapsed += 2
    Write-Host "." -NoNewline -ForegroundColor Gray
}
Write-Host ""

if ($mongoHealthy -and $backendHealthy -and $frontendHealthy) {
    Write-Host "[OK] All pharmacy services are HEALTHY & READY at $AppUrl! (took ${elapsed}s)" -ForegroundColor Green
} else {
    Write-Host "[ERROR] One or more services failed to report healthy within ${maxWait}s:" -ForegroundColor Red
    Write-Host " - MongoDB  : $(if ($mongoHealthy) { 'HEALTHY' } else { 'UNHEALTHY / TIMEOUT' })" -ForegroundColor Yellow
    Write-Host " - Backend  : $(if ($backendHealthy) { 'HEALTHY' } else { 'UNHEALTHY / TIMEOUT' })" -ForegroundColor Yellow
    Write-Host " - Frontend : $(if ($frontendHealthy) { 'HEALTHY' } else { 'UNHEALTHY / TIMEOUT' })" -ForegroundColor Yellow
    Write-Host "Check container logs via: docker compose logs" -ForegroundColor Gray
    Read-Host "Press Enter to exit..."
    exit 1
}

# ---------------------------------------------------------------------
# Step 5: Open App in Browser (app mode - frameless desktop app look)
# ---------------------------------------------------------------------
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
