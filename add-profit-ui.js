const fs = require('fs');
const file = 'c:/Users/waqas/Sardar-Pharmacy-Management-System/client/src/pages/SuperadminDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

const salesSummaryQuery = `  const {
    data: salesSummary,
    isLoading: isSalesLoading,
    isError: isSalesError,
    refetch: refetchSales,
  } = useQuery({
    queryKey: ['superadminSalesSummary'],
    queryFn: async () => {
      const response =
        await api.get(
          '/bills/sales-summary'
        );

      return response.data;
    },
  });`;
const salesSummaryQueryCRLF = salesSummaryQuery.replace(/\n/g, '\r\n');

const profitSummaryQuery = `
  const {
    data: profitSummary,
    isLoading: isProfitLoading,
  } = useQuery({
    queryKey: ['profitSummary'],
    queryFn: async () => {
      const response = await api.get('/bills/profit-summary');
      return response.data;
    },
  });
`;

if (content.includes(salesSummaryQuery)) {
  content = content.replace(salesSummaryQuery, salesSummaryQuery + profitSummaryQuery);
} else if (content.includes(salesSummaryQueryCRLF)) {
  content = content.replace(salesSummaryQueryCRLF, salesSummaryQueryCRLF + profitSummaryQuery.replace(/\n/g, '\r\n'));
}

const inventorySectionEnd = `        </section>

        {/* USER MANAGEMENT TABLE */}`;

const inventorySectionEndCRLF = inventorySectionEnd.replace(/\n/g, '\r\n');

const profitSection = `        </section>

        {/* PROFIT SUMMARY */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Profit Summary
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Net profit calculated from sales minus purchase cost.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Today's Profit
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {isProfitLoading ? '...' : getCurrency(profitSummary?.dailyProfit || 0)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                This Month's Profit
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {isProfitLoading ? '...' : getCurrency(profitSummary?.monthlyProfit || 0)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                This Year's Profit
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {isProfitLoading ? '...' : getCurrency(profitSummary?.yearlyProfit || 0)}
              </p>
            </div>
          </div>
        </section>

        {/* USER MANAGEMENT TABLE */}`;

if (content.includes(inventorySectionEnd)) {
  content = content.replace(inventorySectionEnd, profitSection);
} else if (content.includes(inventorySectionEndCRLF)) {
  content = content.replace(inventorySectionEndCRLF, profitSection.replace(/\n/g, '\r\n'));
}

fs.writeFileSync(file, content);
console.log('done');
