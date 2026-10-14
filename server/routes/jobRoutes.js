import express from 'express';
import path from 'node:path';
import mongoose from 'mongoose';
import BackgroundJob from '../models/BackgroundJob.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { enqueueJob, JOB_DIR } from '../utils/backgroundJobs.js';

const router = express.Router();
router.use(protect, authorize('superadmin', 'pharmacist'));
router.post('/inventory-export', async (req, res, next) => {
  try { res.status(202).json(await enqueueJob('export', req.user._id)); } catch (error) { next(error); }
});
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Job not found.' });
    const filter = { _id: req.params.id, ...(req.user.role === 'superadmin' ? {} : { owner: req.user._id }) };
    const job = await BackgroundJob.findOne(filter).select('-payloadFile').lean();
    if (!job) return res.status(404).json({ message: 'Job not found.' });
    res.json(job);
  } catch (error) { next(error); }
});
router.get('/:id/download', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.sendStatus(404);
    const job = await BackgroundJob.findOne({ _id: req.params.id, status: 'completed', type: 'export', ...(req.user.role === 'superadmin' ? {} : { owner: req.user._id }) }).lean();
    if (!job?.artifact) return res.status(404).json({ message: 'Export is not ready.' });
    res.download(path.join(JOB_DIR, path.basename(job.artifact)), 'medicine_inventory.csv');
  } catch (error) { next(error); }
});
export default router;
