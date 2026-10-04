const fs = require('fs');
const file = 'c:/Users/waqas/Sardar-Pharmacy-Management-System/client/src/pages/SuperadminDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

// Use regex or string replace for Table header
content = content.replace(
  '<th className="px-4 py-3 text-right">Price</th>',
  '<th className="px-4 py-3 text-right">Purchase Price</th>\n                            <th className="px-4 py-3 text-right">Sale Price</th>'
);

// Table cell
const oldCell = `<td className="px-4 py-3 text-right">
                                      PKR {getMedicinePrice(
                                        medicine
                                      )}
                                    </td>`;
const oldCellCRLF = oldCell.replace(/\n/g, '\r\n');

const newCell = `<td className="px-4 py-3 text-right">
                                      PKR {Number(medicine.purchasePrice || 0).toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      PKR {getMedicinePrice(
                                        medicine
                                      )}
                                    </td>`;

if (content.includes(oldCell)) {
  content = content.replace(oldCell, newCell);
} else if (content.includes(oldCellCRLF)) {
  content = content.replace(oldCellCRLF, newCell.replace(/\n/g, '\r\n'));
}

fs.writeFileSync(file, content);
console.log('done');
