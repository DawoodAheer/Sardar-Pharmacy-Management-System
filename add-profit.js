const fs = require('fs');

const profitMethod = `
// @desc    Get profit summary (daily, monthly, yearly, custom date range)
// @route   GET /api/bills/profit-summary
// @access  Private/Pharmacist/Superadmin
export const getProfitSummary = async (req, res, next) => {
  try {
    if (req.user.role !== 'pharmacist' && req.user.role !== 'superadmin') {
      res.status(403);
      return next(new Error('Only pharmacists and superadmins can view profit summary'));
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

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    let dailyProfit = 0;
    let monthlyProfit = 0;
    let yearlyProfit = 0;
    let customProfit = 0;
    let customSales = 0;

    bills.forEach((bill) => {
      let totalCost = 0;
      bill.items.forEach((item) => {
        totalCost += (item.purchasePrice || 0) * item.quantity;
      });

      const profit = bill.total - totalCost;
      const billDate = new Date(bill.createdAt);

      if (billDate >= startOfDay) dailyProfit += profit;
      if (billDate >= startOfMonth) monthlyProfit += profit;
      if (billDate >= startOfYear) yearlyProfit += profit;

      if (startDate && endDate) {
        customProfit += profit;
        customSales += bill.total;
      }
    });

    res.json({
      success: true,
      dailyProfit,
      monthlyProfit,
      yearlyProfit,
      customRange: startDate && endDate ? { profit: customProfit, sales: customSales } : null
    });
  } catch (error) {
    next(error);
  }
};
`;

const file = 'c:/Users/waqas/Sardar-Pharmacy-Management-System/server/controllers/billController.js';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('getProfitSummary')) {
  fs.appendFileSync(file, profitMethod);
  console.log('added profitMethod to billController');
} else {
  console.log('profitMethod already exists');
}
