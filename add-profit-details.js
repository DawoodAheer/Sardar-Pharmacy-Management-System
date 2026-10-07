const fs = require('fs');
const file = 'c:/Users/waqas/Sardar-Pharmacy-Management-System/server/controllers/billController.js';
let content = fs.readFileSync(file, 'utf8');

const profitDetailsMethod = `
// @desc    Get detailed profit by medicine
// @route   GET /api/bills/profit-details
// @access  Private/Pharmacist/Superadmin
export const getProfitDetails = async (req, res, next) => {
  try {
    if (req.user.role !== 'pharmacist' && req.user.role !== 'superadmin') {
      res.status(403);
      return next(new Error('Only pharmacists and superadmins can view profit details'));
    }

    const { startDate, endDate } = req.query;
    const matchStage = {
      orderStatus: { $nin: ['PENDING', 'REJECTED'] },
    };

    if (startDate && endDate) {
      matchStage.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    }

    const bills = await Bill.find(matchStage);

    // Aggregate by medicine
    const medicineProfitMap = {};

    bills.forEach((bill) => {
      bill.items.forEach((item) => {
        if (!medicineProfitMap[item.medicineId]) {
          medicineProfitMap[item.medicineId] = {
            medicineId: item.medicineId,
            name: item.name,
            quantitySold: 0,
            totalCost: 0,
            totalSales: 0,
            totalProfit: 0,
          };
        }

        const cost = (item.purchasePrice || 0) * item.quantity;
        const sales = (item.salePrice || item.unitPrice || 0) * item.quantity;
        const profit = sales - cost;

        medicineProfitMap[item.medicineId].quantitySold += item.quantity;
        medicineProfitMap[item.medicineId].totalCost += cost;
        medicineProfitMap[item.medicineId].totalSales += sales;
        medicineProfitMap[item.medicineId].totalProfit += profit;
      });
    });

    const profitDetails = Object.values(medicineProfitMap).sort((a, b) => b.totalProfit - a.totalProfit);

    res.json({
      success: true,
      profitDetails,
    });
  } catch (error) {
    next(error);
  }
};
`;

if (!content.includes('getProfitDetails')) {
  fs.appendFileSync(file, profitDetailsMethod);
  console.log('added getProfitDetails');
}

// Update routes
const routesFile = 'c:/Users/waqas/Sardar-Pharmacy-Management-System/server/routes/billRoutes.js';
let routesContent = fs.readFileSync(routesFile, 'utf8');

if (!routesContent.includes('getProfitDetails')) {
  routesContent = routesContent.replace(
    'getProfitSummary,',
    'getProfitSummary,\n  getProfitDetails,'
  );

  routesContent += `
// Profit details
router.get(
  '/profit-details',
  authorize('superadmin', 'pharmacist'),
  getProfitDetails
);
`;
  fs.writeFileSync(routesFile, routesContent);
  console.log('added route details');
}
