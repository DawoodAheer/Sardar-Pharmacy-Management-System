const toPlainObject = (bill) =>
  typeof bill?.toObject === 'function' ? bill.toObject() : bill;
const roundCurrency = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100;

export const getBillReturnSummary = (bill) => {
  const source = toPlainObject(bill) || {};
  const items = Array.isArray(source.items) ? source.items : [];
  const returnedByMedicine = new Map();

  for (const item of source.returns || []) {
    const medicineId = String(item.medicineId || '');
    const previous = returnedByMedicine.get(medicineId) || {
      quantity: 0,
      refund: 0,
    };
    previous.quantity += Number(item.quantityReturned) || 0;
    previous.refund += Number(item.refundAmount) || 0;
    returnedByMedicine.set(medicineId, previous);
  }

  const remainingToAllocate = new Map(
    [...returnedByMedicine].map(([medicineId, value]) => [
      medicineId,
      value.quantity,
    ])
  );

  const grossSubtotal = Number(source.subtotal) || 0;
  const discount = Number(source.discount) || 0;
  const netItems = items.map((item) => {
    const medicineId = String(item.medicineId || '');
    const returns = returnedByMedicine.get(medicineId) || {
      quantity: 0,
      refund: 0,
    };
    const unallocatedReturn = remainingToAllocate.get(medicineId) || 0;
    const returnedQuantity = Math.min(
      Number(item.quantity) || 0,
      unallocatedReturn
    );
    remainingToAllocate.set(
      medicineId,
      Math.max(0, unallocatedReturn - returnedQuantity)
    );

    const quantity = Number(item.quantity) || 0;
    const netQuantity = Math.max(0, quantity - returnedQuantity);
    const unitPrice = Number(item.salePrice ?? item.unitPrice) || 0;
    const grossSales = unitPrice * quantity;
    const discountShare =
      grossSubtotal > 0 ? (discount * grossSales) / grossSubtotal : 0;
    const refundShare =
      returns.quantity > 0
        ? (returns.refund * returnedQuantity) / returns.quantity
        : 0;

    return {
      ...item,
      returnedQuantity,
      netQuantity,
      netSales: roundCurrency(
        Math.max(0, grossSales - discountShare - refundShare)
      ),
    };
  });

  const isFullyReturned =
    items.length > 0 && netItems.every((item) => item.netQuantity === 0);
  const hasReturns = (source.returns || []).length > 0;
  const netTotal = roundCurrency(
    Math.max(
      0,
      (Number(source.total) || 0) - (Number(source.totalRefunded) || 0)
    )
  );

  return {
    ...source,
    netItems,
    netTotal,
    netQuantity: netItems.reduce((sum, item) => sum + item.netQuantity, 0),
    isFullyReturned,
    returnStatus: isFullyReturned
      ? 'FULLY_RETURNED'
      : hasReturns
        ? 'PARTIALLY_RETURNED'
        : 'NONE',
  };
};

export const isBillFullyReturned = (bill) =>
  getBillReturnSummary(bill).isFullyReturned;

export const getAvailableReturnQuantity = (soldQuantity, returnedQuantity) =>
  Math.max(0, (Number(soldQuantity) || 0) - (Number(returnedQuantity) || 0));
