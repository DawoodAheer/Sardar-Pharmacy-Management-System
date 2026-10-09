import path from 'node:path';
import { createBackup, getBackupStatus, getLatestBackupPath, markBackupFailure, restoreBackupData } from '../utils/backupManager.js';

export const getBackupStatusController = async (_req, res, next) => {
  try { res.json(await getBackupStatus()); }
  catch (error) { next(error); }
};

export const downloadLatestBackup = async (_req, res, next) => {
  try {
    const filePath = await getLatestBackupPath();
    if (!filePath) return res.status(404).json({ message: 'No completed database backup is available yet.' });
    return res.download(filePath, path.basename(filePath));
  } catch (error) { next(error); }
};

export const createBackupController = async (_req, res, next) => {
  try {
    const filePath = await createBackup();
    res.status(201).json({ message: 'Database backup completed.', fileName: path.basename(filePath), status: await getBackupStatus() });
  } catch (error) {
    await markBackupFailure(error);
    next(error);
  }
};

export const restoreBackupController = async (req, res, next) => {
  const { confirmation, backupData, fileName } = req.body || {};
  if (confirmation !== 'RESTORE') return res.status(400).json({ message: 'Type RESTORE to confirm this database replacement.' });
  if (!backupData || typeof backupData !== 'object' || Array.isArray(backupData)) return res.status(400).json({ message: 'Select a valid JSON database backup file.' });
  try {
    const result = await restoreBackupData(backupData, String(fileName || 'uploaded backup').slice(0, 180));
    res.json({ message: 'Database restored. A safety backup of the previous database was created first.', ...result, status: await getBackupStatus() });
  } catch (error) {
    await markBackupFailure(error);
    next(error);
  }
};
