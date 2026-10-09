import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarCheck, RefreshCw, CreditCard, Banknote, Smartphone,
  RotateCcw, TrendingUp, Loader2,
} from 'lucide-react';
import api from '../utils/api';

const todayStr = () => {
  const d = new Date();
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
};

const money = (v) =>
  'PKR ' +
  Number(v || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function DailyClosingReport({ compact = false }) {
  const [date, setDate] = useState(todayStr);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['dailyClosingReport', date],
    queryFn: async () =>
      (await api.get('/bills/daily-closing', { params: { date } })).data,
  });

  const sections = data
    ? [
        {
          label: 'Cash Sales',
          value: data.salesByMethod?.Cash,
          icon: Banknote,
          color: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/40',
          valueColor: 'text-emerald-700 dark:text-emerald-400',
          iconColor: 'text-emerald-600',
        },
        {
          label: 'Card Sales',
          value: data.salesByMethod?.Card,
          icon: CreditCard,
          color: 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/40',
          valueColor: 'text-blue-700 dark:text-blue-400',
          iconColor: 'text-blue-600',
        },
        {
          label: 'Online / UPI',
          value: data.salesByMethod?.Online,
          icon: Smartphone,
          color: 'bg-violet-50 border-violet-200 dark:bg-violet-950/20 dark:border-violet-800/40',
          valueColor: 'text-violet-700 dark:text-violet-400',
          iconColor: 'text-violet-600',
        },
        {
          label: 'Refunds',
          value: data.refunds,
          icon: RotateCcw,
          color: 'bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-800/40',
          valueColor: 'text-rose-600 dark:text-rose-400',
          iconColor: 'text-rose-500',
          negative: true,
        },
      ]
    : [];

  return (
    <section className="rounded-2xl border border-emerald-200 bg-white shadow-sm dark:border-emerald-900/50 dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50/70 px-5 py-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600">
            <CalendarCheck size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Daily Closing Report</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Cash, card, online, refunds, udhar &amp; net reconciliation
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            aria-label="Closing report date"
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-emerald-700 dark:bg-slate-800 dark:text-white"
          />
          <button
            type="button" onClick={() => refetch()} aria-label="Refresh daily report"
            className="rounded-lg p-2 text-slate-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
          >
            <RefreshCw size={15} className={isFetching ? 'animate-spin text-emerald-600' : ''} />
          </button>
        </div>
      </div>

      <div className="p-5">
        {isFetching && !data ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 size={14} className="animate-spin" /> Loading report…
          </div>
        ) : !data ? (
          <p className="text-xs text-slate-500">No report data available for this date.</p>
        ) : (
          <div className="space-y-4">
            {/* Payment Method Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {sections.map(({ label, value, icon: Icon, color, valueColor, iconColor, negative }) => (
                <div key={label} className={'rounded-xl border p-3.5 ' + color}>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {label}
                    </p>
                    <Icon size={14} className={iconColor} />
                  </div>
                  <p className={'mt-1.5 text-sm font-bold ' + valueColor}>
                    {negative && value > 0 ? '− ' : ''}
                    {money(value)}
                  </p>
                </div>
              ))}
            </div>

            {/* Udhar & Net Row */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-800/40">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Udhar Given
                </p>
                <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-300">
                  {money(data.udharCreditIssued)}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">{data.udharEntries} entries</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-800/40">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Udhar Recovered
                </p>
                <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-300">
                  {money(data.udharRecovered)}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">{data.udharPayments} payments</p>
              </div>

              <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 dark:border-emerald-700 dark:bg-emerald-950/30">
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={13} className="text-emerald-600" />
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    Net Collections
                  </p>
                </div>
                <p className="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  {money(data.netCollections)}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">{data.billCount} bills</p>
              </div>
            </div>

            {/* Gross Summary Line */}
            <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-100 pt-3 text-[11px] dark:border-slate-800">
              <span className="text-slate-500">
                Gross Sales:{' '}
                <strong className="text-slate-700 dark:text-slate-300">{money(data.grossSales)}</strong>
              </span>
              <span className="text-slate-500">
                Refunds:{' '}
                <strong className="text-rose-600">− {money(data.refunds)}</strong>
              </span>
              <span className="text-slate-500">
                Net Sales:{' '}
                <strong className="text-slate-700 dark:text-slate-300">{money(data.netSalesAfterRefunds)}</strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
