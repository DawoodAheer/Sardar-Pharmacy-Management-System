import test from 'node:test';
import assert from 'node:assert/strict';
import { checksumFor, validateBackup } from './backupManager.js';

const makeBackup = () => ({
  timestamp: '2026-01-01T00:00:00.000Z',
  version: '2.0.0',
  collections: {
    users: [],
    medicines: [],
    bills: [],
    reminders: [],
    notifications: [],
    stockAdjustments: [],
    udhar: [],
  },
});

test('validates a complete backup checksum and collection set', () => {
  const backup = makeBackup();
  backup.checksum = checksumFor(backup);
  assert.doesNotThrow(() => validateBackup(backup));
});

test('rejects a modified backup when its checksum no longer matches', () => {
  const backup = makeBackup();
  backup.checksum = checksumFor(backup);
  backup.collections.medicines.push({ name: 'tampered' });
  assert.throws(() => validateBackup(backup), /checksum validation failed/);
});

test('accepts legacy backups without newer optional collections', () => {
  const backup = makeBackup();
  delete backup.collections.stockAdjustments;
  delete backup.collections.udhar;
  assert.doesNotThrow(() => validateBackup(backup));
});

test('rejects missing required collections before restore', () => {
  const backup = makeBackup();
  delete backup.collections.medicines;
  assert.throws(() => validateBackup(backup), /medicines.*must be an array/);
});
