export const getPurchaseCostPerUnit = (medicineOrPackCost, unitsPerPack) => {
  const isMedicine = typeof medicineOrPackCost === 'object' && medicineOrPackCost !== null;
  const packCost = Number(isMedicine ? medicineOrPackCost.purchasePrice : medicineOrPackCost) || 0;
  const packSize = Number(isMedicine ? medicineOrPackCost.unitsPerPack : unitsPerPack);
  return packCost / (Number.isInteger(packSize) && packSize > 0 ? packSize : 1);
};
