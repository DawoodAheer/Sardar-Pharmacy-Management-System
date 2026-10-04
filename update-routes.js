const fs = require('fs');
const file = 'c:/Users/waqas/Sardar-Pharmacy-Management-System/server/routes/billRoutes.js';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('getProfitSummary')) {
  content = content.replace(
    'getSalesSummary,',
    'getSalesSummary,\n  getProfitSummary,'
  );

  content += `

// Profit summary
router.get(
  '/profit-summary',
  authorize('superadmin', 'pharmacist'),
  getProfitSummary
);
`;
  fs.writeFileSync(file, content);
  console.log('added route');
}
