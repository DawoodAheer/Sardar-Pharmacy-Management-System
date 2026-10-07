const fs = require('fs');
const file = 'c:/Users/waqas/Sardar-Pharmacy-Management-System/client/src/pages/PharmacistDashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add ProfitDetailsModal import
const importMarker = `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';`;
if (content.includes(importMarker)) {
  content = content.replace(importMarker, importMarker + `\nimport ProfitDetailsModal from '../components/ProfitDetailsModal';`);
}

// 2. Add Profit state
const stateMarker = `  const [isSalesOpen, setIsSalesOpen] = useState(false);
  const [salesViewType, setSalesViewType] = useState('daily');`;
const stateMarkerCRLF = stateMarker.replace(/\n/g, '\r\n');

const profitState = `  const [isProfitModalOpen, setIsProfitModalOpen] = useState(false);`;

if (content.includes(stateMarker)) {
  content = content.replace(stateMarker, stateMarker + '\n' + profitState);
} else if (content.includes(stateMarkerCRLF)) {
  content = content.replace(stateMarkerCRLF, stateMarkerCRLF + '\r\n' + profitState);
}

// 3. Add Profit query
const salesQueryMarker = `  const {
    data: salesSummary,
    isLoading: isSalesSummaryLoading,
    refetch: refetchSalesSummary,
  } = useQuery({
    queryKey: ['salesSummary'],
    queryFn: async () => {
      const response = await api.get('/bills/sales-summary');
      return response.data;
    },
  });`;
const salesQueryMarkerCRLF = salesQueryMarker.replace(/\n/g, '\r\n');

const profitQuery = `
  const {
    data: profitSummary,
    isLoading: isProfitLoading,
  } = useQuery({
    queryKey: ['profitSummary'],
    queryFn: async () => {
      const response = await api.get('/bills/profit-summary');
      return response.data;
    },
  });`;

if (content.includes(salesQueryMarker)) {
  content = content.replace(salesQueryMarker, salesQueryMarker + profitQuery);
} else if (content.includes(salesQueryMarkerCRLF)) {
  content = content.replace(salesQueryMarkerCRLF, salesQueryMarkerCRLF + profitQuery.replace(/\n/g, '\r\n'));
}

// 4. Add Profit Button in UI
const salesCard = `                {/* TODAY'S SALES */}

                <button
                  onClick={() =>
                    openSalesDetails(
                      'daily'
                    )
                  }
                  className="text-left bg-white dark:bg-gray-900 p-4 rounded-2xl border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-50 shadow-sm hover:shadow-md hover:border-emerald-300 transition"
                >

                  <div className="text-[10px] uppercase font-bold text-emerald-600">
                    Today's Sales
                  </div>

                  <div className="flex justify-between items-end mt-2">

                    <div>

                      <div className="text-lg font-bold text-emerald-700">
                        {isSalesSummaryLoading
                          ? '...'
                          : getCurrency(
                              todaySales
                            )}
                      </div>

                      <div className="text-[9px] text-slate-600 dark:text-slate-400 mt-1">
                        {
                          todayBills
                        }{' '}
                        bill(s)
                      </div>

                    </div>

                    <Wallet className="w-5 h-5" />

                  </div>

                  <div className="text-[9px] text-emerald-600 mt-2 font-bold">
                    Click to view sales
                  </div>

                </button>`;

const salesCardCRLF = salesCard.replace(/\n/g, '\r\n');

const profitCard = `
                {/* TODAY'S PROFIT */}
                <button
                  onClick={() => setIsProfitModalOpen(true)}
                  className="text-left bg-white dark:bg-gray-900 p-4 rounded-2xl border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-50 shadow-sm hover:shadow-md hover:border-blue-300 transition"
                >
                  <div className="text-[10px] uppercase font-bold text-blue-600">
                    Today's Profit
                  </div>
                  <div className="flex justify-between items-end mt-2">
                    <div>
                      <div className="text-lg font-bold text-blue-700">
                        {isProfitLoading ? '...' : getCurrency(profitSummary?.dailyProfit || 0)}
                      </div>
                      <div className="text-[9px] text-slate-600 dark:text-slate-400 mt-1">
                        Click for detailed report
                      </div>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-[9px] text-blue-600 mt-2 font-bold">
                    View full profit & download
                  </div>
                </button>
`;

if (content.includes(salesCard)) {
  content = content.replace(salesCard, salesCard + profitCard);
} else if (content.includes(salesCardCRLF)) {
  content = content.replace(salesCardCRLF, salesCardCRLF + profitCard.replace(/\n/g, '\r\n'));
}

// Add ProfitDetailsModal to render
const bottomMarker = `        {/* SUCCESS / ERROR TOASTS */}`;
const modalRender = `        <ProfitDetailsModal 
          isOpen={isProfitModalOpen} 
          onClose={() => setIsProfitModalOpen(false)} 
        />\n`;

if (content.includes(bottomMarker)) {
  content = content.replace(bottomMarker, modalRender + bottomMarker);
}

fs.writeFileSync(file, content);
console.log('done pharmacist');
