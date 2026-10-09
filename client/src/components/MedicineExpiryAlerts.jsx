import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, RefreshCw, PackageX } from 'lucide-react';
import api from '../utils/api';

const fmtDate = (v) =>
  v ? new Date(v).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const daysLeft = (v) => {
  if (!v) return null;
  const diff = Math.ceil(
    (new Date(v).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000
  );
  return diff;
};

function ExpiryBadge({ days }) {
  if (days === null) return null;
  if (days < 0)
    return (
      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-400">
        Expired {Math.abs(days)}d ago
      </span>
    );
  if (days === 0)
    return (
      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-400">
        Expires today
      </span>
    );
  if (days <= 30)
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950/50 dark:text-red-400">
        {days}d left
      </span>
    );
  if (days <= 90)
    return (
      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700 dark:bg-orange-950/50 dark:text-orange-400">
        {days}d left
      </span>
    );
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
      {days}d left
    </span>
  );
}

function MedicineRow({ medicine }) {
  const days = daysLeft(medicine.expiryDate);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 text-xs last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-800 dark:text-white">{medicine.name}</p>
        {medicine.genericName && (
          <p className="text-[10px] text-slate-400">{medicine.genericName}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-[10px] text-slate-500">
          Stock: <strong className="text-slate-700 dark:text-slate-300">{medicine.quantity}</strong>
        </span>
        <span className="text-[10px] text-slate-500">{fmtDate(medicine.expiryDate)}</span>
        <ExpiryBadge days={days} />
      </div>
    </div>
  );
}

export default function MedicineExpiryAlerts({ compact = false }) {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['medicineExpiryAlerts'],
    queryFn: async () => {
      const [expired, expiring] = await Promise.all([
        api.get('/medicines', { params: { status: 'EXPIRED' } }),
        api.get('/medicines', { params: { status: 'EXPIRING' } }),
      ]);
      return {
        expired: Array.isArray(expired.data) ? expired.data : [],
        expiring: Array.isArray(expiring.data) ? expiring.data : [],
      };
    },
    refetchInterval: 60000,
  });

  const expired = data?.expired || [];
  const expiring = data?.expiring || [];
  const total = expired.length + expiring.length;

  if (!total && !isFetching) return null;

  return (
    <section className="rounded-2xl border border-amber-200 bg-white shadow-sm dark:border-amber-900/50 dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-amber-100 bg-amber-50/70 px-5 py-4 dark:border-amber-900/40 dark:bg-amber-950/20">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500">
            <CalendarClock size={20} className="text-white" />
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              Stock Expiry Alerts
              {total > 0 && (
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {total}
                </span>
              )}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Expired items cannot be billed — act on these immediately
            </p>
          </div>
        </div>
        <button
          type="button" onClick={() => refetch()} aria-label="Refresh expiry alerts"
          className="rounded-lg p-2 text-slate-400 hover:bg-amber-100 dark:hover:bg-amber-900/40"
        >
          <RefreshCw size={15} className={isFetching ? 'animate-spin text-amber-500' : ''} />
        </button>
      </div>

      {isFetching && !data ? (
        <p className="px-5 py-4 text-xs text-slate-500">Checking medicine expiry…</p>
      ) : (
        <div className={'grid gap-0 ' + (expired.length && expiring.length ? 'lg:grid-cols-2' : '')}>
          {/* Expired */}
          {expired.length > 0 && (
            <div className={'border-b border-slate-100 dark:border-slate-800 ' + (expiring.length ? 'lg:border-b-0 lg:border-r' : '')}>
              <div className="flex items-center gap-2 bg-rose-50 px-4 py-2.5 dark:bg-rose-950/20">
                <PackageX size={14} className="text-rose-600" />
                <span className="text-xs font-bold text-rose-800 dark:text-rose-300">
                  EXPIRED ({expired.length})
                </span>
                <span className="ml-auto text-[10px] font-semibold text-rose-600">Cannot be billed</span>
              </div>
              <div className="max-h-56 overflow-auto">
                {expired.slice(0, 100).map((m) => (
                  <MedicineRow key={m._id} medicine={m} />
                ))}
              </div>
            </div>
          )}

          {/* Expiring Soon */}
          {expiring.length > 0 && (
            <div>
              <div className="flex items-center gap-2 bg-amber-50 px-4 py-2.5 dark:bg-amber-950/20">
                <AlertTriangle size={14} className="text-amber-600" />
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  EXPIRING SOON ({expiring.length})
                </span>
                <span className="ml-auto text-[10px] font-semibold text-amber-600">Within 6 months</span>
              </div>
              <div className="max-h-56 overflow-auto">
                {expiring.slice(0, 100).map((m) => (
                  <MedicineRow key={m._id} medicine={m} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
