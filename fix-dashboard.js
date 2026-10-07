const fs = require('fs');
const file = 'c:/Users/waqas/Sardar-Pharmacy-Management-System/client/src/pages/PharmacistDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

// Fix handleMedSubmit validation
content = content.replace('!genericName.trim() ||\n', '');
content = content.replace('!genericName.trim() ||\r\n', '');
content = content.replace('!manufacturer.trim() ||\n', '');
content = content.replace('!manufacturer.trim() ||\r\n', '');
content = content.replace(/\s*!genericName\.trim\(\) \|\|/g, '');
content = content.replace(/\s*!manufacturer\.trim\(\) \|\|/g, '');

// Fix placeholder in bulk import
content = content.replace(/"genericName": "Paracetamol",\s*\n/g, '');
content = content.replace(/"genericName": "Paracetamol",\s*\r\n/g, '');
content = content.replace(/"manufacturer": "GSK",\s*\n/g, '');
content = content.replace(/"manufacturer": "GSK",\s*\r\n/g, '');
content = content.replace(/"category": "Analgesic",\s*\n/g, '');
content = content.replace(/"category": "Analgesic",\s*\r\n/g, '');
content = content.replace(/"rackLocation": "R-02-B"\s*\n/g, '');
content = content.replace(/"rackLocation": "R-02-B"\s*\r\n/g, '');

fs.writeFileSync(file, content);
console.log('done');
