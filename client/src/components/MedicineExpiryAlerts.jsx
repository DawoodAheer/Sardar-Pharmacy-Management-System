import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, RefreshCw } from 'lucide-react';
import api from '../utils/api';

const dateText = (value) => value ? new Date(value).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No expiry date';

export default function MedicineExpiryAlerts({ compact = false }) {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['medicineExpiryAlerts'],
    queryFn: async () => {
      const [expired, expiring] = await Promise.all([
        api.get('/medicines', { params: { status: 'EXPIRED' } }),
        api.get('/medicines', { params: { status: 'EXPIRING' } }),
      ]);
      return { expired: expired.data || [], expiring: expiring.data || [] };
    },
    refetchInterval: 60000,
  });
  const expired = Array.isArray(data?.expired) ? data.expired : [];
  const expiring = Array.isArray(data?.expiring) ? data.expiring : [];
  if (!expired.length && !expiring.length && !isFetching) return null;
  return (
    <section className={`rounded-2xl border border-amber-200 bg-white shadow-sm ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><CalendarClock size={18} className="text-amber-600" /> Expiry alerts <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{expired.length + expiring.length}</span></h2>
        <button type="button" onClick={() => refetch()} aria-label="Refresh expiry alerts" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} /></button>
      </div>
      {isFetching && !data ? <p className="mt-3 text-xs text-slate-500">Checking medicine expiry…</p> : (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {[['Expired', expired, 'text-rose-700 bg-rose-50'], ['Expiring within 6 months', expiring, 'text-amber-800 bg-amber-50']].map(([title, medicines, color]) => (
            <div key={title} className="min-w-0">
              <h3 className={`mb-2 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold ${color}`}><AlertTriangle size={13} />{title} ({medicines.length})</h3>
              {!medicines.length ? <p className="px-2 text-xs text-slate-500">None</p> : (
                <div className="max-h-56 space-y-1 overflow-auto">
                  {medicines.slice(0, 100).map((medicine) => <div key={medicine._id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-2 py-2 text-xs"><span className="min-w-0 truncate font-semibold text-slate-800">{medicine.name}</span><span className="text-slate-500">Stock: {medicine.quantity}</span><span className="text-slate-500">Expiry: {dateText(medicine.expiryDate)}</span></div>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
