const fs = require('fs');
const file = 'c:/Users/waqas/Sardar-Pharmacy-Management-System/client/src/pages/PharmacistDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add state variable
content = content.replace(
  "const [price, setPrice] =\n    useState('');",
  "const [price, setPrice] =\n    useState('');\n  const [purchasePrice, setPurchasePrice] =\n    useState('');"
);
content = content.replace(
  "const [price, setPrice] =\r\n    useState('');",
  "const [price, setPrice] =\r\n    useState('');\r\n  const [purchasePrice, setPurchasePrice] =\r\n    useState('');"
);

// 2. Clear state in openAddMedModal
content = content.replace(
  "setPrice('');",
  "setPrice('');\n    setPurchasePrice('');"
);

// 3. Set state in openEditMedModal
content = content.replace(
  "setPrice(\n      med.price\n    );",
  "setPrice(\n      med.price\n    );\n    setPurchasePrice(med.purchasePrice || '');"
);
content = content.replace(
  "setPrice(\r\n      med.price\r\n    );",
  "setPrice(\r\n      med.price\r\n    );\r\n    setPurchasePrice(med.purchasePrice || '');"
);

// 4. Add to handleMedSubmit medicineData object
content = content.replace(
  "price: Number(price),",
  "price: Number(price),\n      purchasePrice: Number(purchasePrice) || 0,"
);

// 5. Add input field to the form
const priceInputTarget = `<input\n                  required\n                  type="number"\n                  min="0"\n                  step="0.01"\n                  value={\n                    price\n                  }\n                  onChange={(event) =>\n                    setPrice(\n                      event.target.value\n                    )\n                  }\n                  placeholder="Price (PKR)"\n                  className="border rounded-lg px-3 py-2 text-xs"\n                />`;
const priceInputCRLF = priceInputTarget.replace(/\n/g, '\r\n');

const newInputs = `<input\n                  required\n                  type="number"\n                  min="0"\n                  step="0.01"\n                  value={\n                    purchasePrice\n                  }\n                  onChange={(event) =>\n                    setPurchasePrice(\n                      event.target.value\n                    )\n                  }\n                  placeholder="Purchase Price (PKR)"\n                  className="border rounded-lg px-3 py-2 text-xs"\n                />\n                <input\n                  required\n                  type="number"\n                  min="0"\n                  step="0.01"\n                  value={\n                    price\n                  }\n                  onChange={(event) =>\n                    setPrice(\n                      event.target.value\n                    )\n                  }\n                  placeholder="Sale Price (PKR)"\n                  className="border rounded-lg px-3 py-2 text-xs"\n                />`;

if(content.includes(priceInputTarget)) {
  content = content.replace(priceInputTarget, newInputs);
} else if(content.includes(priceInputCRLF)) {
  content = content.replace(priceInputCRLF, newInputs.replace(/\n/g, '\r\n'));
}

// 6. Update Medicine Table to show both prices
content = content.replace(
  `<th className="px-4 py-3 text-right">Price</th>`,
  `<th className="px-4 py-3 text-right">Purchase Price</th>\n                            <th className="px-4 py-3 text-right">Sale Price</th>`
);

content = content.replace(
  `<td className="px-4 py-3 font-medium text-right text-slate-900 dark:text-white">\n                                  PKR {med.price}\n                                </td>`,
  `<td className="px-4 py-3 font-medium text-right text-slate-900 dark:text-white">\n                                  PKR {med.purchasePrice || 0}\n                                </td>\n                                <td className="px-4 py-3 font-medium text-right text-slate-900 dark:text-white">\n                                  PKR {med.price}\n                                </td>`
);

// Fallback for CRLF on table cells
content = content.replace(
  `<td className="px-4 py-3 font-medium text-right text-slate-900 dark:text-white">\r\n                                  PKR {med.price}\r\n                                </td>`,
  `<td className="px-4 py-3 font-medium text-right text-slate-900 dark:text-white">\r\n                                  PKR {med.purchasePrice || 0}\r\n                                </td>\r\n                                <td className="px-4 py-3 font-medium text-right text-slate-900 dark:text-white">\r\n                                  PKR {med.price}\r\n                                </td>`
);

fs.writeFileSync(file, content);
console.log('done');
