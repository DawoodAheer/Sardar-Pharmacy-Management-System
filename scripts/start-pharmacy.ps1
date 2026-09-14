# =====================================================================
# Sardar Medical Store - 1-Click Desktop Launcher Script (PowerShell)
# =====================================================================

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path "$ScriptDir\..").Path

Set-Location $ProjectRoot

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "         Sardar Medical Store MANAGEMENT SYSTEM           " -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "Project Location: $ProjectRoot" -ForegroundColor Gray
Write-Host ""

# ---------------------------------------------------------------------
# Step 1: Detect Docker Desktop Installation & Daemon Status
# ---------------------------------------------------------------------
Write-Host "[1/5] Checking Docker installation..." -ForegroundColor Yellow

$dockerCli = Get-Command "docker" -ErrorAction SilentlyContinue

if (-not $dockerCli) {
    Write-Host "[CRITICAL ERROR] Docker CLI is not installed on this system!" -ForegroundColor Red
    Write-Host "Please install Docker Desktop from https://www.docker.com/products/docker-desktop and try again." -ForegroundColor Yellow
    Read-Host "Press Enter to exit..."
    exit 1
}

# Test if Docker daemon is responsive
$isDockerRunning = $false
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -eq 0) {
        $isDockerRunning = $true
    }
} catch {
    $isDockerRunning = $false
}

if (-not $isDockerRunning) {
    Write-Host "[WARN] Docker Engine is not running. Attempting to start Docker Desktop..." -ForegroundColor Yellow
    
    $dockerDesktopPaths = @(
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Programs\Docker\Docker\Docker Desktop.exe"
    )

    $dockerExe = $dockerDesktopPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

    if (-not $dockerExe) {
        Write-Host "[ERROR] Docker Desktop executable not found in standard paths." -ForegroundColor Red
        Write-Host "Please start Docker Desktop manually from the Start Menu, then re-run this script." -ForegroundColor Yellow
        Read-Host "Press Enter to exit..."
        exit 1
    }

    Write-Host "[INFO] Launching Docker Desktop: $dockerExe" -ForegroundColor Cyan
    Start-Process -FilePath $dockerExe

    Write-Host "[INFO] Waiting for Docker Engine to initialize (up to 120s)..." -ForegroundColor Yellow
    $waited = 0
    $maxWait = 120

    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 3
        $waited += 3
        try {
            $null = docker info 2>&1
            if ($LASTEXITCODE -eq 0) {
                $isDockerRunning = $true
                break
            }
        } catch {}
        Write-Host "." -NoNewline -ForegroundColor Gray
    }
    Write-Host ""

    if (-not $isDockerRunning) {
        Write-Host "[ERROR] Docker Engine failed to respond after $maxWait seconds." -ForegroundColor Red
        Write-Host "Please ensure Docker Desktop is fully opened and running, then try again." -ForegroundColor Yellow
        Read-Host "Press Enter to exit..."
        exit 1
    }
}

Write-Host "[OK] Docker Engine is ready and active!" -ForegroundColor Green

# ---------------------------------------------------------------------
# Step 2: Start Docker Compose Stack (Preserving Persistent Volumes)
# ---------------------------------------------------------------------
Write-Host ""
Write-Host "[2/5] Starting Sardar Medical Store Docker Services..." -ForegroundColor Yellow

# NEVER use -v or destructive flags here
try {
    docker compose up -d
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose up exited with code $LASTEXITCODE"
    }
} catch {
    Write-Host "[ERROR] Failed to start Docker Compose stack: $_" -ForegroundColor Red
    Read-Host "Press Enter to exit..."
    exit 1
}

# ---------------------------------------------------------------------
# Step 3: Healthcheck Polling (MongoDB -> Backend -> Frontend)
# ---------------------------------------------------------------------
Write-Host ""
Write-Host "[3/5] Verifying System Health & Readiness..." -ForegroundColor Yellow

# Helper function to poll an HTTP endpoint
function Test-HttpEndpoint {
    param([string]$Url, [int]$TimeoutSeconds = 45)
    $elapsed = 0
    while ($elapsed -lt $TimeoutSeconds) {
        try {
            $req = [System.Net.WebRequest]::Create($Url)
            $req.Timeout = 3000
            $res = $req.GetResponse()
            if ($res.StatusCode -eq 200 -or $res.StatusCode -eq 302 -or $res.StatusCode -eq 304) {
                $res.Close()
                return $true
            }
            $res.Close()
        } catch {}
        Start-Sleep -Seconds 2
        $elapsed += 2
        Write-Host "." -NoNewline -ForegroundColor Gray
    }
    Write-Host ""
    return $false
}

# 3A. Wait for MongoDB
Write-Host "  * Checking MongoDB Database..." -NoNewline -ForegroundColor Cyan
$mongoReady = $false
for ($i = 0; $i -lt 30; $i++) {
    $status = docker inspect --format='{{json .State.Health.Status}}' pharmadesk-mongodb 2>$null
    if ($status -eq '"healthy"') {
        $mongoReady = $true
        break
    }
    Start-Sleep -Seconds 2
    Write-Host "." -NoNewline -ForegroundColor Gray
}
Write-Host ""
if ($mongoReady) {
    Write-Host "  [OK] MongoDB is healthy and reachable!" -ForegroundColor Green
} else {
    Write-Host "  [WARN] MongoDB healthcheck warning (proceeding to backend)..." -ForegroundColor Yellow
}

# 3B. Wait for Backend API
Write-Host "  * Checking Express Backend API (http://localhost:5000)..." -NoNewline -ForegroundColor Cyan
$backendReady = Test-HttpEndpoint -Url "http://localhost:5000/" -TimeoutSeconds 30
if ($backendReady) {
    Write-Host "  [OK] Backend API is ready!" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Backend API is taking longer than usual to respond." -ForegroundColor Yellow
}

# 3C. Wait for Frontend Client
Write-Host "  * Checking React Frontend Application (http://localhost:5173)..." -NoNewline -ForegroundColor Cyan
$frontendReady = Test-HttpEndpoint -Url "http://localhost:5173/" -TimeoutSeconds 30
if ($frontendReady) {
    Write-Host "  [OK] Frontend Application is ready!" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Frontend Application verification warning." -ForegroundColor Yellow
}

# ---------------------------------------------------------------------
# Step 4: System Ready & Automatic Browser Launch
# ---------------------------------------------------------------------
Write-Host ""
Write-Host "[4/5] Launching Sardar Medical Store Portal..." -ForegroundColor Yellow
$appUrl = "http://localhost:5173"

try {
    Start-Process $appUrl
    Write-Host "[OK] Opened $appUrl in your default web browser!" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Could not auto-launch browser. Please open: $appUrl manually." -ForegroundColor Yellow
}

# ---------------------------------------------------------------------
# Step 5: Summary & Test Accounts
# ---------------------------------------------------------------------
Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "   Sardar Medical Store IS RUNNING & READY TO USE!        " -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "Local URL: $appUrl" -ForegroundColor White
Write-Host "Database : Local Offline MongoDB Container (Port 27017)" -ForegroundColor White
Write-Host "Backups  : Host Directory ($ProjectRoot\backups)" -ForegroundColor White
Write-Host ""
Write-Host "DEFAULT LOGIN CREDENTIALS:" -ForegroundColor Yellow
Write-Host "  * Superadmin : aheerdawood014@gmail.com  / Password: Dawood@@5786" -ForegroundColor Gray
Write-Host "  * Pharmacist : mlksardar6@gmail.com      / Password: Dawood@@5786" -ForegroundColor Gray
Write-Host "  * Customer   : aheerraza0@gmail.com      / Password: Dawood@@5786" -ForegroundColor Gray
Write-Host ""
Write-Host "To stop the system safely anytime, run 'Stop-Sardar-Pharmacy.bat'." -ForegroundColor Gray
Write-Host "Press any key to close this console window..." -ForegroundColor Gray
try { $null = [Console]::ReadKey() } catch {}
