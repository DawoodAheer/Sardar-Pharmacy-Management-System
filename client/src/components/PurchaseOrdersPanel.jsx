import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, PackagePlus, RefreshCw } from 'lucide-react';
import api from '../utils/api';

const statusStyle = { DRAFT: 'bg-slate-100 text-slate-700', ORDERED: 'bg-blue-100 text-blue-800', RECEIVED: 'bg-emerald-100 text-emerald-800', CANCELLED: 'bg-rose-100 text-rose-800' };

export default function PurchaseOrdersPanel({ compact = false }) {
  const queryClient = useQueryClient();
  const [supplierOverrides, setSupplierOverrides] = useState({});
  const [quantities, setQuantities] = useState({});
  const [message, setMessage] = useState('');
  const { data: lowData, isFetching, refetch } = useQuery({ queryKey: ['lowStockMedicines'], queryFn: async () => (await api.get('/purchase-orders/low-stock')).data?.medicines || [], refetchInterval: 60000 });
  const { data: ordersData } = useQuery({ queryKey: ['purchaseOrders'], queryFn: async () => (await api.get('/purchase-orders')).data?.orders || [], refetchInterval: 30000 });
  const createOrder = useMutation({
    mutationFn: async ({ medicine, quantity }) => {
      const supplier = supplierOverrides[medicine._id] || {};
      return (await api.post('/purchase-orders', {
        supplierName: supplier.name || medicine.supplierName,
        supplierPhone: supplier.phone || medicine.supplierPhone,
        items: [{ medicineId: medicine._id, quantityOrdered: quantity }],
      })).data;
    },
    onSuccess: async (result) => { setMessage(result.message); await Promise.all([queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] }), queryClient.invalidateQueries({ queryKey: ['lowStockMedicines'] })]); },
    onError: (error) => setMessage(error?.response?.data?.message || 'Unable to create purchase order.'),
  });
  const updateOrder = useMutation({
    mutationFn: async ({ id, status }) => (await api.patch(`/purchase-orders/${id}/status`, { status })).data,
    onSuccess: async (result) => { setMessage(result.message); await Promise.all([queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] }), queryClient.invalidateQueries({ queryKey: ['lowStockMedicines'] }), queryClient.invalidateQueries({ queryKey: ['medicines'] }), queryClient.invalidateQueries({ queryKey: ['superadminMedicines'] })]); },
    onError: (error) => setMessage(error?.response?.data?.message || 'Unable to update purchase order.'),
  });
  const lowStock = Array.isArray(lowData) ? lowData : [];
  const orders = Array.isArray(ordersData) ? ordersData : [];
  return <section className={`rounded-2xl border border-orange-200 bg-white shadow-sm ${compact ? 'p-4' : 'p-5'}`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><ClipboardList size={17} className="text-orange-600" /> Low stock & purchase orders <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs">{lowStock.length}</span></h2><button type="button" onClick={() => refetch()} aria-label="Refresh low-stock list" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} /></button></div>
    {message && <p role="status" className="mt-2 text-xs font-semibold text-slate-600">{message}</p>}
    {lowStock.length ? <div className="mt-3 max-h-64 space-y-2 overflow-auto">{lowStock.slice(0, 100).map((medicine) => {
      const supplier = supplierOverrides[medicine._id] || { name: medicine.supplierName || '', phone: medicine.supplierPhone || '' };
      const suggested = Math.max(1, Number(medicine.reorderLevel || 0) - Number(medicine.quantity || 0));
      return <div key={medicine._id} className="grid gap-2 rounded-lg border border-orange-100 bg-orange-50/40 p-3 sm:grid-cols-[minmax(130px,1fr)_80px_130px_120px_90px_auto] sm:items-center"><div className="min-w-0"><strong className="block truncate text-xs text-slate-800">{medicine.name}</strong><span className="text-[10px] text-slate-500">Stock {medicine.quantity} · reorder at {medicine.reorderLevel}</span></div><label className="text-[10px] text-slate-500">Order qty<input type="number" min="1" step="1" value={quantities[medicine._id] ?? suggested} onChange={(event) => setQuantities((current) => ({ ...current, [medicine._id]: event.target.value }))} className="mt-1 w-full rounded border px-2 py-1 text-xs" /></label><label className="text-[10px] text-slate-500">Supplier<input value={supplier.name} onChange={(event) => setSupplierOverrides((current) => ({ ...current, [medicine._id]: { ...supplier, name: event.target.value } }))} className="mt-1 w-full rounded border px-2 py-1 text-xs" placeholder="Supplier name" /></label><label className="text-[10px] text-slate-500">Phone<input value={supplier.phone} onChange={(event) => setSupplierOverrides((current) => ({ ...current, [medicine._id]: { ...supplier, phone: event.target.value } }))} className="mt-1 w-full rounded border px-2 py-1 text-xs" placeholder="Contact" /></label><span className="text-[10px] text-slate-500">Expiry {medicine.expiryDate ? new Date(medicine.expiryDate).toLocaleDateString('en-PK') : '—'}</span><button type="button" onClick={() => createOrder.mutate({ medicine, quantity: Number(quantities[medicine._id] ?? suggested) })} disabled={createOrder.isPending} className="inline-flex items-center justify-center gap-1 rounded-lg bg-orange-600 px-2 py-2 text-[10px] font-bold text-white disabled:opacity-50"><PackagePlus size={13} /> Create</button></div>;
    })}</div> : <p className="mt-3 text-xs text-slate-500">No medicines are below their reorder level.</p>}
    <h3 className="mt-4 border-t pt-3 text-xs font-bold text-slate-800">Recent orders ({orders.length})</h3>
    {orders.length ? <div className="mt-2 max-h-64 space-y-2 overflow-auto">{orders.slice(0, 30).map((order) => <div key={order._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-3 text-xs"><div><strong>{order.orderNumber}</strong><span className="ml-2 text-slate-600">{order.supplierName}</span><p className="mt-1 text-[10px] text-slate-500">{order.items?.map((item) => `${item.medicineName} × ${item.quantityOrdered}`).join(', ')}</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusStyle[order.status]}`}>{order.status}</span>{order.status === 'DRAFT' && <button type="button" onClick={() => updateOrder.mutate({ id: order._id, status: 'ORDERED' })} className="rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white">Mark ordered</button>}{order.status === 'ORDERED' && <><button type="button" onClick={() => { if (window.confirm('Mark these quantities received and add them to stock?')) updateOrder.mutate({ id: order._id, status: 'RECEIVED' }); }} className="rounded bg-emerald-700 px-2 py-1 text-[10px] font-bold text-white">Receive stock</button><button type="button" onClick={() => updateOrder.mutate({ id: order._id, status: 'CANCELLED' })} className="rounded border px-2 py-1 text-[10px] font-bold">Cancel</button></>}</div></div>)}</div> : <p className="mt-2 text-xs text-slate-500">No purchase orders yet.</p>}
  </section>;
}
