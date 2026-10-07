const fs = require('fs');
const file = 'c:/Users/waqas/Sardar-Pharmacy-Management-System/client/src/pages/PharmacistDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/const \[category, setCategory\] = useState\('Antibiotic'\);/g, "const [category, setCategory] = useState('');");

fs.writeFileSync(file, content);
console.log('done');
