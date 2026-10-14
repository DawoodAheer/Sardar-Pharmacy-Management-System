# Resolve Docker for each independently launched utility without changing system PATH.
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    $dockerCli = @("$env:ProgramFiles\Docker\Docker\resources\bin\docker.exe", "$env:LOCALAPPDATA\Programs\Docker\Docker\resources\bin\docker.exe") | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $dockerCli) { throw 'Docker CLI was not found. Install Docker Desktop and complete its setup.' }
    $env:PATH = (Split-Path $dockerCli -Parent) + ';' + $env:PATH
}
