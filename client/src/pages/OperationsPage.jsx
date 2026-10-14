import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import useDebouncedValue from '../hooks/useDebouncedValue';
import PageControls from '../components/PageControls';

const money = value => `PKR ${Number(value || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dateText = value => value ? new Date(value).toLocaleDateString('en-PK') : '—';
const inputStyle = 'w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-800';
const buttonStyle = 'rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';

function Field({ label, ...props }) {
  return <label className="block text-sm"><span className="mb-1 block font-medium">{label}</span><input className={inputStyle} {...props} /></label>;
}
function Panel({ title, children }) {
  return <section className="rounded-xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><h2 className="mb-4 text-lg font-bold">{title}</h2>{children}</section>;
}
function useAction() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const mutation = useMutation({ mutationFn: async ({ url, data, method = 'post' }) => (await api[method](url, data, { timeout: 60000 })).data,
    onSuccess: async () => { setMessage('Saved successfully.'); await queryClient.invalidateQueries(); },
    onError: error => setMessage(error.response?.data?.message || 'Unable to save. Please retry.'),
  });
  return { mutation, message, setMessage };
}
function Feedback({ message, error }) {
  return (message || error) ? <p role="status" className="my-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-slate-900">{message || error?.response?.data?.message || 'Unable to load data. Try refreshing.'}</p> : null;
}

function BatchInventory() {
  const [search, setSearch] = useState(''), [page, setPage] = useState(1), [selected, setSelected] = useState(null);
  const debounced = useDebouncedValue(search);
  const { data, error, isFetching } = useQuery({ queryKey: ['operations', 'batches', debounced, page],
    queryFn: async () => (await api.get('/operations/batches', { params: { search: debounced, page, limit: 25 } })).data });
  const { mutation, message } = useAction();
  const [form, setForm] = useState({ batchNumber: '', quantity: '', purchaseCost: '', expiryDate: '' });
  return <div className="space-y-5"><Panel title="Batch inventory">
    <Field label="Find a medicine" type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />
    <p className="my-3 text-sm text-slate-500">Sales use the earliest unexpired batch. Purchase cost is per tablet or sellable unit.</p>
    <Feedback message={message} error={error} />
    {isFetching && <p role="status">Loading inventory…</p>}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Medicine / batch</th><th>Expiry</th><th>Units</th><th>Purchase / unit</th><th /></tr></thead><tbody>
      {(data?.medicines || []).map(medicine => <tr className="border-t align-top" key={medicine._id}><td className="p-2"><strong>{medicine.name}</strong>{medicine.batches.map(batch => <p key={batch._id}>{batch.batchNumber}</p>)}</td>
        <td className="pt-7">{medicine.batches.map(batch => <p key={batch._id} className={batch.expiryDate && new Date(batch.expiryDate) < new Date(new Date().setHours(0, 0, 0, 0)) ? 'text-red-600' : ''}>{dateText(batch.expiryDate)}</p>)}</td>
        <td className="pt-7">{medicine.batches.map(batch => <p key={batch._id}>{batch.quantity}</p>)}</td><td className="pt-7">{medicine.batches.map(batch => <p key={batch._id}>{money(batch.purchaseCost)}</p>)}</td>
        <td className="p-2"><button className={buttonStyle} onClick={() => { setSelected(medicine); setForm({ batchNumber: '', quantity: '', purchaseCost: '', expiryDate: '' }); }}>Receive batch</button></td></tr>)}
    </tbody></table></div>
    <PageControls page={page} pages={data?.pages || 1} total={data?.total} onChange={setPage} />
  </Panel>{selected && <Panel title={`Receive stock: ${selected.name}`}><form className="grid gap-4 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); mutation.mutate({ url: `/operations/batches/${selected._id}`, data: form }, { onSuccess: () => setSelected(null) }); }}>
    <Field label="Batch number" required value={form.batchNumber} onChange={e => setForm({ ...form, batchNumber: e.target.value })} />
    <Field label="Expiry date" required type="date" min={today()} value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} />
    <Field label="Quantity in units" required type="number" min="1" step="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
    <Field label="Purchase cost per unit (PKR)" required type="number" min="0" step="0.01" value={form.purchaseCost} onChange={e => setForm({ ...form, purchaseCost: e.target.value })} />
    <button disabled={mutation.isPending} className={buttonStyle}>Save batch</button><button type="button" onClick={() => setSelected(null)}>Cancel</button>
  </form></Panel>}</div>;
}

const blankLine = () => ({ medicineId: '', batchNumber: '', quantity: '', purchaseCost: '', expiryDate: '' });
function SupplierAccounts() {
  const { user } = useAuth();
  const isAdmin = user.role === 'superadmin';
  const [supplierPage, setSupplierPage] = useState(1), [supplierSearch, setSupplierSearch] = useState('');
  const supplierTerm = useDebouncedValue(supplierSearch);
  const { data: supplierData, error } = useQuery({ queryKey: ['operations', 'suppliers', supplierPage, supplierTerm], queryFn: async () => (await api.get('/operations/suppliers', { params: { page: supplierPage, search: supplierTerm, limit: 50 } })).data });
  const suppliers = supplierData?.suppliers || [];
  const [invoicePage, setInvoicePage] = useState(1);
  const { data: invoiceData } = useQuery({ queryKey: ['operations', 'purchases', invoicePage], queryFn: async () => (await api.get('/operations/purchases', { params: { page: invoicePage, limit: 25 } })).data });
  const invoices = invoiceData?.invoices || [];
  const [supplier, setSupplier] = useState({ name: '', phone: '', address: '' });
  const [purchase, setPurchase] = useState({ supplierId: '', invoiceNumber: '', dueDate: '', items: [blankLine()] });
  const [medicineSearch, setMedicineSearch] = useState('');
  const [selectedNames, setSelectedNames] = useState({});
  const debounced = useDebouncedValue(medicineSearch);
  const { data: inventory } = useQuery({ queryKey: ['operations', 'purchase-medicines', debounced], queryFn: async () => (await api.get('/operations/batches', { params: { search: debounced, limit: 100 } })).data });
  const [payment, setPayment] = useState({ id: '', amount: '', fromCashDrawer: false });
  const [returnForm, setReturnForm] = useState({ id: '', batchId: '', quantity: '', reason: '' });
  const { mutation, message } = useAction();
  const changeLine = (index, key, value) => setPurchase({ ...purchase, items: purchase.items.map((line, i) => i === index ? { ...line, [key]: value } : line) });
  return <div className="space-y-5"><Feedback message={message} error={error} />
    <Panel title="Suppliers"><Field label="Search suppliers" value={supplierSearch} onChange={e => { setSupplierSearch(e.target.value); setSupplierPage(1); }} /><PageControls page={supplierPage} pages={supplierData?.pages || 1} total={supplierData?.total || 0} onChange={setSupplierPage} /><div className="grid gap-3 sm:grid-cols-3">{suppliers.map(s => <div key={s._id} className="rounded-lg border p-3"><strong>{s.name}</strong><p>{s.phone}</p><p>Outstanding: {money(s.balance)}</p></div>)}</div>
      <form className="mt-4 grid gap-3 sm:grid-cols-4" onSubmit={e => { e.preventDefault(); mutation.mutate({ url: '/operations/suppliers', data: supplier }, { onSuccess: () => setSupplier({ name: '', phone: '', address: '' }) }); }}>
        {['name', 'phone', 'address'].map(key => <Field key={key} label={`Supplier ${key}`} required={key === 'name'} value={supplier[key]} onChange={e => setSupplier({ ...supplier, [key]: e.target.value })} />)}
        <button disabled={mutation.isPending} className={buttonStyle}>Add supplier</button>
      </form></Panel>
    <Panel title="Receive supplier invoice"><form className="space-y-4" onSubmit={e => { e.preventDefault(); mutation.mutate({ url: '/operations/purchases', data: purchase }, { onSuccess: () => setPurchase({ supplierId: '', invoiceNumber: '', dueDate: '', items: [blankLine()] }) }); }}>
      <div className="grid gap-3 sm:grid-cols-3"><label>Supplier<select required className={inputStyle} value={purchase.supplierId} onChange={e => setPurchase({ ...purchase, supplierId: e.target.value })}><option value="">Choose supplier</option>{suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}</select></label>
        <Field label="Supplier invoice number" required value={purchase.invoiceNumber} onChange={e => setPurchase({ ...purchase, invoiceNumber: e.target.value })} />
        <Field label="Payment due date" type="date" value={purchase.dueDate} onChange={e => setPurchase({ ...purchase, dueDate: e.target.value })} /></div>
      <Field label="Search medicines for purchase lines" type="search" value={medicineSearch} onChange={e => setMedicineSearch(e.target.value)} />
      {purchase.items.map((line, index) => <div key={index} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
        <label>Medicine<select required className={inputStyle} value={line.medicineId} onChange={e => { changeLine(index, 'medicineId', e.target.value); setSelectedNames({ ...selectedNames, [e.target.value]: inventory?.medicines.find(m => m._id === e.target.value)?.name }); }}><option value="">Choose medicine</option>
          {line.medicineId && !inventory?.medicines.some(m => m._id === line.medicineId) && <option value={line.medicineId}>{selectedNames[line.medicineId]}</option>}
          {(inventory?.medicines || []).map(m => <option key={m._id} value={m._id}>{m.name}</option>)}</select></label>
        <Field label="Batch number" required value={line.batchNumber} onChange={e => changeLine(index, 'batchNumber', e.target.value)} />
        <Field label="Expiry" type="date" min={today()} required value={line.expiryDate} onChange={e => changeLine(index, 'expiryDate', e.target.value)} />
        <Field label="Quantity in units" type="number" min="1" step="1" required value={line.quantity} onChange={e => changeLine(index, 'quantity', e.target.value)} />
        <Field label="Purchase cost / unit" type="number" min="0" step="0.01" required value={line.purchaseCost} onChange={e => changeLine(index, 'purchaseCost', e.target.value)} />
        {purchase.items.length > 1 && <button type="button" onClick={() => setPurchase({ ...purchase, items: purchase.items.filter((_, i) => index !== i) })}>Remove line</button>}
      </div>)}
      <div className="flex gap-3"><button type="button" disabled={purchase.items.length >= 100} onClick={() => setPurchase({ ...purchase, items: [...purchase.items, blankLine()] })} className="rounded-lg border px-3 py-2">Add line</button><button disabled={mutation.isPending} className={buttonStyle}>Receive invoice & stock</button></div>
    </form></Panel>
    <Panel title="Purchase invoices"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Invoice</th><th>Supplier</th><th>Due</th><th>Total</th><th>Paid</th><th>Return credit</th><th>Balance</th><th /></tr></thead><tbody>
      {invoices.map(invoice => <tr className="border-t" key={invoice._id}><td className="py-3">{invoice.invoiceNumber}</td><td>{invoice.supplierId?.name}</td><td>{dateText(invoice.dueDate)}</td><td>{money(invoice.total)}</td><td>{money(invoice.totalPaid)}</td><td>{money(invoice.returnCredit)}</td><td>{money(invoice.balance)}</td>
        <td>{isAdmin && <div className="flex gap-2"><button onClick={() => setPayment({ id: invoice._id, amount: '', fromCashDrawer: false })}>Pay</button><button onClick={() => setReturnForm({ id: invoice._id, batchId: '', quantity: '', reason: '' })}>Return stock</button></div>}</td></tr>)}
    </tbody></table></div><PageControls page={invoicePage} pages={invoiceData?.pages || 1} total={invoiceData?.total} onChange={setInvoicePage} /></Panel>
    {payment.id && <Panel title="Supplier payment"><form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); mutation.mutate({ url: `/operations/purchases/${payment.id}/pay`, data: { amount: payment.amount, fromCashDrawer: payment.fromCashDrawer } }, { onSuccess: () => setPayment({ id: '', amount: '' }) }); }}><Field label="Amount (PKR)" required type="number" min="0.01" step="0.01" value={payment.amount} onChange={e => setPayment({ ...payment, amount: e.target.value })} /><label className="flex gap-2"><input type="checkbox" checked={payment.fromCashDrawer || false} onChange={e => setPayment({ ...payment, fromCashDrawer: e.target.checked })} />Paid from cash drawer (records expense)</label><button disabled={mutation.isPending} className={buttonStyle}>Record payment</button><button type="button" onClick={() => setPayment({ id: '', amount: '' })}>Cancel</button></form></Panel>}
    {returnForm.id && <Panel title="Supplier return"><p className="mb-3 text-sm">Return credit reduces the supplier balance. A negative balance means the supplier owes you credit or a refund.</p><form className="grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); mutation.mutate({ url: `/operations/purchases/${returnForm.id}/return`, data: returnForm }, { onSuccess: () => setReturnForm({ id: '', batchId: '', quantity: '', reason: '' }) }); }}>
      <label>Batch<select required className={inputStyle} value={returnForm.batchId} onChange={e => setReturnForm({ ...returnForm, batchId: e.target.value })}><option value="">Choose purchased batch</option>{invoices.find(i => i._id === returnForm.id)?.items.map(line => <option key={line.batchId} value={line.batchId}>{line.medicineName} — {line.batchNumber}</option>)}</select></label>
      <Field label="Return quantity" type="number" required min="1" step="1" value={returnForm.quantity} onChange={e => setReturnForm({ ...returnForm, quantity: e.target.value })} />
      <Field label="Reason" required value={returnForm.reason} onChange={e => setReturnForm({ ...returnForm, reason: e.target.value })} /><button disabled={mutation.isPending} className={buttonStyle}>Return stock & credit invoice</button><button type="button" onClick={() => setReturnForm({ id: '', batchId: '', quantity: '', reason: '' })}>Cancel</button>
    </form></Panel>}
  </div>;
}

function CreditStatements() {
  const [overdue, setOverdue] = useState(false), [page, setPage] = useState(1), [selected, setSelected] = useState(''), [due, setDue] = useState('');
  const { data, error } = useQuery({ queryKey: ['operations', 'credit', overdue, page], queryFn: async () => (await api.get('/udhar', { params: { overdue, page, limit: 25 } })).data });
  const { data: statement } = useQuery({ queryKey: ['operations', 'statement', selected], enabled: Boolean(selected), queryFn: async () => (await api.get(`/operations/credit/${selected}/statement`)).data });
  const { mutation, message } = useAction();
  const [receipt, setReceipt] = useState(null);
  return <div className="space-y-5"><Panel title="Credit accounts"><Link className="text-teal-700 underline" to="/udhar">Open Udhar payments & accounts</Link>
    <label className="my-3 flex gap-2"><input type="checkbox" checked={overdue} onChange={e => { setOverdue(e.target.checked); setPage(1); }} />Show overdue accounts only</label><Feedback message={message} error={error} />
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Customer</th><th>Due date</th><th>Remaining</th><th /></tr></thead><tbody>{data?.records.map(record => <tr key={record._id} className="border-t"><td className="py-3">{record.customerName}</td><td>{dateText(record.dueDate)}</td><td>{money(record.remainingAmount)}</td><td><button onClick={() => { setSelected(record._id); setReceipt(null); setDue(record.dueDate?.slice(0, 10) || ''); }} className={buttonStyle}>Statement</button></td></tr>)}</tbody></table></div>
    <PageControls page={page} pages={data?.pages || 1} total={data?.total} onChange={setPage} />
  </Panel>{statement && <><div className="flex flex-wrap items-end gap-3 print:hidden"><Field label="Due date" type="date" value={due} onChange={e => setDue(e.target.value)} /><button disabled={mutation.isPending} className={buttonStyle} onClick={() => mutation.mutate({ url: `/operations/credit/${selected}/due-date`, method: 'patch', data: { dueDate: due } })}>Save due date</button><button className={buttonStyle} onClick={() => { setReceipt(null); setTimeout(() => window.print(), 0); }}>Print statement</button></div>
    <div className="credit-print"><Panel title={receipt ? 'Payment receipt' : 'Customer statement'}><h3 className="font-bold">Sardar Medical Store · {statement.customer.name}</h3><p>{statement.customer.phone}</p><p>Due: {dateText(statement.dueDate)} · Remaining: {money(statement.remaining)}</p>
      {receipt ? <div className="my-4"><p>Receipt: {receipt.receiptId}</p><p>Date: {dateText(receipt.date)}</p><p>Payment: {money(receipt.credit)}</p><p>Balance after payment: {money(receipt.balance)}</p></div> : <table className="my-4 w-full text-left text-sm"><thead><tr><th>Date</th><th>Description</th><th>Charges</th><th>Payments</th><th>Balance</th><th className="print:hidden" /></tr></thead><tbody>{statement.entries.map((entry, index) => <tr key={index} className="border-t"><td className="py-2">{dateText(entry.date)}</td><td>{entry.description}</td><td>{money(entry.debit)}</td><td>{money(entry.credit)}</td><td>{money(entry.balance)}</td><td className="print:hidden">{entry.receiptId && <button onClick={() => { setReceipt(entry); setTimeout(() => window.print(), 0); }}>Print receipt</button>}</td></tr>)}</tbody></table>}
      {receipt && <button className="print:hidden" onClick={() => setReceipt(null)}>Back to statement</button>}
    </Panel></div></>}</div>;
}

function CashReconciliation() {
  const { user } = useAuth(), isAdmin = user.role === 'superadmin';
  const [date, setDate] = useState(today), [opening, setOpening] = useState(''), [counted, setCounted] = useState(''), [expense, setExpense] = useState({ amount: '', reason: '' });
  const { data, error } = useQuery({ queryKey: ['operations', 'cash', date], queryFn: async () => (await api.get('/operations/cash', { params: { date } })).data });
  const { mutation, message } = useAction();
  return <div className="space-y-5"><Panel title="Cash reconciliation"><Field label="Business date" type="date" value={date} onChange={e => { setDate(e.target.value); setOpening(''); setCounted(''); }} /><Feedback message={message} error={error} />
    <div className="my-5 grid gap-3 sm:grid-cols-3">{[['Opening cash', data?.openingCash], ['Cash sales', data?.cashSales], ['Credit recovered', data?.creditRecovered], ['Cash refunds', data?.cashRefunds], ['Expenses', data?.totalExpenses], ['Expected cash', data?.expectedCash], ['Counted cash', data?.countedCash], ['Difference', data?.discrepancy]].map(([label, value]) => <div className="rounded-lg border p-3" key={label}><p className="text-sm">{label}</p><strong>{value === null ? 'Not counted' : money(value)}</strong></div>)}</div>
    <p className="mb-4 text-sm text-slate-500">Supplier payments marked “Paid from cash drawer” are included automatically. Record other drawer expenses below.</p>
    {isAdmin && <form className="grid items-end gap-3 sm:grid-cols-3" onSubmit={e => { e.preventDefault(); mutation.mutate({ url: '/operations/cash', data: { date, openingCash: opening === '' ? data?.openingCash || 0 : opening, countedCash: counted === '' ? data?.countedCash ?? null : counted } }); }}>
      <Field label="Opening cash (PKR)" type="number" min="0" step="0.01" placeholder={String(data?.openingCash || 0)} value={opening} onChange={e => setOpening(e.target.value)} />
      <Field label="Counted cash (PKR)" type="number" min="0" step="0.01" placeholder={data?.countedCash === null ? 'Not counted' : String(data?.countedCash || 0)} value={counted} onChange={e => setCounted(e.target.value)} />
      <button disabled={mutation.isPending} className={buttonStyle}>Save count</button>
    </form>}
  </Panel><Panel title="Expenses"><ul className="mb-4 space-y-2">{data?.expenses.map(item => <li className="flex justify-between border-b py-2" key={item._id}><span>{item.reason}</span><strong>{money(item.amount)}</strong></li>)}</ul>
    {isAdmin && <form className="grid items-end gap-3 sm:grid-cols-3" onSubmit={e => { e.preventDefault(); mutation.mutate({ url: '/operations/cash', data: { date, expense } }, { onSuccess: () => setExpense({ amount: '', reason: '' }) }); }}>
      <Field label="Expense reason" required value={expense.reason} onChange={e => setExpense({ ...expense, reason: e.target.value })} />
      <Field label="Expense amount (PKR)" required type="number" min="0.01" step="0.01" value={expense.amount} onChange={e => setExpense({ ...expense, amount: e.target.value })} /><button disabled={mutation.isPending} className={buttonStyle}>Add expense</button>
    </form>}
  </Panel></div>;
}

export default function OperationsPage() {
  const [tab, setTab] = useState('batches');
  return <div className="operations-page space-y-6 p-4 text-slate-900 dark:text-slate-100 sm:p-7">
    <div className="print:hidden"><h1 className="text-2xl font-bold">Stock & accounts</h1><p className="mt-1 text-slate-500">Manage deliveries, suppliers, customer credit and your cash drawer.</p>
      <Link to="/pharmacist" className="mt-2 inline-block text-teal-700 underline">Back to inventory & billing</Link></div>
    <nav aria-label="Operations" className="flex flex-wrap gap-2 print:hidden">{[['batches', 'Batch inventory'], ['suppliers', 'Supplier accounts'], ['credit', 'Credit statements'], ['cash', 'Cash reconciliation']].map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={tab === id ? buttonStyle : 'rounded-lg border px-4 py-2 text-sm'}>{label}</button>)}</nav>
    {tab === 'batches' && <BatchInventory />}{tab === 'suppliers' && <SupplierAccounts />}{tab === 'credit' && <CreditStatements />}{tab === 'cash' && <CashReconciliation />}
    <SystemStatus />
    <style>{`@media print { body * { visibility:hidden; } .credit-print, .credit-print * { visibility:visible; } .credit-print { position:absolute; left:0; top:0; width:100%; } .print\\:hidden { display:none !important; } }`}</style>
  </div>;
}

function SystemStatus() {
  const { user } = useAuth();
  const { data, error } = useQuery({ queryKey: ['operations', 'system'], queryFn: async () => (await api.get('/operations/system')).data, enabled: user.role === 'superadmin', refetchInterval: 30000 });
  if (user.role !== 'superadmin') return null;
  const size = value => value == null ? 'Unavailable' : `${(value / 1024 ** 3).toFixed(2)} GB`;
  return <Panel title="Server health"><Feedback error={error} />{data && <><div className="grid gap-3 sm:grid-cols-3"><p>Free disk: {size(data.freeDiskBytes)}</p><p>Free memory: {size(data.freeMemoryBytes)}</p><p>API memory: {size(data.apiMemoryBytes)}</p><p>Database: {data.databaseConnected ? 'Connected' : 'Disconnected'}</p><p>Event loop delay: {data.eventLoopP99Ms} ms</p><p>Server errors since restart: {data.failures}</p></div>{data.warnings.map(warning => <p className="mt-2 text-red-600" key={warning}>{warning}</p>)}<p className="mt-3 text-sm">Background tasks: {data.jobs.map(job => `${job._id}: ${job.count}`).join(' · ') || 'None'}</p></>}</Panel>;
}
