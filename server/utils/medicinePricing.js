export const getPurchaseCostPerUnit = (packPurchasePrice, unitsPerPack = 1) => {
  const packCost = Number(packPurchasePrice) || 0;
  const packSize = Number(unitsPerPack);
  return packCost / (Number.isInteger(packSize) && packSize > 0 ? packSize : 1);
};

export const isValidUnitsPerPack = (unitsPerPack) =>
  Number.isInteger(Number(unitsPerPack)) && Number(unitsPerPack) >= 1;
