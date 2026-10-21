export function packUnitPrice(packSalePrice, unitsPerPack) {
  if (String(packSalePrice).trim() === '' || String(unitsPerPack).trim() === '') return null;
  const price = Number(packSalePrice), units = Number(unitsPerPack);
  return Number.isFinite(price) && price > 0 && Number.isSafeInteger(units) && units > 0 ? price / units : null;
}

export function validBillLine(item) {
  if (item.saleMode === 'packs' && (!Number.isSafeInteger(Number(item.packQuantity)) || Number(item.packQuantity) <= 0 || Number(item.quantity) !== Number(item.packQuantity) * Number(item.unitsPerPack))) return false;
  return packUnitPrice(item.packSalePrice, item.unitsPerPack) !== null &&
    Number.isSafeInteger(Number(item.quantity)) && Number(item.quantity) > 0 && Number(item.quantity) <= item.stock;
}
