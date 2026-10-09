export const summarizeDailyClosing = ({ bills = [], returns = [], creditIssued = 0, creditRecovered = 0 } = {}) => {
  const salesByMethod = { Cash: 0, Card: 0, Online: 0 };
  for (const bill of bills) {
    const method = bill.paymentMethod === 'UPI' || bill.paymentMethod === 'Online' ? 'Online' : bill.paymentMethod;
    if (Object.hasOwn(salesByMethod, method)) salesByMethod[method] += Number(bill.total || 0);
  }
  const refundsByMethod = { Cash: 0, Card: 0, Online: 0 };
  for (const record of returns) {
    const originalMethod = record.sale_id?.paymentMethod || 'Cash';
    const method = originalMethod === 'UPI' || originalMethod === 'Online' ? 'Online' : originalMethod;
    if (Object.hasOwn(refundsByMethod, method)) refundsByMethod[method] += Number(record.refund_amount || 0);
  }
  const grossSales = Object.values(salesByMethod).reduce((sum, amount) => sum + amount, 0);
  const refunds = Object.values(refundsByMethod).reduce((sum, amount) => sum + amount, 0);
  return {
    salesByMethod, refundsByMethod, grossSales, refunds,
    netSalesAfterRefunds: grossSales - refunds,
    udharCreditIssued: Number(creditIssued || 0),
    udharRecovered: Number(creditRecovered || 0),
    netCollections: grossSales - refunds + Number(creditRecovered || 0),
  };
};
