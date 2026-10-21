export const getInstoreSalePrice = (item, defaultPrice) => {
  if (item.packSalePrice === undefined && item.unitsPerPack === undefined) {
    return getSalePrice(item.salePrice, defaultPrice);
  }
  const packPrice = Number(item.packSalePrice);
  const units = Number(item.unitsPerPack);
  if (String(item.packSalePrice ?? '').trim() === '' || !Number.isFinite(packPrice) || packPrice <= 0 ||
      String(item.unitsPerPack ?? '').trim() === '' || !Number.isSafeInteger(units) || units < 1) {
    throw new Error('Enter a positive pack sale price and a positive whole number of units per pack');
  }
  return packPrice / units;
};

export const getSalePrice = (requestedPrice, defaultPrice) => {
  const salePrice =
    requestedPrice === undefined ||
    requestedPrice === null ||
    requestedPrice === ''
      ? Number(defaultPrice)
      : Number(requestedPrice);

  if (!Number.isFinite(salePrice) || salePrice <= 0) {
    throw new Error('Sale price must be a positive number');
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
