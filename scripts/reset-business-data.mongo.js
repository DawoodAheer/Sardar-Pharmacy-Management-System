// Run only after stopping application writers and creating a verified backup.
if (db.getName() !== 'pharmadesk') throw new Error('Unexpected database; reset refused.');
const names = db.getCollectionNames().filter(name => name !== 'users' && !name.startsWith('system.'));
const usersBefore = db.users.countDocuments({});
if (!usersBefore) throw new Error('No accounts found; reset refused. Start the application first.');
const session = db.getMongo().startSession();
try {
  const target = session.getDatabase('pharmadesk');
  session.withTransaction(() => {
    for (const name of names) target.getCollection(name).deleteMany({});
  }, { writeConcern: { w: 'majority' } });
} finally {
  session.endSession();
}
if (db.users.countDocuments({}) !== usersBefore || names.some(name => db.getCollection(name).countDocuments({}) !== 0)) {
  throw new Error('Reset verification failed; retain the backup and investigate before using the application.');
}
print('Business records cleared. Accounts, passwords, database collections and indexes preserved.');
