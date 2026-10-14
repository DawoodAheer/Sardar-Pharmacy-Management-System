export const getPurchaseCostPerUnit = (medicineOrPackCost, unitsPerPack) => {
  const isMedicine = typeof medicineOrPackCost === 'object' && medicineOrPackCost !== null;
  const packCost = Number(isMedicine ? medicineOrPackCost.purchasePrice : medicineOrPackCost) || 0;
  const packSize = Number(isMedicine ? medicineOrPackCost.unitsPerPack : unitsPerPack);
  return packCost / (Number.isInteger(packSize) && packSize > 0 ? packSize : 1);
};

export const getInventoryPurchaseValue = medicine => {
  if (Array.isArray(medicine?.batches) && medicine.batches.length) {
    return medicine.batches.reduce((total, batch) =>
      total + (Number(batch.quantity) || 0) * (Number(batch.purchaseCost) || 0), 0);
  }
  return (Number(medicine?.quantity ?? medicine?.stock) || 0) * getPurchaseCostPerUnit(medicine);
};
