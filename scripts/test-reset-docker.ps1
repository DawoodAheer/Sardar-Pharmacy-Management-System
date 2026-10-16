$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'docker-path.ps1')
$container = 'pharmadesk-reset-check-' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
function Invoke-TestDocker {
    param([string[]]$Arguments)
    & docker @Arguments
    if ($LASTEXITCODE -ne 0) { throw 'Isolated reset test failed.' }
}
try {
    Invoke-TestDocker -Arguments @('run', '-d', '--name', $container, '--tmpfs', '/data/db', 'mongo:7.0', '--replSet', 'rs0', '--bind_ip_all')
    Start-Sleep -Seconds 3
    Invoke-TestDocker -Arguments @('exec', $container, 'mongosh', '--quiet', '--eval', "rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27017'}]})")
    Invoke-TestDocker -Arguments @('exec', $container, 'mongosh', '--quiet', '--eval', 'for(let i=0;i<40;i++){if(db.hello().isWritablePrimary)quit(0);sleep(500);}quit(2);')
    Invoke-TestDocker -Arguments @('cp', (Join-Path $PSScriptRoot 'reset-business-data.mongo.js'), "${container}:/tmp/reset-business-data.mongo.js")
    Invoke-TestDocker -Arguments @('exec', $container, 'mongosh', '--quiet', 'pharmadesk', '--eval', "db.users.insertOne({_id:'test-admin',password:'unchanged-hash'});db.medicines.createIndex({name:1});db.medicines.insertOne({name:'Test medicine'});db.bills.insertOne({total:100});db.udhar.insertOne({balance:50});")
    Invoke-TestDocker -Arguments @('exec', $container, 'mongodump', '--db=pharmadesk', '--gzip', '--archive=/tmp/before-reset.archive.gz')
    Invoke-TestDocker -Arguments @('exec', $container, 'mongorestore', '--gzip', '--archive=/tmp/before-reset.archive.gz', '--dryRun')
    Invoke-TestDocker -Arguments @('exec', $container, 'mongosh', '--quiet', 'pharmadesk', '--file', '/tmp/reset-business-data.mongo.js')
    Invoke-TestDocker -Arguments @('exec', $container, 'mongosh', '--quiet', 'pharmadesk', '--eval', "if(db.medicines.countDocuments({})||db.bills.countDocuments({})||db.udhar.countDocuments({})||db.users.findOne({_id:'test-admin'}).password!=='unchanged-hash'||db.medicines.getIndexes().length!==2)quit(3);print('Empty business data, preserved accounts and indexes passed');")
    Invoke-TestDocker -Arguments @('exec', $container, 'mongorestore', '--gzip', '--archive=/tmp/before-reset.archive.gz', '--nsFrom=pharmadesk.*', '--nsTo=reset_recovery.*')
    Invoke-TestDocker -Arguments @('exec', $container, 'mongosh', '--quiet', 'reset_recovery', '--eval', "if(db.medicines.countDocuments({})!==1||db.bills.countDocuments({})!==1||db.users.countDocuments({})!==1||db.udhar.countDocuments({})!==1)quit(4);print('Actual backup recovery passed');")
    & docker exec $container mongosh --quiet wrong_database --file /tmp/reset-business-data.mongo.js
    if ($LASTEXITCODE -eq 0) { throw 'Wrong database guard failed.' }
    # Capped collections cannot be modified in a transaction. Any earlier deletes must roll back.
    Invoke-TestDocker -Arguments @('exec', $container, 'mongosh', '--quiet', 'pharmadesk', '--eval', "db.medicines.insertOne({name:'Rollback sentinel'});db.createCollection('rollback_capped',{capped:true,size:4096});db.rollback_capped.insertOne({value:1});")
    & docker exec $container mongosh --quiet pharmadesk --file /tmp/reset-business-data.mongo.js
    if ($LASTEXITCODE -eq 0) { throw 'Expected transaction failure was not reported.' }
    Invoke-TestDocker -Arguments @('exec', $container, 'mongosh', '--quiet', 'pharmadesk', '--eval', "if(db.medicines.countDocuments({})!==1||db.rollback_capped.countDocuments({})!==1||db.users.countDocuments({})!==1)quit(5);print('Failed transaction preserved all records');")
    Write-Host 'All isolated Docker reset and recovery checks passed.'
} finally {
    if ($container -notmatch '^pharmadesk-reset-check-[a-f0-9]{12}$') { throw 'Unsafe test container name.' }
    & docker rm -f -v $container | Out-Null
}
