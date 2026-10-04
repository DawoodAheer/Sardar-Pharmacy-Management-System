const fs = require('fs');
const file = 'c:/Users/waqas/Sardar-Pharmacy-Management-System/client/src/pages/pharmacist/InStoreBilling.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add updatePrice function to InStoreBilling.jsx
const updateQuantityFunc = `  const updateQuantity = (medicineId, newQuantity) => {`;
const updatePriceFunc = `  const updatePrice = (medicineId, newPrice) => {
    setCartItems((currentItems) =>
      currentItems.map((item) =>
        item.medicineId === medicineId
          ? { ...item, unitPrice: newPrice, salePrice: newPrice }
          : item
      )
    );
  };

`;

if (!content.includes('updatePrice = (medicineId')) {
  content = content.replace(updateQuantityFunc, updatePriceFunc + updateQuantityFunc);
}

// 2. Modify the Cart Item UI to make price editable
// Find where the unitPrice is displayed in the cart and change it to an input field
const priceDisplay = `<p className="font-bold text-slate-900 dark:text-white">
                                {formatPKR(
                                  item.unitPrice
                                )}
                              </p>`;
const priceDisplayCRLF = priceDisplay.replace(/\n/g, '\r\n');

const editablePrice = `<div className="flex items-center gap-1">
                                <span className="text-xs text-slate-500">PKR</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="w-20 rounded border border-slate-300 px-2 py-1 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                  value={item.unitPrice}
                                  onChange={(e) => updatePrice(item.medicineId, Number(e.target.value) || 0)}
                                />
                              </div>`;

if (content.includes(priceDisplay)) {
  content = content.replace(priceDisplay, editablePrice);
} else if (content.includes(priceDisplayCRLF)) {
  content = content.replace(priceDisplayCRLF, editablePrice.replace(/\n/g, '\r\n'));
}

// 3. Update the handleConfirmBill payload
const itemsPayloadTarget = `items: cartItems.map((item) => ({
          medicineId: item.medicineId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),`;
const itemsPayloadCRLF = itemsPayloadTarget.replace(/\n/g, '\r\n');

const newItemsPayload = `items: cartItems.map((item) => ({
          medicineId: item.medicineId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          salePrice: item.unitPrice, // include custom sale price
        })),`;

if (content.includes(itemsPayloadTarget)) {
  content = content.replace(itemsPayloadTarget, newItemsPayload);
} else if (content.includes(itemsPayloadCRLF)) {
  content = content.replace(itemsPayloadCRLF, newItemsPayload.replace(/\n/g, '\r\n'));
}

fs.writeFileSync(file, content);
console.log('done');
