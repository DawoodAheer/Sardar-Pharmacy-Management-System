export const saleDateExpression = { $cond: [{ $eq: ['$billType', 'ONLINE'] }, { $ifNull: ['$reviewedAt', '$createdAt'] }, '$createdAt'] };
export function profitStages() {
  const sumQuantity = (input, alias, field) => ({ $sum: { $map: { input, as: alias, in: `$$${alias}.${field}` } } });
  const returns = { $filter: { input: { $ifNull: ['$returns', []] }, as: 'r', cond: { $eq: ['$$r.medicineId', '$items.medicineId'] } } };
  const previous = { $filter: { input: { $cond: [{ $gt: ['$itemIndex', 0] }, { $slice: ['$allItems', '$itemIndex'] }, []] }, as: 'p', cond: { $eq: ['$$p.medicineId', '$items.medicineId'] } } };
  const returnedQty = { $min: ['$items.quantity', { $max: [0, { $subtract: [sumQuantity(returns, 'r', 'quantityReturned'), sumQuantity(previous, 'p', 'quantity')] }] }] };
  const batchCost = { $let: { vars: { allocation: { $reduce: {
    input: '$items.batchAllocations', initialValue: { skip: '$returnedQty', cost: 0 },
    in: {
      skip: { $max: [0, { $subtract: ['$$value.skip', '$$this.quantity'] }] },
      cost: { $add: ['$$value.cost', { $multiply: [{ $max: [0, { $subtract: ['$$this.quantity', '$$value.skip'] }] }, '$$this.purchaseCost'] }] },
    },
  } } }, in: '$$allocation.cost' } };
  const fallback = { $divide: [{ $ifNull: [{ $arrayElemAt: ['$medicine.purchasePrice', 0] }, 0] }, { $max: [1, { $ifNull: [{ $arrayElemAt: ['$medicine.unitsPerPack', 0] }, 1] }] }] };
  const legacyCost = { $multiply: [{ $max: [0, { $subtract: ['$items.quantity', '$returnedQty'] }] }, { $ifNull: ['$items.purchasePrice', fallback] }] };
  return [
    { $set: { allItems: '$items', saleDate: saleDateExpression, netTotal: { $max: [0, { $subtract: ['$total', { $ifNull: ['$totalRefunded', 0] }] }] } } },
    { $unwind: { path: '$items', includeArrayIndex: 'itemIndex' } },
    { $lookup: { from: 'medicines', localField: 'items.medicineId', foreignField: '_id', as: 'medicine' } },
    { $set: { returnedQty } },
    { $set: { itemCost: { $cond: [{ $gt: [{ $size: { $ifNull: ['$items.batchAllocations', []] } }, 0] }, batchCost, legacyCost] } } },
    { $group: { _id: '$_id', saleDate: { $first: '$saleDate' }, netTotal: { $first: '$netTotal' }, cost: { $sum: '$itemCost' } } },
    { $set: { profit: { $subtract: ['$netTotal', '$cost'] } } },
  ];
}

export function medicineProfitStages() {
  const gross = { $multiply: ['$items.quantity', { $ifNull: ['$items.salePrice', '$items.unitPrice'] }] };
  const discount = { $cond: [{ $gt: ['$subtotal', 0] }, { $multiply: [{ $divide: [{ $ifNull: ['$discount', 0] }, '$subtotal'] }, gross] }, 0] };
  const returned = { $filter: { input: { $ifNull: ['$returns', []] }, as: 'r', cond: { $eq: ['$$r.medicineId', '$items.medicineId'] } } };
  const sum = field => ({ $sum: { $map: { input: returned, as: 'r', in: `$$r.${field}` } } });
  const refund = { $cond: [{ $gt: [sum('quantityReturned'), 0] }, { $multiply: [{ $divide: [sum('refundAmount'), sum('quantityReturned')] }, '$returnedQty'] }, 0] };
  return [
    ...profitStages().slice(0, 5),
    { $set: { netQty: { $max: [0, { $subtract: ['$items.quantity', '$returnedQty'] }] }, itemSales: { $round: [{ $max: [0, { $subtract: [{ $subtract: [gross, discount] }, refund] }] }, 2] } } },
    { $match: { netQty: { $gt: 0 } } },
    { $group: { _id: '$items.medicineId', name: { $first: '$items.name' }, remainingStock: { $first: { $ifNull: [{ $arrayElemAt: ['$medicine.quantity', 0] }, 0] } }, quantitySold: { $sum: '$netQty' }, totalCost: { $sum: '$itemCost' }, totalSales: { $sum: '$itemSales' }, grossSales: { $sum: { $multiply: ['$netQty', { $ifNull: ['$items.salePrice', '$items.unitPrice'] }] } } } },
    { $set: { medicineId: '$_id', purchasePrice: { $divide: ['$totalCost', '$quantitySold'] }, salePrice: { $divide: ['$grossSales', '$quantitySold'] }, totalDiscount: { $subtract: ['$grossSales', '$totalSales'] }, totalProfit: { $subtract: ['$totalSales', '$totalCost'] } } },
  ];
}
