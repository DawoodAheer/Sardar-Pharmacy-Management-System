function Preserve-PharmacyInstallation {
    param([string]$ProjectDirectory, $Backend)
    if (-not $Backend) { return }
    if ($Backend.Config.Labels.'com.docker.compose.project' -ne 'sardar-pharmacy-management-system') {
        throw 'Existing backend belongs to another Docker project. Startup stopped to protect its data.'
    }
    $previousDirectory = $Backend.Config.Labels.'com.docker.compose.project.working_dir'
    if (-not $previousDirectory) { throw 'Existing backend has no installation folder. Startup stopped to protect its data.' }
    if ($previousDirectory.Replace('/', '\').TrimEnd('\') -ieq $ProjectDirectory.TrimEnd('\')) { return }
    $overridePath = Join-Path $ProjectDirectory 'docker-compose.override.yml'
    $targets = @('/app/uploads', '/app/backups', '/app/backup-exports', '/app/job-data', '/app/logs')
    $volumes = @()
    foreach ($target in $targets) {
        $mounts = @($Backend.Mounts | Where-Object { $_.Destination -eq $target })
        if ($mounts.Count -ne 1 -or $mounts[0].Type -ne 'bind') { throw "Existing data mount $target is missing or unfamiliar. Startup stopped to protect data." }
        $source = $mounts[0].Source
        if (-not (Test-Path -LiteralPath $source -PathType Container)) { throw "Existing data directory is unavailable: $source. Keep the old software folder on this laptop." }
        $volumes += @{ type = 'bind'; source = $source.Replace('\', '/'); target = $target }
    }
    if (Test-Path -LiteralPath $overridePath) {
        $existing = Get-Content -LiteralPath $overridePath -Raw | ConvertFrom-Json
        if (@($existing.PSObject.Properties).Count -ne 1 -or @($existing.services.PSObject.Properties).Count -ne 1 -or @($existing.services.backend.PSObject.Properties).Count -ne 1 -or @($existing.services.backend.volumes).Count -ne $volumes.Count) {
            throw 'An unfamiliar Compose override exists. Use a fresh extraction to preserve data safely.'
        }
        foreach ($volume in $volumes) {
            $matching = @($existing.services.backend.volumes | Where-Object { $_.target -eq $volume.target -and $_.source -eq $volume.source -and $_.type -eq 'bind' -and @($_.PSObject.Properties).Count -eq 3 })
            if ($matching.Count -ne 1) { throw 'Existing Compose override uses different data paths. Startup stopped to protect data.' }
        }
    }
    $oldSettings = Join-Path $previousDirectory '.env'
    $settings = Join-Path $ProjectDirectory '.env'
    if (-not (Test-Path -LiteralPath $settings)) {
        if (-not (Test-Path -LiteralPath $oldSettings -PathType Leaf)) { throw 'Existing installation settings are missing. Keep the old software folder and retry.' }
        Copy-Item -LiteralPath $oldSettings -Destination $settings
    }
    # JSON is valid YAML. Compose merges these mounts by their container target.
    # Keep all existing host data in place, including pending background jobs.
    $override = @{ services = @{ backend = @{ volumes = $volumes } } } | ConvertTo-Json -Depth 8
    [IO.File]::WriteAllText($overridePath, $override, (New-Object Text.UTF8Encoding($false)))
    Write-Host 'Previous installation detected. Existing settings and data folders are reused automatically.' -ForegroundColor Green
    Write-Host 'Keep the previous software folder: its uploads and backup folders are still used.'
}
