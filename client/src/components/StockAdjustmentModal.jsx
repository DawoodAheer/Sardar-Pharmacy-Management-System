import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { X, Sliders, History, AlertTriangle, CheckCircle, PlusCircle, MinusCircle, RefreshCw } from 'lucide-react';

export default function StockAdjustmentModal({ isOpen, onClose, medicine }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('adjust'); // 'adjust' | 'history'

  const [adjustmentType, setAdjustmentType] = useState('ADD'); // ADD, SUBTRACT, SET
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('Physical Inventory Audit');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch Stock Adjustment Logs
  const { data: logs = [], isLoading: isLogsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['stockAdjustments'],
    queryFn: async () => {
      const res = await api.get('/medicines/stock-adjustments');
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: isOpen && activeTab === 'history',
  });

  const adjustMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post(`/medicines/${medicine._id}/adjust-stock`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['stockAdjustments'] });
      setSuccess(data.message || 'Stock successfully adjusted!');
      setError('');
      setAmount('');
    },
    onError: (err) => {
      setError(err.response?.data?.message || 'Failed to adjust stock');
      setSuccess('');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!medicine?._id) {
      setError('No medicine selected for adjustment');
      return;
    }

    const quantity = Number(amount);
    if (
      amount === '' ||
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      (adjustmentType !== 'SET' && quantity === 0)
    ) {
      setError(
        adjustmentType === 'SET'
          ? 'Please enter a valid whole stock quantity'
          : 'Please enter a positive whole quantity'
      );
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for stock adjustment');
      return;
    }

    adjustMutation.mutate({
      adjustmentType,
      amount: Number(amount),
      reason: reason.trim(),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Sliders size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Stock Level Adjustment
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {medicine ? `${medicine.name} (Current Stock: ${medicine.quantity || 0})` : 'Audit and modify inventory levels'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X size={20} />
          </button>
        </div>

        {/* TABS */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50/50 dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('adjust')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition ${
              activeTab === 'adjust'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Sliders size={15} />
            Adjust Stock
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              refetchLogs();
            }}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <History size={15} />
            Adjustment Audit Log
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'adjust' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-600 border border-red-200 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-300">
                  <AlertTriangle size={16} />
                  {error}
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-600 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-300">
                  <CheckCircle size={16} />
                  {success}
                </div>
              )}

              {medicine && (
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 dark:border-slate-800 dark:bg-slate-800/50 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-slate-500">Medicine:</span> <strong className="text-slate-900 dark:text-white">{medicine.name}</strong>
                    <div className="text-[11px] text-slate-400">{medicine.genericName} • Rack: {medicine.rackLocation || 'N/A'}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500">Current In-Stock:</span>
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{medicine.quantity || 0} units</div>
                  </div>
                </div>
              )}

              {/* ACTION TYPE */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Adjustment Type
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('ADD')}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold border transition ${
                      adjustmentType === 'ADD'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <PlusCircle size={16} />
                    Add Stock
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustmentType('SUBTRACT')}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold border transition ${
                      adjustmentType === 'SUBTRACT'
                        ? 'bg-red-600 text-white border-red-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <MinusCircle size={16} />
                    Remove Stock
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustmentType('SET')}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold border transition ${
                      adjustmentType === 'SET'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <RefreshCw size={16} />
                    Set Exact Qty
                  </button>
                </div>
              </div>

              {/* QUANTITY */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {adjustmentType === 'SET' ? 'Exact Stock Quantity' : 'Quantity Units'}
                </label>
                <input
                  type="number"
                  min={adjustmentType === 'SET' ? '0' : '1'}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 10"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* REASON PRESETS & INPUT */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Adjustment
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {['Physical Inventory Audit', 'Damaged / Expired Write-Off', 'Supplier Restock', 'Audit Correction', 'Lost Stock'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setReason(preset)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                        reason === preset
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Specify custom reason..."
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* BUTTONS */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={adjustMutation.isPending}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-blue-700 disabled:opacity-50"
                >
                  {adjustMutation.isPending ? 'Updating...' : 'Save Stock Adjustment'}
                </button>
              </div>
            </form>
          ) : (
            /* HISTORY TAB */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Recent Stock Adjustments</h3>
                <button
                  onClick={() => refetchLogs()}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <RefreshCw size={12} /> Refresh Logs
                </button>
              </div>

              <div className="max-h-[350px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                {isLogsLoading ? (
                  <div className="p-8 text-center text-xs text-slate-500">Loading adjustment history...</div>
                ) : logs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">No stock adjustment logs found.</div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">
                      <tr>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Medicine</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Prev → New</th>
                        <th className="px-3 py-2">Reason</th>
                        <th className="px-3 py-2">Adjusted By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300">
                      {logs.map((log) => (
                        <tr key={log._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-3 py-2 whitespace-nowrap text-[11px]">
                            {new Date(log.createdAt).toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">
                            {log.medicineName}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.adjustmentType === 'ADD' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                              log.adjustmentType === 'SUBTRACT' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' :
                              'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            }`}>
                              {log.adjustmentType} ({log.quantityChanged > 0 ? `+${log.quantityChanged}` : log.quantityChanged})
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap font-mono text-[11px]">
                            {log.previousQuantity} → <strong className="text-slate-900 dark:text-white">{log.newQuantity}</strong>
                          </td>
                          <td className="px-3 py-2 max-w-[150px] truncate" title={log.reason}>
                            {log.reason}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-[11px]">
                            {log.adjustedBy?.name || 'Staff'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
