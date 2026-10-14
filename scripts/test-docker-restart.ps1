$ErrorActionPreference = 'Stop'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker Desktop is required for this test.' }
$testComposePath = Join-Path (Split-Path $PSScriptRoot -Parent) 'docker-compose.test.yml'
$testProject = 'pharmadesk-capacity-test-' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
function Invoke-TestCompose {
  param([string[]]$Arguments)
  & docker compose -p $testProject -f $testComposePath @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Docker test failed ($LASTEXITCODE)." }
}
try {
  Invoke-TestCompose -Arguments @('up', '-d', '--build', '--wait', '--wait-timeout', '180')
  Invoke-TestCompose -Arguments @('exec', '-T', 'mongodb', 'mongosh', '--quiet', 'pharmadesk_docker_test', '--eval', 'if(db.medicines.countDocuments({})!==0) quit(2); if(db.users.countDocuments({})!==3) quit(3); db.persistence_checks.insertOne({_id:"restart-sentinel", value:5786});')
  Invoke-TestCompose -Arguments @('restart', 'mongodb', 'backend')
  Invoke-TestCompose -Arguments @('up', '-d', '--wait', '--wait-timeout', '180')
  Invoke-TestCompose -Arguments @('exec', '-T', 'mongodb', 'mongosh', '--quiet', 'pharmadesk_docker_test', '--eval', 'const row=db.persistence_checks.findOne({_id:"restart-sentinel"}); if(!row||row.value!==5786) quit(4); if(db.users.countDocuments({})!==3) quit(5); print("Docker restart persistence passed");')
} finally {
  # The random, test-only compose project owns all volumes removed here.
  if ($testProject -notmatch '^pharmadesk-capacity-test-[a-f0-9]{12}$') { throw 'Unsafe test project name.' }
  Invoke-TestCompose -Arguments @('down', '-v')
}
