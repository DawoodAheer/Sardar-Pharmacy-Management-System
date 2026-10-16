$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$root = Join-Path $project ('restore-test-' + [Guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType Directory -Path (Join-Path $root 'scripts') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $root 'backup-exports') -Force | Out-Null
    foreach ($name in @('restore-pharmacy.ps1', 'docker-path.ps1')) {
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination (Join-Path $root 'scripts')
    }
    Set-Content -LiteralPath (Join-Path $root 'backup-exports/before-reset-test.archive.gz') -Value 'selection fixture only'
    Set-Content -LiteralPath (Join-Path $root 'scripts/backup-pharmacy.ps1') -Value 'exit 7'
    $harness = @'
param($Fixture, $Scenario)
function global:docker { throw 'Selection/cancellation must never call Docker.' }
function global:Read-Host {
    param($Prompt)
    if ($Prompt -like 'Select backup*') { if ($Scenario -eq 'invalid-selection') { return 'nonsense' }; return '1' }
    if ($Scenario -eq 'backup-failure' -and $Prompt -like "Type 'RESTORE'*") { return 'RESTORE' }
    return 'CANCEL'
}
$script = Join-Path $Fixture 'scripts/restore-pharmacy.ps1'
if ($Scenario -eq 'explicit') { & $script -SpecifiedBackupPath (Join-Path $Fixture 'backup-exports/before-reset-test.archive.gz') }
elseif ($Scenario -eq 'missing') { & $script -SpecifiedBackupPath (Join-Path $Fixture 'missing.archive.gz') }
elseif ($Scenario -eq 'wrong-format') { & $script -SpecifiedBackupPath (Join-Path $Fixture 'harness.ps1') }
else { & $script }
exit $LASTEXITCODE
'@
    $harnessPath = Join-Path $root 'harness.ps1'
    Set-Content -LiteralPath $harnessPath -Value $harness -Encoding UTF8
    foreach ($scenario in @('explicit', 'discovery', 'missing', 'wrong-format', 'invalid-selection', 'backup-failure')) {
        $savedPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            & powershell -NoProfile -ExecutionPolicy Bypass -File $harnessPath $root $scenario *> (Join-Path $root 'result.txt')
            $succeeded = $LASTEXITCODE -eq 0
        } finally { $ErrorActionPreference = $savedPreference }
        if ($succeeded -ne ($scenario -in @('explicit', 'discovery'))) { throw "$scenario failed: $(Get-Content (Join-Path $root 'result.txt') -Raw)" }
        if ($succeeded -and (Get-Content (Join-Path $root 'result.txt') -Raw) -notmatch 'Restoration cancelled') { throw 'Restore did not cancel safely.' }
        if ($scenario -eq 'backup-failure' -and (Get-Content (Join-Path $root 'result.txt') -Raw) -notmatch 'Safety backup failed! Aborting restore') { throw 'Backup failure did not guard restore.' }
        Write-Host "$scenario passed"
    }
} finally {
    $resolved = [IO.Path]::GetFullPath($root)
    if (-not $resolved.StartsWith($project.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $resolved -Leaf) -notmatch '^restore-test-[a-f0-9]{32}$') { throw 'Unsafe test cleanup path.' }
    if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
