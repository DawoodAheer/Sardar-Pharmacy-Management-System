$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'preserve-installation.ps1')
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('pharmacy-preserve-' + [Guid]::NewGuid().ToString('N'))
try {
    $oldDirectory = Join-Path $fixture 'old version'
    $newDirectory = Join-Path $fixture 'new version'
    New-Item -ItemType Directory -Path $oldDirectory, $newDirectory -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $oldDirectory '.env'), 'JWT_ACCESS_SECRET=original-fixture-secret')
    $targets = @('/app/uploads', '/app/backups', '/app/backup-exports', '/app/job-data', '/app/logs')
    $mounts = @($targets | ForEach-Object {
        $directory = Join-Path $oldDirectory ($_.Substring(5))
        New-Item -ItemType Directory -Path $directory | Out-Null
        [IO.File]::WriteAllText((Join-Path $directory 'existing.txt'), 'preserved')
        @{ Type='bind'; Source=$directory; Destination=$_ }
    })
    $backend = @{ Config=@{ Labels=@{ 'com.docker.compose.project'='sardar-pharmacy-management-system'; 'com.docker.compose.project.working_dir'=$oldDirectory } }; Mounts=$mounts }
    Preserve-PharmacyInstallation -ProjectDirectory $newDirectory -Backend $backend
    Preserve-PharmacyInstallation -ProjectDirectory $newDirectory -Backend $backend
    if ([IO.File]::ReadAllText((Join-Path $newDirectory '.env')) -ne 'JWT_ACCESS_SECRET=original-fixture-secret') { throw 'Secrets not preserved' }
    $override = Get-Content (Join-Path $newDirectory 'docker-compose.override.yml') -Raw | ConvertFrom-Json
    foreach ($mount in $mounts) {
        $entry = @($override.services.backend.volumes | Where-Object { $_.target -eq $mount.Destination })
        if ($entry.Count -ne 1 -or $entry[0].source -ne $mount.Source.Replace('\','/') -or [IO.File]::ReadAllText((Join-Path $mount.Source 'existing.txt')) -ne 'preserved') { throw 'Data mount not preserved' }
    }
    $backend.Config.Labels.'com.docker.compose.project' = 'different-project'
    $rejected = $false
    try { Preserve-PharmacyInstallation -ProjectDirectory $newDirectory -Backend $backend } catch { $rejected=$true }
    if (-not $rejected) { throw 'Unrelated project accepted' }
    Write-Host 'PASS: new ZIP preserves settings and all five data mounts; retry is safe; unrelated project rejected.'
} finally {
    $resolved = [IO.Path]::GetFullPath($fixture)
    if ((Split-Path $resolved -Parent) -ne [IO.Path]::GetTempPath().TrimEnd('\') -or (Split-Path $resolved -Leaf) -notmatch '^pharmacy-preserve-[a-f0-9]{32}$') { throw 'Unsafe fixture cleanup path' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
