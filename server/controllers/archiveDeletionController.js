import { checkArchivedDeletion } from '../utils/archiveDeletion.js';
import { enqueueJob } from '../utils/backgroundJobs.js';

export async function permanentlyDeleteArchived(req, res, next) {
  if (req.body?.confirmation !== 'DELETE') return res.status(400).json({ message: 'Type DELETE to confirm permanent removal.' });
  try {
    await checkArchivedDeletion(req.params.id);
    res.status(202).json(await enqueueJob('purge', req.user._id, { medicineId: req.params.id }));
  } catch (error) { next(error); }
}
