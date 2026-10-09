import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, RefreshCw } from 'lucide-react';
import api from '../utils/api';

const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const money = (value) => `PKR ${Number(value || 0).toFixed(2)}`;

export default function DailyClosingReport({ compact = false }) {
  const [date, setDate] = useState(today);
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['dailyClosingReport', date],
    queryFn: async () => (await api.get('/bills/daily-closing', { params: { date } })).data,
  });
  return <section className={`rounded-2xl border border-emerald-200 bg-white shadow-sm ${compact ? 'p-4' : 'p-5'}`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><CalendarCheck size={17} className="text-emerald-700" /> Daily closing & payment reconciliation</h2><div className="flex items-center gap-2"><input aria-label="Closing report date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs" /><button type="button" onClick={() => refetch()} aria-label="Refresh daily closing report" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} /></button></div></div>
    {!data ? <p className="mt-3 text-xs text-slate-500">{isFetching ? 'Loading report…' : 'Report unavailable.'}</p> : <><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-lg bg-emerald-50 p-3"><p className="text-[10px] text-slate-500">Cash bills</p><strong className="text-sm text-slate-900">{money(data.salesByMethod?.Cash)}</strong></div><div className="rounded-lg bg-blue-50 p-3"><p className="text-[10px] text-slate-500">Card bills</p><strong className="text-sm text-slate-900">{money(data.salesByMethod?.Card)}</strong></div><div className="rounded-lg bg-violet-50 p-3"><p className="text-[10px] text-slate-500">Online / UPI</p><strong className="text-sm text-slate-900">{money(data.salesByMethod?.Online)}</strong></div><div className="rounded-lg bg-rose-50 p-3"><p className="text-[10px] text-slate-500">Refunds</p><strong className="text-sm text-slate-900">− {money(data.refunds)}</strong></div></div><div className="mt-3 flex flex-wrap justify-between gap-2 border-t pt-3 text-xs"><span>Udhar given: <strong>{money(data.udharCreditIssued)}</strong></span><span>Udhar recovered: <strong>{money(data.udharRecovered)}</strong></span><span>Net collections: <strong className="text-emerald-700">{money(data.netCollections)}</strong></span></div><p className="mt-2 text-[10px] text-slate-500">{data.billCount} bills · {data.udharEntries} udhar entries · {data.udharPayments} udhar payments</p></>}</section>;
}
