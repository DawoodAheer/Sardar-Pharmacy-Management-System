import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList, PackagePlus, RefreshCw, CheckCircle2, XCircle, Truck, Loader2,
} from 'lucide-react';
import api from '../utils/api';

const STATUS_CONFIG = {
  DRAFT: { label: 'Draft', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  ORDERED: { label: 'Ordered', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300' },
  RECEIVED: { label: 'Received', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400' },
};

const fmtDate = (v) =>
  v ? new Date(v).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function PurchaseOrdersPanel({ compact = false }) {
  const queryClient = useQueryClient();
  const [supplierOverrides, setSupplierOverrides] = useState({});
  const [quantities, setQuantities] = useState({});
  const [msg, setMsg] = useState('');

  const { data: lowData, isFetching, refetch } = useQuery({
    queryKey: ['lowStockMedicines'],
    queryFn: async () => (await api.get('/purchase-orders/low-stock')).data?.medicines || [],
    refetchInterval: 60000,
  });

  const { data: ordersData } = useQuery({
    queryKey: ['purchaseOrders'],
    queryFn: async () => (await api.get('/purchase-orders')).data?.orders || [],
    refetchInterval: 30000,
  });

  const createOrder = useMutation({
    mutationFn: async ({ medicine, quantity }) => {
      const supplier = supplierOverrides[medicine._id] || {};
      return (
        await api.post('/purchase-orders', {
          supplierName: supplier.name || 'Local Supplier',
          supplierPhone: supplier.phone || '',
          items: [{ medicineId: medicine._id, quantityOrdered: quantity }],
        })
      ).data;
    },
    onSuccess: async (r) => {
      setMsg(r.message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] }),
        queryClient.invalidateQueries({ queryKey: ['lowStockMedicines'] }),
      ]);
    },
    onError: (e) => setMsg(e?.response?.data?.message || 'Unable to create purchase order.'),
  });

  const updateOrder = useMutation({
    mutationFn: async ({ id, status }) =>
      (await api.patch('/purchase-orders/' + id + '/status', { status })).data,
    onSuccess: async (r) => {
      setMsg(r.message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] }),
        queryClient.invalidateQueries({ queryKey: ['lowStockMedicines'] }),
        queryClient.invalidateQueries({ queryKey: ['medicines'] }),
        queryClient.invalidateQueries({ queryKey: ['superadminMedicines'] }),
      ]);
    },
    onError: (e) => setMsg(e?.response?.data?.message || 'Unable to update purchase order.'),
  });

  const lowStock = Array.isArray(lowData) ? lowData : [];
  const orders = Array.isArray(ordersData) ? ordersData : [];

  return (
    <section className="rounded-2xl border border-orange-200 bg-white shadow-sm dark:border-orange-900/50 dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-orange-100 bg-orange-50/70 px-5 py-4 dark:border-orange-900/40 dark:bg-orange-950/20">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500">
            <ClipboardList size={20} className="text-white" />
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              Low Stock &amp; Purchase Orders
              {lowStock.length > 0 && (
                <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {lowStock.length}
                </span>
              )}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Medicines below reorder level · create &amp; track orders
            </p>
          </div>
        </div>
        <button
          type="button" onClick={() => refetch()} aria-label="Refresh low-stock list"
          className="rounded-lg p-2 text-slate-400 hover:bg-orange-100 dark:hover:bg-orange-900/40"
        >
          <RefreshCw size={15} className={isFetching ? 'animate-spin text-orange-500' : ''} />
        </button>
      </div>

      <div className="space-y-5 p-5">
        {msg && (
          <p role="status" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {msg}
          </p>
        )}

        {/* Low Stock List */}
        {lowStock.length > 0 ? (
          <div>
            <h3 className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-300">
              Medicines Below Reorder Level
            </h3>
            <div className="max-h-72 space-y-2 overflow-auto">
              {lowStock.slice(0, 100).map((medicine) => {
                const supplier = supplierOverrides[medicine._id] || {
                  name: '',
                  phone: '',
                };
                const suggested = Math.max(
                  1,
                  10 - Number(medicine.quantity || 0)
                );
                const qty = quantities[medicine._id] ?? suggested;

                return (
                  <div
                    key={medicine._id}
                    className="rounded-xl border border-orange-100 bg-orange-50/40 p-3 dark:border-orange-900/40 dark:bg-orange-950/10"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-800 dark:text-white">
                          {medicine.name}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Stock:{' '}
                          <strong className="text-rose-600">{medicine.quantity}</strong> · Low stock alert (≤ 10)
                          {medicine.expiryDate && ' · Exp: ' + fmtDate(medicine.expiryDate)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => createOrder.mutate({ medicine, quantity: Number(qty) })}
                        disabled={createOrder.isPending}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
                      >
                        {createOrder.isPending ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <PackagePlus size={11} />
                        )}
                        Create Order
                      </button>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-semibold uppercase text-slate-400">Order Qty</span>
                        <input
                          type="number" min="1" step="1" value={qty}
                          onChange={(e) =>
                            setQuantities((p) => ({ ...p, [medicine._id]: e.target.value }))
                          }
                          className="rounded-lg border border-orange-200 bg-white px-2 py-1 text-xs focus:border-orange-400 focus:outline-none dark:border-orange-800 dark:bg-slate-800 dark:text-white"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-semibold uppercase text-slate-400">Supplier</span>
                        <input
                          value={supplier.name}
                          onChange={(e) =>
                            setSupplierOverrides((p) => ({
                              ...p,
                              [medicine._id]: { ...supplier, name: e.target.value },
                            }))
                          }
                          placeholder="Supplier name"
                          className="rounded-lg border border-orange-200 bg-white px-2 py-1 text-xs focus:border-orange-400 focus:outline-none dark:border-orange-800 dark:bg-slate-800 dark:text-white"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-semibold uppercase text-slate-400">Phone</span>
                        <input
                          value={supplier.phone}
                          onChange={(e) =>
                            setSupplierOverrides((p) => ({
                              ...p,
                              [medicine._id]: { ...supplier, phone: e.target.value },
                            }))
                          }
                          placeholder="Contact"
                          className="rounded-lg border border-orange-200 bg-white px-2 py-1 text-xs focus:border-orange-400 focus:outline-none dark:border-orange-800 dark:bg-slate-800 dark:text-white"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 size={14} className="text-emerald-500" />
            All medicines are above their reorder levels.
          </div>
        )}

        {/* Recent Orders */}
        <div>
          <h3 className="mb-2 border-t border-slate-100 pt-4 text-xs font-bold text-slate-700 dark:border-slate-800 dark:text-slate-300">
            Recent Orders ({orders.length})
          </h3>
          {orders.length > 0 ? (
            <div className="max-h-64 space-y-2 overflow-auto">
              {orders.slice(0, 30).map((order) => {
                const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.DRAFT;
                return (
                  <div
                    key={order._id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="text-xs text-slate-800 dark:text-white">
                          {order.orderNumber}
                        </strong>
                        <span className={'rounded-full px-2 py-0.5 text-[10px] font-bold ' + cfg.cls}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">{order.supplierName}</p>
                      <p className="text-[10px] text-slate-400">
                        {(order.items || [])
                          .map((i) => i.medicineName + ' x' + i.quantityOrdered)
                          .join(', ')}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {order.status === 'DRAFT' && (
                        <button
                          type="button"
                          onClick={() => updateOrder.mutate({ id: order._id, status: 'ORDERED' })}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[10px] font-bold text-white"
                        >
                          <Truck size={10} /> Mark Ordered
                        </button>
                      )}
                      {order.status === 'ORDERED' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  'Mark received and add quantities to stock?'
                                )
                              )
                                updateOrder.mutate({ id: order._id, status: 'RECEIVED' });
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[10px] font-bold text-white"
                          >
                            <CheckCircle2 size={10} /> Receive
                          </button>
                          <button
                            type="button"
                            onClick={() => updateOrder.mutate({ id: order._id, status: 'CANCELLED' })}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-2.5 py-1.5 text-[10px] font-bold text-rose-600"
                          >
                            <XCircle size={10} /> Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No purchase orders yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
