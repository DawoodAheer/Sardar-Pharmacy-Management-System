$ErrorActionPreference = 'Stop'
$projectDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $projectDirectory
try {
    if (-not (Get-Command git -ErrorAction SilentlyContinue) -or -not (Test-Path -LiteralPath '.git')) {
        throw 'This is a ZIP installation. Download the latest GitHub ZIP and copy its source into THIS installation folder. Keep .env, server/backups, server/uploads, server/job-data, server/logs and backup-exports. Then run Start-Sardar-Pharmacy.bat. For one-click updates, install Git and initially use git clone.'
    }
    $changes = & git status --porcelain
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect the installation.' }
    if ($changes) { throw 'Local source changes exist. Update stopped to preserve them; commit or review them first.' }
    $branch = & git branch --show-current
    if ($branch -ne 'main') { throw 'Use the main installation branch for updates.' }
    & git pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) { throw 'Update failed. Existing application and database remain available; check internet and Git access.' }
    & (Join-Path $PSScriptRoot 'start-pharmacy.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'Updated source could not start. Keep the installation folder and inspect the startup error.' }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
