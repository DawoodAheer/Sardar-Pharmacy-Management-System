import { useQuery } from '@tanstack/react-query';
import { History, RefreshCw } from 'lucide-react';
import api from '../utils/api';

const fields = { price: 'Sale price', purchasePrice: 'Purchase cost', quantity: 'Stock', expiryDate: 'Expiry', unitsPerPack: 'Units/pack', supplierName: 'Supplier', supplierPhone: 'Supplier phone' };
const display = (value) => value === null || value === undefined ? '—' : value instanceof Date ? value.toLocaleDateString() : String(value).slice(0, 40);

export default function MedicineAuditHistory({ compact = false }) {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['medicineAuditHistory'],
    queryFn: async () => (await api.get('/medicines/audit-history')).data?.records || [],
    refetchInterval: 30000,
  });
  const records = Array.isArray(data) ? data : [];
  if (!records.length && !isFetching) return null;
  return <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${compact ? 'p-4' : 'p-5'}`}>
    <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><History size={17} className="text-indigo-600" /> Medicine change history</h2><button type="button" onClick={() => refetch()} aria-label="Refresh medicine audit history" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} /></button></div>
    {!records.length ? <p className="mt-3 text-xs text-slate-500">Loading recent changes…</p> : <div className="mt-3 max-h-72 space-y-2 overflow-auto">{records.slice(0, 30).map((record) => <article key={record._id} className="rounded-lg border border-slate-100 p-3 text-xs"><div className="flex flex-wrap items-center justify-between gap-1"><strong className="text-slate-800">{record.medicineName} · {record.action.replaceAll('_', ' ')}</strong><span className="text-slate-500">{new Date(record.createdAt).toLocaleString('en-PK')}</span></div><p className="mt-1 text-slate-500">By {record.performedBy?.name || 'Staff'}</p>{record.changedFields?.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{record.changedFields.map((field) => <span key={field} className="rounded-md bg-slate-50 px-2 py-1 text-slate-700">{fields[field] || field}: {display(record.previousValues?.[field])} → {display(record.newValues?.[field])}</span>)}</div>}{record.reason && <p className="mt-1 text-slate-500">Reason: {record.reason}</p>}</article>)}</div>}
  </section>;
}
