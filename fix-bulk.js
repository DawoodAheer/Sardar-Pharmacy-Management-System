const fs = require('fs');
const file = 'c:/Users/waqas/Sardar-Pharmacy-Management-System/client/src/pages/PharmacistDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = 'placeholder={`[\n  {\n    "name": "Panadol 500mg",\n            "expiryDate": "2028-01-01",\n    "price": 450,\n    "quantity": 500,\n    "reorderLevel": 50,\n          }\n]`}'

const target2 = 'placeholder={`[\r\n  {\r\n    "name": "Panadol 500mg",\r\n            "expiryDate": "2028-01-01",\r\n    "price": 450,\r\n    "quantity": 500,\r\n    "reorderLevel": 50,\r\n          }\r\n]`}'


const replacement = 'placeholder={`[\n  {\n    "name": "Panadol 500mg",\n    "expiryDate": "2028-01-01",\n    "price": 450,\n    "quantity": 500,\n    "reorderLevel": 50\n  }\n]`}'

content = content.replace(target, replacement);
content = content.replace(target2, replacement);

fs.writeFileSync(file, content);
console.log('done');
