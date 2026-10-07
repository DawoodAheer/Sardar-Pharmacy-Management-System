const fs = require('fs');
const file = 'c:/Users/waqas/Sardar-Pharmacy-Management-System/client/src/pages/PharmacistDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

// Remove genericName input block
content = content.replace(/<input\s+required\s+value={\s*genericName\s*}\s+onChange={\(event\) =>\s+setGenericName\(\s*event.target.value\s*\)\s*}\s+placeholder="Generic Name"\s+className="border rounded-lg px-3 py-2 text-xs"\s*\/>/g, '');

// Remove category select block
content = content.replace(/<select\s+value={\s*category\s*}\s+onChange={\(event\) =>\s+setCategory\(\s*event.target.value\s*\)\s*}\s+className="border rounded-lg px-3 py-2 text-xs"\s*>\s*{\s*standardCategories\.map\(\s*\(item\) => \(\s*<option\s+key={item}\s+value={item}\s*>\s*{\s*item\s*}\s*<\/option>\s*\)\s*\)\s*}\s*<\/select>/g, '');

// Make manufacturer optional
content = content.replace(/<input\s+required\s+value={\s*manufacturer\s*}\s+onChange={\(event\) =>\s+setManufacturer\(\s*event.target.value\s*\)\s*}\s+placeholder="Manufacturer"\s+className="border rounded-lg px-3 py-2 text-xs"\s*\/>/g, '<input value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} placeholder="Manufacturer" className="border rounded-lg px-3 py-2 text-xs" />');

// also genericName is required in state, maybe just in the Add Medicine form.

fs.writeFileSync(file, content);
console.log('done');
