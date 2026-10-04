const fs = require('fs');
const file = 'c:/Users/waqas/Sardar-Pharmacy-Management-System/client/src/pages/PharmacistDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

// Fix handleMedSubmit - remove genericName.trim() and manufacturer.trim() from validation
// Current state of the if block:
const oldValidation = `    if (
      !name.trim() ||
                  !expiryDate ||
      price === '' ||
      quantity === ''
    ) {`;
const newValidation = `    if (
      !name.trim() ||
      !expiryDate ||
      price === ''
    ) {`;
content = content.replace(oldValidation, newValidation);

// Also fix the CRLF version
const oldValidationCRLF = oldValidation.replace(/\n/g, '\r\n');
const newValidationCRLF = newValidation.replace(/\n/g, '\r\n');
content = content.replace(oldValidationCRLF, newValidationCRLF);

// Remove quantity === '' from validation (allow 0 quantity)
content = content.replace(`      !name.trim() ||\r\n      !expiryDate ||\r\n      price === '' ||\r\n      quantity === ''\r\n    )`, `      !name.trim() ||\r\n      !expiryDate ||\r\n      price === ''\r\n    )`);

fs.writeFileSync(file, content);
console.log('done');
