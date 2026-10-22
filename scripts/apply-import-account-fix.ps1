$ErrorActionPreference = 'Stop'
try {
    $projectDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
    $workerPath = Join-Path $projectDirectory 'server\utils\jobWorker.js'
    $launcherPath = Join-Path $projectDirectory 'scripts\start-pharmacy.ps1'
    if (-not (Test-Path -LiteralPath $workerPath) -or -not (Test-Path -LiteralPath $launcherPath)) {
        throw 'Extract this repair ZIP into your existing software folder containing Start-Sardar-Pharmacy.bat, then run again.'
    }
    $source = [IO.File]::ReadAllText($workerPath)
    $oldLookup = "User.findById(job.owner).select('role isActive accountStatus').lean()"
    $newLookup = "User.findById(job.owner).select('role isActive accountStatus')"
    if ($source.Contains($oldLookup)) {
        if ($source.IndexOf($oldLookup) -ne $source.LastIndexOf($oldLookup)) { throw 'Unexpected worker source. Please use the full software update.' }
        $backupDirectory = Join-Path $projectDirectory ('backups\source-fixes\' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
        New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
        Copy-Item -LiteralPath $workerPath -Destination (Join-Path $backupDirectory 'jobWorker.js')
        [IO.File]::WriteAllText($workerPath, $source.Replace($oldLookup, $newLookup), (New-Object Text.UTF8Encoding($false)))
        Write-Host 'Fixed legacy account lookup. Original source saved in backups/source-fixes.' -ForegroundColor Green
    } elseif ($source.Contains($newLookup) -and -not $source.Contains($newLookup + '.lean')) {
        Write-Host 'This account lookup fix is already applied.' -ForegroundColor Green
    } else {
        throw 'Worker source does not match this repair. Please use the full software update.'
    }
    Write-Host 'Starting updated services. Medicines, bills, users and database volumes are preserved.'
    & powershell -NoProfile -ExecutionPolicy Bypass -File $launcherPath
    if ($LASTEXITCODE -ne 0) { throw 'The source fix is saved, but startup failed. Resolve the startup error above and run Start-Sardar-Pharmacy.bat again.' }
    exit 0
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
