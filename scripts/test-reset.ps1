$ErrorActionPreference = 'Stop'
$root = Join-Path (Split-Path $PSScriptRoot -Parent) ('reset-test-' + [Guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType Directory -Path (Join-Path $root 'scripts') -Force | Out-Null
    foreach ($file in @('reset-pharmacy-data.ps1', 'docker-path.ps1')) {
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination (Join-Path $root 'scripts')
    }
    $harness = @'
param($Fixture, $Scenario)
$ErrorActionPreference = 'Stop'
function global:Read-Host { param($Prompt) if ($Scenario -eq 'cancel') { return 'cancel' }; return 'RESET PHARMACY DATA' }
function global:docker {
    $line = $args -join ' '
    Add-Content -LiteralPath (Join-Path $Fixture 'calls.txt') -Value $line
    $global:LASTEXITCODE = 0
    if ($args[0] -eq 'inspect') {
        $owner = if ($Scenario -eq 'wrong-folder') { 'C:\other-installation' } else { $Fixture }
        return ConvertTo-Json -InputObject @(@{Config=@{Labels=@{'com.docker.compose.project.working_dir'=$owner}}}) -Compress -Depth 6
    }
    if ($line -like '*mongodump*' -and $Scenario -eq 'backup-failure') { $global:LASTEXITCODE=2; return }
    if ($args[0] -eq 'cp' -and $args[1] -like 'pharmadesk-mongodb:*') {
        [IO.File]::WriteAllText($args[2], 'backup fixture')
    }
    if ($line -like '*sha256sum*') {
        if ($Scenario -eq 'checksum-failure') { return 'bad-checksum  archive' }
        return (Get-FileHash -LiteralPath (Get-ChildItem (Join-Path $Fixture 'backup-exports') -Filter '*.archive.gz')[0].FullName -Algorithm SHA256).Hash.ToLowerInvariant() + '  archive'
    }
    if ($line -like '*mongorestore*' -and $Scenario -eq 'archive-failure') { $global:LASTEXITCODE=3; return }
    if ($line -like '*mongosh*' -and $Scenario -eq 'reset-failure') { $global:LASTEXITCODE=4; return }
}
& (Join-Path $Fixture 'scripts/reset-pharmacy-data.ps1')
exit $LASTEXITCODE
'@
    $harnessPath = Join-Path $root 'harness.ps1'
    Set-Content -LiteralPath $harnessPath -Value $harness -Encoding UTF8
    foreach ($scenario in @('cancel', 'wrong-folder', 'backup-failure', 'checksum-failure', 'archive-failure', 'reset-failure', 'success')) {
        $callsPath = Join-Path $root 'calls.txt'
        Set-Content -LiteralPath $callsPath -Value ''
        & powershell -NoProfile -ExecutionPolicy Bypass -File $harnessPath $root $scenario *> (Join-Path $root 'result.txt')
        $resultCode = $LASTEXITCODE
        $calls = Get-Content -LiteralPath $callsPath -Raw
        $shouldSucceed = $scenario -in @('cancel', 'success')
        if (($resultCode -eq 0) -ne $shouldSucceed) { throw "$scenario returned unexpected code $resultCode. $(Get-Content (Join-Path $root 'result.txt') -Raw)" }
        $shouldReset = $scenario -in @('success', 'reset-failure')
        if (($calls -match 'mongosh') -ne $shouldReset) { throw "$scenario did not guard deletion correctly." }
        if ($calls -match 'volume rm|down|prune') { throw 'Reset must not remove Docker storage.' }
        if ($scenario -in @('cancel', 'wrong-folder') -and $calls -match 'compose stop|mongodump') { throw 'Cancelled/wrong installation was modified.' }
        if ($scenario -notin @('cancel', 'wrong-folder') -and $calls -notmatch 'start pharmadesk-backend pharmadesk-frontend') { throw 'Services were not restarted after reset/backup failure.' }
        if ($shouldReset -and $calls.IndexOf('mongorestore') -gt $calls.IndexOf('mongosh')) { throw 'Deletion occurred before backup validation.' }
        Write-Host "$scenario passed"
    }
} finally {
    $parent = (Split-Path $PSScriptRoot -Parent).TrimEnd('\') + '\'
    if (-not ([IO.Path]::GetFullPath($root).StartsWith($parent, [StringComparison]::OrdinalIgnoreCase)) -or (Split-Path $root -Leaf) -notmatch '^reset-test-[a-f0-9]{32}$') { throw 'Unsafe test cleanup path.' }
    if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
}
