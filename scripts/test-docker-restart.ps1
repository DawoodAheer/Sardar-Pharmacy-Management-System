$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'docker-path.ps1')
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
  Invoke-TestCompose -Arguments @('exec', '-T', 'mongodb', 'mongosh', '--quiet', 'pharmadesk_docker_test', '--eval', "if(db.medicines.countDocuments({})!==0 || db.bills.countDocuments({})!==0) quit(2); if(db.users.countDocuments({})!==3) quit(3); db.persistence_checks.insertOne({_id:'restart-sentinel', value:5786});")
  Invoke-TestCompose -Arguments @('exec', '-T', 'backend', 'node', '-e', "Promise.all([fetch('http://frontend/').then(r=>r.text()),fetch('http://frontend/api/health').then(r=>r.json())]).then(([html,health])=>{if(!html.includes('Sardar')||!health.ready||!health.databaseConnected)process.exit(6);console.log('Frontend page and API proxy passed');}).catch(()=>process.exit(7));")
  Invoke-TestCompose -Arguments @('restart', 'mongodb', 'backend', 'frontend')
  Invoke-TestCompose -Arguments @('up', '-d', '--wait', '--wait-timeout', '180')
  Invoke-TestCompose -Arguments @('exec', '-T', 'mongodb', 'mongosh', '--quiet', 'pharmadesk_docker_test', '--eval', "const row=db.persistence_checks.findOne({_id:'restart-sentinel'}); if(!row||row.value!==5786) quit(4); if(db.users.countDocuments({})!==3) quit(5); print('Docker restart persistence passed');")
  Invoke-TestCompose -Arguments @('exec', '-T', 'backend', 'node', '-e', "fetch('http://frontend/api/health').then(r=>r.json()).then(h=>{if(!h.ready||!h.databaseConnected)process.exit(8);console.log('Frontend API proxy after restart passed');}).catch(()=>process.exit(9));")
} finally {
  # The random, test-only compose project owns all volumes removed here.
  if ($testProject -notmatch '^pharmadesk-capacity-test-[a-f0-9]{12}$') { throw 'Unsafe test project name.' }
  Invoke-TestCompose -Arguments @('down', '-v')
}
