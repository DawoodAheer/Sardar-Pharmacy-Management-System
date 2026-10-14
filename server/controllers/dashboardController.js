import Medicine from '../models/Medicine.js';
import User from '../models/User.js';
import Bill from '../models/Bill.js';

export async function inventorySummary() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today.getTime() + 180 * 86400000);
  const [result] = await Medicine.aggregate([
    { $match: { isDeleted: { $ne: true } } },
    { $group: { _id: null, total: { $sum: 1 },
      lowStock: { $sum: { $cond: [{ $lt: ['$quantity', 5] }, 1, 0] } },
      expired: { $sum: { $cond: [{ $and: [{ $ne: [{ $ifNull: ['$expiryDate', null] }, null] }, { $lt: ['$expiryDate', today] }] }, 1, 0] } },
      expiring: { $sum: { $cond: [{ $and: [{ $gte: ['$expiryDate', today] }, { $lte: ['$expiryDate', cutoff] }] }, 1, 0] } },
      stockValue: { $sum: { $cond: [
        { $gt: [{ $size: { $ifNull: ['$batches', []] } }, 0] },
        { $sum: { $map: { input: '$batches', as: 'b', in: { $multiply: ['$$b.quantity', '$$b.purchaseCost'] } } } },
        { $multiply: [{ $ifNull: ['$quantity', 0] }, { $divide: [{ $ifNull: ['$purchasePrice', 0] }, { $max: [1, { $ifNull: ['$unitsPerPack', 1] }] }] }] },
      ] } },
    } },
  ]);
  return result || { total: 0, lowStock: 0, expired: 0, expiring: 0, stockValue: 0 };
}

export async function dashboardSummary(req, res, next) {
  try {
    const [inventory, roles, pendingPharmacists, pendingOrders] = await Promise.all([
      inventorySummary(), req.user.role === 'superadmin' ? User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]) : [],
      req.user.role === 'superadmin' ? User.countDocuments({ role: 'pharmacist', accountStatus: 'pending' }) : 0,
      Bill.countDocuments({ billType: 'ONLINE', orderStatus: 'PENDING' }),
    ]);
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 6);
    const sales = await Bill.aggregate([
      { $match: { isDeleted: { $ne: true }, orderStatus: { $nin: ['PENDING', 'REJECTED'] }, $or: [{ createdAt: { $gte: start } }, { reviewedAt: { $gte: start } }] } },
      { $set: { saleDate: { $cond: [{ $eq: ['$billType', 'ONLINE'] }, { $ifNull: ['$reviewedAt', '$createdAt'] }, '$createdAt'] } } },
      { $match: { saleDate: { $gte: start } } },
      { $group: { _id: { $dateToString: { date: '$saleDate', format: '%Y-%m-%d', timezone: 'Asia/Karachi' } }, count: { $sum: 1 }, total: { $sum: { $max: [0, { $subtract: ['$total', { $ifNull: ['$totalRefunded', 0] }] }] } } } },
      { $sort: { _id: 1 } },
    ]);
    res.json({ inventory, users: Object.fromEntries(roles.map(role => [role._id, role.count])), pendingPharmacists, pendingOrders, sales });
  } catch (error) { next(error); }
}
