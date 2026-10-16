param([switch]$NoOpen, [switch]$NoShortcut)
$ErrorActionPreference = 'Stop'
$projectDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $projectDirectory
function Invoke-Docker {
    param([string[]]$Arguments)
    & docker @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed (exit $LASTEXITCODE). See the message above." }
}
function New-LocalSecret {
    $bytes = New-Object byte[] 48
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    return [Convert]::ToBase64String($bytes)
}
function Test-DockerEngine {
    $savedPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & docker info *> $null; return $LASTEXITCODE -eq 0 } finally { $ErrorActionPreference = $savedPreference }
}
function Test-FreePort([int]$Port) {
    $listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Any, $Port)
    try { $listener.Start(); return $true } catch { return $false } finally { $listener.Stop() }
}
try {
    Write-Host 'Sardar Medical Store - starting' -ForegroundColor Cyan
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        $cli = @("$env:ProgramFiles\Docker\Docker\resources\bin\docker.exe", "$env:LOCALAPPDATA\Programs\Docker\Docker\resources\bin\docker.exe") | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        if ($cli) { $env:PATH = (Split-Path $cli -Parent) + ';' + $env:PATH }
        else { throw 'Install Docker Desktop and complete its initial setup, then run this launcher again.' }
    }
    if (-not (Test-DockerEngine)) {
        $computer = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
        if ($computer -and -not $computer.HypervisorPresent) { throw 'Windows hypervisor is not running. Run Repair-Docker-Windows.bat, restart Windows when instructed, then retry.' }
        $desktopExecutables = @("$env:ProgramFiles\Docker\Docker\Docker Desktop.exe", "$env:LOCALAPPDATA\Programs\Docker\Docker\Docker Desktop.exe")
        $dockerDesktop = $desktopExecutables | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        if (-not $dockerDesktop) { throw 'Docker Engine is unavailable. Start Docker Desktop and retry.' }
        Start-Process -FilePath $dockerDesktop -WindowStyle Hidden
        $deadline = (Get-Date).AddMinutes(3)
        do {
            Start-Sleep -Seconds 3
            if (Test-DockerEngine) { break }
        } while ((Get-Date) -lt $deadline)
        if (-not (Test-DockerEngine)) { throw 'Docker Engine did not become ready. Check Docker Desktop / WSL setup.' }
    }
    Invoke-Docker -Arguments @('compose', 'version')
    $preferredPort = 5174
    if ($env:PHARMACY_PORT) {
        if (-not [int]::TryParse($env:PHARMACY_PORT, [ref]$preferredPort) -or $preferredPort -lt 1024 -or $preferredPort -gt 65525) { throw 'PHARMACY_PORT must be a port between 1024 and 65525.' }
    }
    # A running installation owns its mapping; reuse it on daily launch.
    $savedPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $running = & docker inspect --format '{{.State.Running}}' pharmadesk-frontend 2>$null
        $mapping = if ($running -eq 'true') { & docker compose port frontend 80 2>$null } else { '' }
    } finally { $ErrorActionPreference = $savedPreference }
    $selectedPort = 0
    if ($mapping -match ':(\d+)\s*$') { $selectedPort = [int]$Matches[1] }
    else {
        foreach ($candidate in $preferredPort..($preferredPort + 10)) {
            if (Test-FreePort $candidate) { $selectedPort = $candidate; break }
        }
    }
    if (-not $selectedPort) { throw 'No free application port was found. Close another application or set PHARMACY_PORT.' }
    $env:PHARMACY_PORT = [string]$selectedPort
    $applicationUrl = "http://localhost:$selectedPort"
    $env:CLIENT_URL = $applicationUrl
    Write-Host "Application address: $applicationUrl"
    $settings = Join-Path $projectDirectory '.env'
    if (-not (Test-Path -LiteralPath $settings)) {
        $contents = "JWT_ACCESS_SECRET=$(New-LocalSecret)`nJWT_REFRESH_SECRET=$(New-LocalSecret)`nCLIENT_URL=http://localhost:5174`n"
        [IO.File]::WriteAllText($settings, $contents, (New-Object Text.UTF8Encoding($false)))
    }
    if (-not $NoShortcut) { & (Join-Path $PSScriptRoot 'create-shortcut.ps1') -NoPause }
    Invoke-Docker -Arguments @('compose', 'config', '--quiet')
    # Compose can reuse an unchanged MongoDB container from a previous ZIP folder.
    # Align all service ownership labels so maintenance tools target one installation.
    $folderChanged = $false
    foreach ($container in @('pharmadesk-mongodb', 'pharmadesk-backend', 'pharmadesk-frontend')) {
        $savedPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            $inspection = & docker inspect $container 2>$null
            $inspectionExit = $LASTEXITCODE
        } finally { $ErrorActionPreference = $savedPreference }
        if ($inspectionExit -ne 0 -or -not $inspection) { continue }
        $details = ($inspection | ConvertFrom-Json)[0]
        if ($details.Config.Labels.'com.docker.compose.project' -ne 'sardar-pharmacy-management-system') {
            throw "$container belongs to a different Docker project. Stop and inspect that installation before continuing."
        }
        $owner = $details.Config.Labels.'com.docker.compose.project.working_dir'
        if (-not $owner) { throw "Missing installation folder for $container. Startup stopped to protect existing data." }
        if ($owner.Replace('/', '\').TrimEnd('\') -ine $projectDirectory.TrimEnd('\')) { $folderChanged = $true }
    }
    Write-Host 'Preparing services. The first launch needs internet and can take several minutes.'
    $sourceFiles = @('docker-compose.yml', 'server/Dockerfile', 'server/package.json', 'server/package-lock.json', 'server/server.js', 'server/env-loader.js', 'client/Dockerfile', 'client/nginx.conf', 'client/package.json', 'client/package-lock.json', 'client/index.html', 'client/vite.config.js')
    $sourceFiles += @('VERSION', '.dockerignore', 'server/.dockerignore', 'client/.dockerignore') | Where-Object { Test-Path -LiteralPath $_ }
    $sourceDirectories = @('server/controllers','server/models','server/utils','server/routes','server/config','server/middleware','client/src','client/public')
    $sourceFiles += Get-ChildItem -LiteralPath $sourceDirectories -Recurse -File | ForEach-Object { $_.FullName }
    $fingerprint = ($sourceFiles | Sort-Object | ForEach-Object { (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash }) -join ''
    $buildMarker = Join-Path $projectDirectory '.pharmacy-build-id'
    $previousBuild = if (Test-Path -LiteralPath $buildMarker) { [IO.File]::ReadAllText($buildMarker) } else { '' }
    $composeArguments = @('compose', 'up', '-d', '--wait', '--wait-timeout', '180')
    if ($folderChanged) {
        Write-Host 'Aligning containers with this installation folder. The existing database volume is retained.'
        $composeArguments += '--force-recreate'
    }
    if ($previousBuild -ne $fingerprint) { $composeArguments += '--build' }
    Invoke-Docker -Arguments $composeArguments
    $health = Invoke-RestMethod -Uri "$applicationUrl/api/health" -TimeoutSec 10
    if ($health.ready -ne $true -or $health.databaseConnected -ne $true) { throw 'The pharmacy API is not ready. No application window was opened.' }
    [IO.File]::WriteAllText($buildMarker, $fingerprint)
    if (-not $NoOpen) {
        $browsers = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe")
        $browserExecutable = $browsers | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        if ($browserExecutable) { Start-Process -FilePath $browserExecutable -ArgumentList @("--app=$applicationUrl", '--new-window') }
        else { Start-Process $applicationUrl }
    }
    Write-Host 'Ready. Use the Sardar Medical Store desktop shortcut for daily launch.' -ForegroundColor Green
    Write-Host 'Stop-Sardar-Pharmacy.bat stops services while keeping the database.'
} catch {
    Write-Host "Startup failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Keep this folder. Logs: docker compose logs --tail 100'
    exit 1
}
