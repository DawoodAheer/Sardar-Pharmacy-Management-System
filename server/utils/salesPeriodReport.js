import Bill from '../models/Bill.js';
import { saleDateFilter } from './saleDate.js';
import { getLocalDateRange } from './dateRange.js';
import { saleDateExpression } from './profitAggregation.js';

export function salesRange(startDate, endDate) {
  const range = getLocalDateRange(startDate, endDate);
  if (!range.start || !range.end || range.start > range.end) throw Object.assign(new Error('Choose a valid start and end date.'), { statusCode: 400 });
  return range;
}
export function salesReportStages(startDate, endDate) {
  const range = salesRange(startDate, endDate);
  return [
    { $match: { orderStatus: { $nin: ['PENDING', 'REJECTED'] }, ...saleDateFilter({ $gte:range.start, $lte:range.end }) } },
    { $set: { saleDate: saleDateExpression } },
    { $match: { saleDate: { $gte: range.start, $lte: range.end } } },
    { $set: { refunded: { $ifNull: ['$totalRefunded', 0] }, netSales: { $max: [0, { $subtract: ['$total', { $ifNull: ['$totalRefunded', 0] }] }] } } },
  ];
}
export const salesTotals = { billCount: { $sum: 1 }, grossSales: { $sum: '$subtotal' }, discount: { $sum: { $ifNull: ['$discount', 0] } }, billedSales: { $sum: '$total' }, refunds: { $sum: '$refunded' }, netSales: { $sum: '$netSales' } };
export async function getSalesPeriodReport(req, res, next) {
  try {
    const pageInput=Number(req.query.page);
    const page = Number.isSafeInteger(pageInput) && pageInput > 0 ? pageInput : 1, limit = 50;
    const [report] = await Bill.aggregate([...salesReportStages(req.query.startDate, req.query.endDate), { $facet: {
      rows: [{ $sort: { saleDate: -1, _id: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }, { $project: { billNumber: 1, saleDate: 1, billType: 1, paymentMethod: 1, subtotal: 1, discount: 1, total: 1, refunded: 1, netSales: 1 } }],
      totals: [{ $group: { _id: null, ...salesTotals } }],
      monthly: [{ $group: { _id: { $dateToString: { date: '$saleDate', format: '%Y-%m', timezone: 'Asia/Karachi' } }, ...salesTotals } }, { $sort: { _id: 1 } }],
    } }]).allowDiskUse(true);
    const totals = report?.totals[0] || { billCount: 0, grossSales: 0, discount: 0, billedSales: 0, refunds: 0, netSales: 0 };
    res.json({ rows: report?.rows || [], totals, monthly: report?.monthly || [], page, pages: Math.ceil(totals.billCount / limit), total: totals.billCount });
  } catch (error) { next(error); }
}
