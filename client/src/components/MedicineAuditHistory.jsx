import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, RefreshCw, ChevronDown, ChevronUp, User, Clock } from 'lucide-react';
import api from '../utils/api';

const FIELD_LABELS = {
  price: 'Sale Price',
  purchasePrice: 'Purchase Cost',
  quantity: 'Stock',
  expiryDate: 'Expiry',
  unitsPerPack: 'Units/Pack',
  supplierName: 'Supplier',
  supplierPhone: 'Supplier Phone',
  name: 'Name',
  manufacturer: 'Manufacturer',
  category: 'Category',
  reorderLevel: 'Reorder Level',
  isDeleted: 'Archived',
};

const ACTION_STYLE = {
  created: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  updated: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  stock_adjusted: 'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300',
  archived: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
  restored: 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300',
  bulk_imported: 'bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300',
};

const fmtVal = (v) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s))
    return new Date(v).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
  return s.length > 50 ? s.slice(0, 50) + '…' : s;
};

const fmtDT = (v) =>
  v ? new Date(v).toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

function AuditRecord({ record }) {
  const [open, setOpen] = useState(false);
  const action = record.action || 'updated';
  const badgeClass = ACTION_STYLE[action] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  const hasChanges = Array.isArray(record.changedFields) && record.changedFields.length > 0;

  return (
    <article className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-xs font-semibold text-slate-800 dark:text-white">
              {record.medicineName}
            </span>
            <span className={'rounded-full px-2 py-0.5 text-[10px] font-bold ' + badgeClass}>
              {action.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <User size={10} /> {record.performedBy?.name || 'Staff'}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={10} /> {fmtDT(record.createdAt)}
            </span>
            {record.reason && <span className="italic">"{record.reason}"</span>}
          </div>
        </div>
        {hasChanges && (
          <div className="shrink-0 text-slate-400">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        )}
      </button>

      {open && hasChanges && (
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700">
          <div className="flex flex-wrap gap-2">
            {record.changedFields.map((field) => (
              <div key={field} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[10px] dark:bg-slate-900">
                <span className="font-bold text-slate-600 dark:text-slate-400">
                  {FIELD_LABELS[field] || field}
                </span>
                <div className="mt-0.5 flex items-center gap-1.5 font-mono">
                  <span className="rounded bg-rose-100 px-1 py-0.5 text-rose-700 line-through dark:bg-rose-950/50 dark:text-rose-400">
                    {fmtVal(record.previousValues?.[field])}
                  </span>
                  <span className="text-slate-400">→</span>
                  <span className="rounded bg-emerald-100 px-1 py-0.5 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                    {fmtVal(record.newValues?.[field])}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export default function MedicineAuditHistory({ compact = false }) {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['medicineAuditHistory'],
    queryFn: async () => (await api.get('/medicines/audit-history')).data?.records || [],
    refetchInterval: 30000,
  });

  const records = Array.isArray(data) ? data : [];
  if (!records.length && !isFetching) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4 dark:border-slate-700 dark:bg-slate-800/40">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600">
            <History size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Medicine Change History</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Who changed what, old vs new values, with timestamps
            </p>
          </div>
        </div>
        <button
          type="button" onClick={() => refetch()} aria-label="Refresh change history"
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <RefreshCw size={15} className={isFetching ? 'animate-spin text-indigo-500' : ''} />
        </button>
      </div>

      <div className="p-4">
        {!records.length ? (
          <p className="text-xs text-slate-500">Loading recent changes…</p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-auto pr-1">
            {records.slice(0, 50).map((r) => (
              <AuditRecord key={r._id} record={r} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
