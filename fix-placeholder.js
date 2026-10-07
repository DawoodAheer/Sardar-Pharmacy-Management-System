const fs = require('fs');
const file = 'c:/Users/waqas/Sardar-Pharmacy-Management-System/client/src/pages/PharmacistDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

// Update placeholder text in Bulk Import modal
const oldPlaceholder = `placeholder={\`[
  {
    "name": "Panadol 500mg",
    "expiryDate": "2028-01-01",
    "price": 450,
    "quantity": 500,
    "reorderLevel": 50
  }
]\`}`;

const newPlaceholder = `placeholder={\`[
  {
    "name": "Panadol 500mg",
    "price": 450,
    "quantity": 500,
    "expiryDate": "2028-01-01",
    "reorderLevel": 50,
    "manufacturer": "GSK",
    "category": "Analgesic",
    "barcode": "1234567890",
    "rackLocation": "R-02-B"
  }
]\`}`;

if (content.includes(oldPlaceholder)) {
  content = content.replace(oldPlaceholder, newPlaceholder);
  console.log('Placeholder updated successfully');
} else {
  console.log('Placeholder not found - trying partial match...');
  // Try with \r\n line endings
  const oldCRLF = oldPlaceholder.replace(/\n/g, '\r\n');
  if (content.includes(oldCRLF)) {
    content = content.replace(oldCRLF, newPlaceholder);
    console.log('Placeholder updated (CRLF)');
  } else {
    console.log('Still not found');
  }
}

fs.writeFileSync(file, content);
