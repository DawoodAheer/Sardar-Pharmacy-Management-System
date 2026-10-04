import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { X, Download, Package } from 'lucide-react';

const getCurrency = (value) => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
  }).format(value || 0);
};

export default function ProfitDetailsModal({ isOpen, onClose }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['profitDetails', startDate, endDate],
    queryFn: async () => {
      let url = '/bills/profit-details';
      if (startDate && endDate) {
        url += `?startDate=${startDate}&endDate=${endDate}`;
      }
      const response = await api.get(url);
      return response.data?.profitDetails || [];
    },
    enabled: isOpen,
  });

  const totals = (data || []).reduce(
    (acc, item) => {
      acc.quantitySold += item.quantitySold || 0;
      acc.remainingStock += item.remainingStock || 0;
      acc.totalCost += item.totalCost || 0;
      acc.totalSales += item.totalSales || 0;
      acc.totalProfit += item.totalProfit || 0;
      return acc;
    },
    { quantitySold: 0, remainingStock: 0, totalCost: 0, totalSales: 0, totalProfit: 0 }
  );

  const handleDownloadCSV = () => {
    if (!data || data.length === 0) return;

    // Create CSV header
    const headers = [
      'Medicine Name',
      'Purchase Price',
      'Sale Price',
      'Quantity Sold',
      'Remaining Stock',
      'Total Purchase Cost',
      'Total Sales',
      'Total Profit',
    ];
    const csvRows = [headers.join(',')];

    // Add data rows
    data.forEach((row) => {
      const rowData = [
        `"${row.name}"`,
        row.purchasePrice || 0,
        row.salePrice || 0,
        row.quantitySold || 0,
        row.remainingStock || 0,
        row.totalCost || 0,
        row.totalSales || 0,
        row.totalProfit || 0,
      ];
      csvRows.push(rowData.join(','));
    });

    // Add Total Summary row at end of CSV
    const summaryRow = [
      '"TOTAL SUMMARY"',
      '""',
      '""',
      totals.quantitySold,
      totals.remainingStock,
      totals.totalCost,
      totals.totalSales,
      totals.totalProfit,
    ];
    csvRows.push(summaryRow.join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `profit_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Profit Details Breakdown</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">View detailed purchase rate, sale rate, stock & profit margins per medicine.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <span className="text-slate-500 text-sm">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <button
              onClick={handleDownloadCSV}
              disabled={isLoading || !data || data.length === 0}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Download size={16} />
              Download Excel (CSV)
            </button>
          </div>

          <div className="h-[420px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
              <thead className="sticky top-0 bg-slate-100 uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 font-semibold">Medicine</th>
                  <th className="px-4 py-3 font-semibold">Purchase Price</th>
                  <th className="px-4 py-3 font-semibold">Sale Price</th>
                  <th className="px-4 py-3 font-semibold text-center">Qty Sold</th>
                  <th className="px-4 py-3 font-semibold text-center">Remaining Stock</th>
                  <th className="px-4 py-3 font-semibold">Total Cost</th>
                  <th className="px-4 py-3 font-semibold">Total Sales</th>
                  <th className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">Total Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {isLoading ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                      Loading profit data...
                    </td>
                  </tr>
                ) : !data || data.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                      No sales data found for this period.
                    </td>
                  </tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.medicineId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <Package size={16} className="text-slate-400 shrink-0" />
                        <span>{item.name}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{getCurrency(item.purchasePrice)}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{getCurrency(item.salePrice)}</td>
                      <td className="px-4 py-3 text-center font-medium text-slate-800 dark:text-slate-200">{item.quantitySold}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                          (item.remainingStock || 0) > 10
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                            : (item.remainingStock || 0) > 0
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                        }`}>
                          {item.remainingStock ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">{getCurrency(item.totalCost)}</td>
                      <td className="px-4 py-3">{getCurrency(item.totalSales)}</td>
                      <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">
                        {getCurrency(item.totalProfit)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {data && data.length > 0 && (
                <tfoot className="sticky bottom-0 bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white shadow-md">
                  <tr>
                    <td className="px-4 py-3 uppercase text-xs tracking-wider" colSpan="3">
                      OVERALL TOTAL
                    </td>
                    <td className="px-4 py-3 text-center text-blue-600 dark:text-blue-400">
                      {totals.quantitySold}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">
                      {totals.remainingStock}
                    </td>
                    <td className="px-4 py-3">
                      {getCurrency(totals.totalCost)}
                    </td>
                    <td className="px-4 py-3">
                      {getCurrency(totals.totalSales)}
                    </td>
                    <td className="px-4 py-3 text-base text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40">
                      {getCurrency(totals.totalProfit)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
