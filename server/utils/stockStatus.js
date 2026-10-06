export const getStockStatus = (quantity) => {
  const stock = Number(quantity) || 0;
  if (stock <= 0) return 'End Stock';
  if (stock < 5) return 'Low Stock';
  if (stock > 20) return 'High Stock';
  return 'Stock Available';
};
