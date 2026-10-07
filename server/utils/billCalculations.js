export const getSalePrice = (requestedPrice, defaultPrice, minimumPrice = 0) => {
  const salePrice =
    requestedPrice === undefined ||
    requestedPrice === null ||
    requestedPrice === ''
      ? Number(defaultPrice)
      : Number(requestedPrice);

  if (!Number.isFinite(salePrice) || salePrice < 0) {
    throw new Error('Sale price must be a non-negative number');
  }

  const enforcedMinimum = Number(minimumPrice) || 0;
  if (salePrice < enforcedMinimum) {
    throw new Error('Sale price cannot be lower than the purchase price');
  }

  return salePrice;
};

export const getNetItemAmounts = ({
  purchasePrice,
  salePrice,
  quantity,
  discountRatio,
}) => {
  const grossSales = salePrice * quantity;
  const discountAmount = grossSales * discountRatio;
  const netSales = grossSales - discountAmount;
  const cost = purchasePrice * quantity;

  return {
    cost,
    grossSales,
    discountAmount,
    netSales,
    profit: netSales - cost,
  };
};

export const getDiscountedReturnRefund = ({
  itemSalePrice,
  itemQuantity,
  quantityAlreadyReturned,
  quantityToReturn,
  subtotal,
  discount,
  previousItemRefunds,
}) => {
  const lineTotal = itemSalePrice * itemQuantity;
  const lineNetTotal =
    subtotal > 0 ? lineTotal * (1 - discount / subtotal) : 0;
  const cumulativeNetRefund =
    Math.round(
      ((lineNetTotal * (quantityAlreadyReturned + quantityToReturn)) /
        itemQuantity +
        Number.EPSILON) *
        100
    ) / 100;

  return Math.max(0, cumulativeNetRefund - previousItemRefunds);
};
