import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { X, RotateCcw, AlertTriangle, CheckCircle, Package, Receipt, DollarSign } from 'lucide-react';

const getCurrency = (value) => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
  }).format(value || 0);
};

export default function SalesReturnModal({ isOpen, onClose, bill }) {
  const queryClient = useQueryClient();
  const [returnItems, setReturnItems] = useState({});
  const [reasons, setReasons] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (bill && bill.items) {
      const initialReturns = {};
      const initialReasons = {};

      bill.items.forEach((item) => {
        initialReturns[item.medicineId] = 0;
        initialReasons[item.medicineId] = 'Customer Return / Change of Mind';
      });

      setReturnItems(initialReturns);
      setReasons(initialReasons);
      setError('');
      setSuccess('');
    }
  }, [bill, isOpen]);

  const returnMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post(`/bills/${bill._id}/return`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['salesSummary'] });
      queryClient.invalidateQueries({ queryKey: ['profitSummary'] });
      queryClient.invalidateQueries({ queryKey: ['profitDetails'] });

      setSuccess(data.message || 'Sales return processed successfully!');
      setError('');
    },
    onError: (err) => {
      setError(err.response?.data?.message || 'Failed to process sales return');
      setSuccess('');
    },
  });

  const getAvailableToReturn = (item) => {
    const previouslyReturned = (bill.returns || [])
      .filter((r) => String(r.medicineId) === String(item.medicineId))
      .reduce((sum, r) => sum + r.quantityReturned, 0);

    return Math.max(0, item.quantity - previouslyReturned);
  };

  const handleQtyChange = (medicineId, qty, maxAvail) => {
    const num = Math.max(0, Math.min(Number(qty) || 0, maxAvail));
    setReturnItems((prev) => ({
      ...prev,
      [medicineId]: num,
    }));
  };

  const handleReasonChange = (medicineId, reasonStr) => {
    setReasons((prev) => ({
      ...prev,
      [medicineId]: reasonStr,
    }));
  };

  // Calculate total refund preview
  const totalRefundPreview = bill?.items
    ? bill.items.reduce((sum, item) => {
        const qty = returnItems[item.medicineId] || 0;
        const price = item.salePrice || item.unitPrice || 0;
        return sum + qty * price;
      }, 0)
    : 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const returnsPayload = [];
    bill.items.forEach((item) => {
      const qtyToReturn = returnItems[item.medicineId] || 0;
      if (qtyToReturn > 0) {
        returnsPayload.push({
          medicineId: item.medicineId,
          quantityReturned: qtyToReturn,
          reason: reasons[item.medicineId] || 'Customer Sale Return',
        });
      }
    });

    if (returnsPayload.length === 0) {
      setError('Please select at least 1 medicine quantity to return.');
      return;
    }

    returnMutation.mutate({ returns: returnsPayload });
  };

  if (!isOpen || !bill) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600 text-white">
              <RotateCcw size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Process Sales Return & Refund
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bill #{bill.billNumber} • Customer: {bill.customerId?.name || bill.customerPhone || 'Walk-in Customer'}
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

        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
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

          {/* BILL SUMMARY STRIP */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4 border border-slate-200 dark:border-slate-800 dark:bg-slate-800/40 text-xs">
            <div>
              <span className="text-slate-500">Original Total Bill:</span>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{getCurrency(bill.total)}</div>
            </div>
            <div>
              <span className="text-slate-500">Previously Refunded:</span>
              <div className="text-sm font-bold text-amber-600 dark:text-amber-400">{getCurrency(bill.totalRefunded || 0)}</div>
            </div>
            <div>
              <span className="text-slate-500">New Refund Preview:</span>
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{getCurrency(totalRefundPreview)}</div>
            </div>
          </div>

          {/* ITEMS TO RETURN TABLE */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Medicine Item</th>
                    <th className="px-3 py-3">Price</th>
                    <th className="px-3 py-3">Bought / Prev. Returned</th>
                    <th className="px-3 py-3 w-32">Return Qty</th>
                    <th className="px-4 py-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {bill.items.map((item) => {
                    const maxAvail = getAvailableToReturn(item);
                    const qtyToReturn = returnItems[item.medicineId] || 0;
                    const price = item.salePrice || item.unitPrice || 0;

                    return (
                      <tr key={item._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <Package size={14} className="text-slate-400" />
                            {item.name}
                          </div>
                        </td>
                        <td className="px-3 py-3 font-mono">{getCurrency(price)}</td>
                        <td className="px-3 py-3">
                          <span className="font-bold text-slate-900 dark:text-white">{item.quantity}</span>
                          {item.quantity - maxAvail > 0 && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 block">
                              ({item.quantity - maxAvail} returned)
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {maxAvail === 0 ? (
                            <span className="text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                              Fully Returned
                            </span>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              max={maxAvail}
                              value={qtyToReturn}
                              onChange={(e) => handleQtyChange(item.medicineId, e.target.value, maxAvail)}
                              className="w-20 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {maxAvail > 0 && (
                            <input
                              type="text"
                              value={reasons[item.medicineId] || ''}
                              onChange={(e) => handleReasonChange(item.medicineId, e.target.value)}
                              placeholder="Return reason..."
                              disabled={qtyToReturn === 0}
                              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs outline-none focus:border-amber-500 dark:bg-slate-800 dark:text-white disabled:opacity-40"
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* PREVIOUS RETURNS LOG (IF ANY) */}
            {bill.returns && bill.returns.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 mb-2 flex items-center gap-1.5">
                  <RotateCcw size={14} /> Previous Return History for this Bill:
                </h4>
                <div className="space-y-1.5 text-[11px] text-amber-800 dark:text-amber-400">
                  {bill.returns.map((ret, index) => (
                    <div key={index} className="flex justify-between items-center border-b border-amber-200/60 dark:border-amber-900/40 pb-1 last:border-0">
                      <div>
                        <strong>{ret.quantityReturned}x {ret.name}</strong> — {ret.reason || 'Customer Return'}
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                          Returned on {new Date(ret.returnedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="font-bold text-amber-700 dark:text-amber-300">
                        Refunded: {getCurrency(ret.refundAmount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SUBMIT BUTTONS */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel / Close
              </button>
              <button
                type="submit"
                disabled={returnMutation.isPending || totalRefundPreview === 0}
                className="rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
              >
                <RotateCcw size={16} />
                {returnMutation.isPending ? 'Processing Return...' : `Confirm Return & Refund (${getCurrency(totalRefundPreview)})`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
