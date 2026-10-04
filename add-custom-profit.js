const fs = require('fs');
const file = 'c:/Users/waqas/Sardar-Pharmacy-Management-System/client/src/pages/SuperadminDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add state for custom date range
const stateMarker = `  const [searchTerm, setSearchTerm] =
    useState('');`;
const newState = `  const [profitStartDate, setProfitStartDate] = useState('');
  const [profitEndDate, setProfitEndDate] = useState('');`;

if (content.includes(stateMarker)) {
  content = content.replace(stateMarker, stateMarker + '\n' + newState);
} else if (content.includes(stateMarker.replace(/\n/g, '\r\n'))) {
  content = content.replace(stateMarker.replace(/\n/g, '\r\n'), stateMarker.replace(/\n/g, '\r\n') + '\r\n' + newState.replace(/\n/g, '\r\n'));
}

// 2. Update profitSummary query to use state
const oldQuery = `  const {
    data: profitSummary,
    isLoading: isProfitLoading,
  } = useQuery({
    queryKey: ['profitSummary'],
    queryFn: async () => {
      const response = await api.get('/bills/profit-summary');
      return response.data;
    },
  });`;

const oldQueryCRLF = oldQuery.replace(/\n/g, '\r\n');

const newQuery = `  const {
    data: profitSummary,
    isLoading: isProfitLoading,
  } = useQuery({
    queryKey: ['profitSummary', profitStartDate, profitEndDate],
    queryFn: async () => {
      let url = '/bills/profit-summary';
      if (profitStartDate && profitEndDate) {
        url += \`?startDate=\${profitStartDate}&endDate=\${profitEndDate}\`;
      }
      const response = await api.get(url);
      return response.data;
    },
  });`;

if (content.includes(oldQuery)) {
  content = content.replace(oldQuery, newQuery);
} else if (content.includes(oldQueryCRLF)) {
  content = content.replace(oldQueryCRLF, newQuery.replace(/\n/g, '\r\n'));
}

// 3. Update UI to include Date Pickers and Custom Range profit card
const oldUI = `        {/* PROFIT SUMMARY */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Profit Summary
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Net profit calculated from sales minus purchase cost.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">`;

const oldUICRLF = oldUI.replace(/\n/g, '\r\n');

const newUI = `        {/* PROFIT SUMMARY */}
        <section>
          <div className="mb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Profit Summary
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Net profit calculated from sales minus purchase cost.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={profitStartDate} 
                onChange={(e) => setProfitStartDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <span className="text-slate-500 text-xs">to</span>
              <input 
                type="date" 
                value={profitEndDate} 
                onChange={(e) => setProfitEndDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-4">
            {profitStartDate && profitEndDate && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm dark:border-blue-900/50 dark:bg-blue-900/20">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                  Custom Range Profit
                </p>
                <p className="mt-2 text-2xl font-bold text-blue-700 dark:text-blue-400">
                  {isProfitLoading ? '...' : getCurrency(profitSummary?.customRange?.profit || 0)}
                </p>
              </div>
            )}`;

if (content.includes(oldUI)) {
  content = content.replace(oldUI, newUI);
} else if (content.includes(oldUICRLF)) {
  content = content.replace(oldUICRLF, newUI.replace(/\n/g, '\r\n'));
}

fs.writeFileSync(file, content);
console.log('done');
