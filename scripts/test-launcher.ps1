$ErrorActionPreference = 'Stop'
$projectDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$testRoot = Join-Path $projectDirectory ('launcher-test-' + [Guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType Directory -Path (Join-Path $testRoot 'scripts') | Out-Null
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'start-pharmacy.ps1') -Destination (Join-Path $testRoot 'scripts/start-pharmacy.ps1')
    $entries = @('docker-compose.yml','server/Dockerfile','server/package.json','server/package-lock.json','server/server.js','server/env-loader.js','client/Dockerfile','client/nginx.conf','client/package.json','client/package-lock.json','client/index.html','client/vite.config.js')
    foreach ($entry in $entries) {
        $target = Join-Path $testRoot $entry
        New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
        Set-Content -LiteralPath $target -Value 'test source' -Encoding UTF8
    }
    foreach ($directory in @('server/controllers','server/models','server/utils','server/routes','server/config','server/middleware','client/src','client/public')) {
        New-Item -ItemType Directory -Path (Join-Path $testRoot $directory) -Force | Out-Null
    }
    $harness = @'
param([string]$Scenario, [string]$Fixture)
function global:docker {
    $line = $args -join ' '
    Add-Content -LiteralPath (Join-Path $Fixture 'calls.txt') -Value $line
    $global:LASTEXITCODE = if ($Scenario -eq 'compose-failure' -and $line -like 'compose up*') { 7 } else { 0 }
}
function global:Invoke-RestMethod { return @{ ready = ($Scenario -ne 'api-unready'); databaseConnected = $true } }
& (Join-Path $Fixture 'scripts/start-pharmacy.ps1') -NoOpen -NoShortcut
exit $LASTEXITCODE
'@
    Set-Content -LiteralPath (Join-Path $testRoot 'harness.ps1') -Value $harness -Encoding UTF8
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $testRoot 'harness.ps1') -Scenario 'success' -Fixture $testRoot
    if ($LASTEXITCODE -ne 0) { throw 'Fresh launch simulation failed.' }
    if ((Get-Content -LiteralPath (Join-Path $testRoot 'calls.txt') -Raw) -notmatch 'compose up.*--build') { throw 'Fresh source was not built.' }
    $settingsHash = (Get-FileHash -LiteralPath (Join-Path $testRoot '.env')).Hash
    Clear-Content -LiteralPath (Join-Path $testRoot 'calls.txt')
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $testRoot 'harness.ps1') -Scenario 'success' -Fixture $testRoot
    if ($LASTEXITCODE -ne 0) { throw 'Daily launch simulation failed.' }
    if ((Get-Content -LiteralPath (Join-Path $testRoot 'calls.txt') -Raw) -match '--build') { throw 'Unchanged daily launch rebuilt services.' }
    if ((Get-FileHash -LiteralPath (Join-Path $testRoot '.env')).Hash -ne $settingsHash) { throw 'Daily launch replaced installation secrets.' }
    foreach ($scenario in @('compose-failure','api-unready')) {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $testRoot 'harness.ps1') -Scenario $scenario -Fixture $testRoot
        if ($LASTEXITCODE -eq 0) { throw "Failed services incorrectly reported success: $scenario" }
    }
    $desktop = Join-Path $testRoot 'desktop'; New-Item -ItemType Directory -Path $desktop | Out-Null
    & (Join-Path $PSScriptRoot 'create-shortcut.ps1') -NoPause -DesktopDirectory $desktop
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut((Join-Path $desktop 'Sardar Medical Store.lnk'))
    if ($shortcut.TargetPath -ne (Join-Path $projectDirectory 'Start-Sardar-Pharmacy.bat')) { throw 'Shortcut points to the wrong launcher.' }
    Write-Host 'PASS: fresh launch, daily reuse, stable secrets, failed-service refusal and desktop shortcut.'
} finally {
    Set-Location -LiteralPath $projectDirectory
    $resolved = [IO.Path]::GetFullPath($testRoot)
    if (-not $resolved.StartsWith($projectDirectory + [IO.Path]::DirectorySeparatorChar) -or (Split-Path $resolved -Leaf) -notmatch '^launcher-test-[a-f0-9]{32}$') { throw 'Unsafe test cleanup path.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
