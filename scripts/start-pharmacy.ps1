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
try {
    Write-Host 'Sardar Medical Store - starting' -ForegroundColor Cyan
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Install Docker Desktop and complete its initial setup, then run this launcher again.' }
    if (-not (Test-DockerEngine)) {
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
    $settings = Join-Path $projectDirectory '.env'
    if (-not (Test-Path -LiteralPath $settings)) {
        $contents = "JWT_ACCESS_SECRET=$(New-LocalSecret)`nJWT_REFRESH_SECRET=$(New-LocalSecret)`nCLIENT_URL=http://localhost:5174`n"
        [IO.File]::WriteAllText($settings, $contents, (New-Object Text.UTF8Encoding($false)))
    }
    if (-not $NoShortcut) { & (Join-Path $PSScriptRoot 'create-shortcut.ps1') -NoPause }
    Invoke-Docker -Arguments @('compose', 'config', '--quiet')
    Write-Host 'Preparing services. The first launch needs internet and can take several minutes.'
    $sourceFiles = @('docker-compose.yml', 'server/Dockerfile', 'server/package.json', 'server/package-lock.json', 'server/server.js', 'server/env-loader.js', 'client/Dockerfile', 'client/nginx.conf', 'client/package.json', 'client/package-lock.json', 'client/index.html', 'client/vite.config.js')
    $sourceDirectories = @('server/controllers','server/models','server/utils','server/routes','server/config','server/middleware','client/src','client/public')
    $sourceFiles += Get-ChildItem -LiteralPath $sourceDirectories -Recurse -File | ForEach-Object { $_.FullName }
    $fingerprint = ($sourceFiles | Sort-Object | ForEach-Object { (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash }) -join ''
    $buildMarker = Join-Path $projectDirectory '.pharmacy-build-id'
    $previousBuild = if (Test-Path -LiteralPath $buildMarker) { [IO.File]::ReadAllText($buildMarker) } else { '' }
    $composeArguments = @('compose', 'up', '-d', '--wait', '--wait-timeout', '180')
    if ($previousBuild -ne $fingerprint) { $composeArguments += '--build' }
    Invoke-Docker -Arguments $composeArguments
    [IO.File]::WriteAllText($buildMarker, $fingerprint)
    $health = Invoke-RestMethod -Uri 'http://localhost:5174/api/health' -TimeoutSec 10
    if ($health.ready -ne $true -or $health.databaseConnected -ne $true) { throw 'The pharmacy API is not ready. No application window was opened.' }
    if (-not $NoOpen) {
        $browsers = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe")
        $browserExecutable = $browsers | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        if ($browserExecutable) { Start-Process -FilePath $browserExecutable -ArgumentList @('--app=http://localhost:5174', '--new-window') }
        else { Start-Process 'http://localhost:5174' }
    }
    Write-Host 'Ready. Use the Sardar Medical Store desktop shortcut for daily launch.' -ForegroundColor Green
    Write-Host 'Stop-Sardar-Pharmacy.bat stops services while keeping the database.'
} catch {
    Write-Host "Startup failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Keep this folder. Logs: docker compose logs --tail 100'
    exit 1
}
