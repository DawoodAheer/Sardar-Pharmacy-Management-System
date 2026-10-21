import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { waitForJob } from '../utils/backgroundJobs';
import PageControls from './PageControls';

const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const money = value => `PKR ${Number(value || 0).toLocaleString('en-PK',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export default function SalesPeriodReport() {
  const [open,setOpen]=useState(false);
  return <section className="my-4 rounded-xl border border-teal-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><button type="button" onClick={()=>setOpen(!open)} aria-expanded={open} className="w-full text-left font-bold text-teal-800 dark:text-teal-200">Sales history / Yearly Excel report {open?'▴':'▾'}</button>{open && <Report />}</section>;
}
function Report() {
  const current=today(), year=Number(current.slice(0,4));
  const [startDate,setStart]=useState(`${year}-01-01`),[endDate,setEnd]=useState(current),[page,setPage]=useState(1);
  const [exporting,setExporting]=useState(false),[message,setMessage]=useState('');
  const valid=Boolean(startDate && endDate && startDate<=endDate);
  const {data,error,isFetching}=useQuery({queryKey:['sales-period',startDate,endDate,page],enabled:valid,queryFn:async()=>(await api.get('/bills/sales-period',{params:{startDate,endDate,page}})).data});
  const priorYearDate = current.slice(5) === '02-29' ? `${year-1}-02-28` : `${year-1}-${current.slice(5)}`;
  const range=(start,end)=>{setStart(start);setEnd(end);setPage(1);};
  const download=async()=>{setExporting(true);setMessage('');try {
    const job=await waitForJob((await api.post('/jobs/sales-export',{startDate,endDate})).data);
    const {data:blob}=await api.get(`/jobs/${job.jobId}/download`,{responseType:'blob'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`Sales_${startDate}_to_${endDate}.xlsx`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setMessage('Excel downloaded with all bills and monthly totals for this date range.');
  }catch(err){setMessage(err.response?.data?.message || err.message || 'Export failed. Please retry.');}finally{setExporting(false);}};
  const input='mt-1 w-full rounded-sm border border-slate-300 bg-transparent p-2 text-sm dark:border-slate-600';
  return <div className="mt-4 space-y-4"><div className="flex flex-wrap gap-2"><button type="button" className="rounded-sm border px-3 py-1 text-sm" onClick={()=>range(`${year}-01-01`,current)}>This year</button><button type="button" className="rounded-sm border px-3 py-1 text-sm" onClick={()=>range(`${year-1}-01-01`,`${year-1}-12-31`)}>Previous year</button><button type="button" className="rounded-sm border px-3 py-1 text-sm" onClick={()=>range(priorYearDate,current)}>Last 12 months</button></div>
    <div className="grid items-end gap-3 sm:grid-cols-3"><label className="text-sm">From (inclusive)<input aria-label="Sales report start date" type="date" value={startDate} onChange={e=>{setStart(e.target.value);setPage(1);}} className={input}/></label><label className="text-sm">To (inclusive)<input aria-label="Sales report end date" type="date" value={endDate} onChange={e=>{setEnd(e.target.value);setPage(1);}} className={input}/></label><button type="button" onClick={download} disabled={!valid || exporting} className="rounded-sm bg-teal-700 px-4 py-2 font-bold text-white disabled:opacity-50">{exporting?'Preparing Excel…':'Download all sales (.xlsx)'}</button></div>
    <p className="text-xs text-slate-500">Sales made in the selected period, less all recorded refunds on those bills. Pakistan time; online sales count when accepted. This is revenue, not cash collected.</p>
    {!valid && <p role="alert" className="text-red-600">Choose a valid start and end date.</p>}{(message || error) && <p role="status" className="text-sm">{message || error?.response?.data?.message || 'Could not load sales.'}</p>}
    {isFetching && <p role="status">Loading sales…</p>}
    {valid && data && <><div className="grid gap-2 sm:grid-cols-3">{[['Bills',data.totals.billCount],['Gross sales',money(data.totals.grossSales)],['Discounts',money(data.totals.discount)],['Billed sales',money(data.totals.billedSales)],['Refunds on these bills',money(data.totals.refunds)],['Net sales',money(data.totals.netSales)]].map(([label,value])=><div key={label} className="rounded-sm border p-3"><p className="text-xs text-slate-500">{label}</p><strong>{value}</strong></div>)}</div>
    <details><summary className="cursor-pointer font-semibold">Monthly totals ({data.monthly.length} months with sales)</summary><div className="max-h-60 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Month</th><th>Bills</th><th>Billed</th><th>Refunds</th><th>Net sales</th></tr></thead><tbody>{data.monthly.map(month=><tr className="border-t" key={month._id}><td className="p-2">{month._id}</td><td>{month.billCount}</td><td>{money(month.billedSales)}</td><td>{money(month.refunds)}</td><td>{money(month.netSales)}</td></tr>)}</tbody></table></div></details>
    <PageControls page={page} pages={data.pages || 1} total={data.total} onChange={setPage}/><div className="max-h-80 overflow-auto"><table className="w-full whitespace-nowrap text-left text-sm"><thead><tr><th className="p-2">Bill</th><th>Date</th><th>Payment</th><th>Billed</th><th>Refunds</th><th>Net sales</th></tr></thead><tbody>{data.rows.map(bill=><tr className="border-t" key={bill._id}><td className="p-2">{bill.billNumber}</td><td>{new Date(bill.saleDate).toLocaleDateString('en-GB',{timeZone:'Asia/Karachi'})}</td><td>{bill.paymentMethod}</td><td>{money(bill.total)}</td><td>{money(bill.refunded)}</td><td>{money(bill.netSales)}</td></tr>)}</tbody></table>{!data.rows.length && <p className="p-3 text-sm">No sales in this date range.</p>}</div></>}
  </div>;
}
