import mongoose from 'mongoose';
import DeletionRequest from '../models/DeletionRequest.js';
import Medicine from '../models/Medicine.js';
import Bill from '../models/Bill.js';
import SaleReturn from '../models/SaleReturn.js';

const targets = { medicine: Medicine, bill: Bill };

const getTargetLabel = (type, target) => type === 'medicine'
  ? target.name
  : `Bill ${target.billNumber || target._id}`;

export const createDeletionRequest = async (req, res, next) => {
  const { type = req.deletionTargetType, id } = req.params;
  const Target = targets[type];
  if (!Target || !mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid deletion target.' });

  try {
    const target = await Target.findById(id).select(type === 'medicine' ? 'name isDeleted' : 'billNumber');
    if (!target) return res.status(404).json({ message: `${type === 'medicine' ? 'Medicine' : 'Bill'} not found.` });
    if (type === 'medicine' && target.isDeleted) return res.status(409).json({ message: 'Medicine is already deleted from active inventory.' });

    let request;
    try {
      request = await DeletionRequest.findOneAndUpdate(
        { targetType: type, targetId: id, status: 'pending' },
        { $setOnInsert: {
          targetType: type,
          targetId: target._id,
          targetLabel: getTargetLabel(type, target),
          requestedBy: req.user._id,
          requestReason: String(req.body?.reason || '').trim().slice(0, 500),
        } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      request = await DeletionRequest.findOne({ targetType: type, targetId: id, status: 'pending' });
    }
    return res.status(201).json({ message: 'Deletion request sent to Admin for approval.', request });
  } catch (error) { return next(error); }
};

export const listDeletionRequests = async (_req, res, next) => {
  try {
    const requests = await DeletionRequest.find().sort({ status: 1, createdAt: -1 })
      .populate('requestedBy', 'name email role')
      .populate('reviewedBy', 'name email role')
      .lean();
    res.json({ requests });
  } catch (error) { next(error); }
};

export const reviewDeletionRequest = async (req, res, next) => {
  const { id } = req.params;
  const { decision, note = '' } = req.body || {};
  if (!mongoose.isValidObjectId(id) || !['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ message: 'A valid request and approve/reject decision are required.' });
  }
  if (typeof note !== 'string' || note.length > 500) return res.status(400).json({ message: 'Review note must be 500 characters or fewer.' });

  const session = await mongoose.startSession();
  try {
    let response;
    await session.withTransaction(async () => {
      const request = await DeletionRequest.findOneAndUpdate(
        { _id: id, status: 'pending' },
        { $set: { reviewedBy: req.user._id, reviewedAt: new Date(), reviewNote: note.trim() } },
        { new: true, session }
      );
      if (!request) {
        const error = new Error('This request was already reviewed or does not exist.');
        error.statusCode = 409;
        throw error;
      }
      if (decision === 'approve') {
        const Target = targets[request.targetType];
        const target = await Target.findById(request.targetId).session(session);
        if (!target) {
          const error = new Error('The requested record no longer exists.');
          error.statusCode = 404;
          throw error;
        }
        if (request.targetType === 'medicine') {
          if (!target.isDeleted) {
            target.isDeleted = true;
            target.deletedAt = new Date();
            target.deletedBy = req.user._id;
            await target.save({ session });
          }
        } else {
          await Bill.deleteOne({ _id: target._id }, { session });
        }
      }
      request.status = decision === 'approve' ? 'approved' : 'rejected';
      await request.save({ session });
      response = request;
    });
    const message = decision === 'reject'
      ? 'Deletion request rejected; record was kept.'
      : response.targetType === 'medicine'
        ? 'Medicine deleted from active inventory; its sales and return history remain preserved.'
        : 'Bill deleted successfully.';
    res.json({ message, request: response });
  } catch (error) { next(error); }
  finally { await session.endSession(); }
};

