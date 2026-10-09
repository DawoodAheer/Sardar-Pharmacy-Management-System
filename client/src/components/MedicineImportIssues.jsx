import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, RefreshCw, Wrench } from 'lucide-react';
import api from '../utils/api';

const fields = [
  ['name', 'Medicine name', 'text'], ['genericName', 'Generic name', 'text'],
  ['manufacturer', 'Manufacturer', 'text'], ['supplierName', 'Supplier name', 'text'],
  ['supplierPhone', 'Supplier phone', 'tel'], ['expiryDate', 'Expiry date', 'date'],
  ['purchasePrice', 'Purchase price per pack', 'number'], ['unitsPerPack', 'Units per pack', 'number'],
  ['price', 'Sale price per unit', 'number'], ['quantity', 'Stock quantity (units)', 'number'],
  ['reorderLevel', 'Reorder level', 'number'], ['category', 'Category', 'text'],
  ['barcode', 'Barcode', 'text'], ['rackLocation', 'Rack / shelf', 'text'],
];

const toFormValue = (value) => {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) return String(value).slice(0, 10);
  return String(value);
};

export default function MedicineImportIssues({ compact = false }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [message, setMessage] = useState('');
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['medicineImportIssues'],
    queryFn: async () => (await api.get('/medicines/import-issues')).data?.issues || [],
    refetchInterval: 15000,
  });
  const resolveMutation = useMutation({
    mutationFn: async ({ id, medicine }) => (await api.post(`/medicines/import-issues/${id}/resolve`, medicine)).data,
    onSuccess: async (result) => {
      setMessage(result.message);
      setEditing(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['medicineImportIssues'] }),
        queryClient.invalidateQueries({ queryKey: ['medicines'] }),
        queryClient.invalidateQueries({ queryKey: ['superadminMedicines'] }),
      ]);
    },
    onError: (error) => setMessage(error?.response?.data?.message || 'Unable to add the corrected medicine.'),
  });
  const issues = Array.isArray(data) ? data : [];
  if (!issues.length && !editing && !message) return null;

  const beginFix = (issue) => {
    const original = issue.originalRow || {};
    const imported = issue.normalizedRow || {};
    const pick = (normalizedKey, keys) => {
      if (imported[normalizedKey] !== undefined && imported[normalizedKey] !== null) return imported[normalizedKey];
      for (const key of keys) if (original[key] !== undefined && original[key] !== '') return original[key];
      return '';
    };
    setForm({
      name: pick('name', ['name', 'Name', 'Medicine Name']),
      genericName: pick('genericName', ['genericName', 'Generic Name']),
      manufacturer: pick('manufacturer', ['manufacturer', 'Manufacturer', 'Manufacture Company']),
      supplierName: pick('supplierName', ['supplierName', 'Supplier Name', 'Supplier']),
      supplierPhone: pick('supplierPhone', ['supplierPhone', 'Supplier Phone', 'Supplier Contact']),
      expiryDate: toFormValue(pick('expiryDate', ['expiryDate', 'Expiry Date'])),
      purchasePrice: pick('purchasePrice', ['purchasePrice', 'Purchase Price', 'Purchase Pack Cost']),
      unitsPerPack: pick('unitsPerPack', ['unitsPerPack', 'Units Per Pack']) || '1',
      price: pick('price', ['price', 'Sale Price', 'Sale Price / Unit']),
      quantity: pick('quantity', ['quantity', 'Quantity', 'Quantity (Units)']),
      reorderLevel: pick('reorderLevel', ['reorderLevel', 'Reorder Level']) ?? '10',
      category: pick('category', ['category', 'Category']) || 'Antibiotic',
      barcode: pick('barcode', ['barcode', 'Barcode']),
      rackLocation: pick('rackLocation', ['rackLocation', 'Rack', 'Rack Location']),
      labelImageUrl: pick('labelImageUrl', ['labelImageUrl', 'Label Image URL']),
    });
    setEditing(issue);
    setMessage('');
  };

  return (
    <section className={`rounded-xl border border-amber-200 bg-amber-50 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
          <AlertTriangle size={17} /> Medicine rows needing review <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs">{issues.length}</span>
        </div>
        <button type="button" onClick={() => refetch()} disabled={isFetching} className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-900 disabled:opacity-60">
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>
      {message && <p role="status" className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald-800"><CheckCircle size={14} />{message}</p>}
      {!issues.length && !editing ? <p className="mt-2 text-xs text-amber-800">No unresolved import rows.</p> : (
        <div className="mt-3 space-y-2">
          {issues.map((issue) => (
            <div key={issue._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white p-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-800">Row {issue.rowNumber}: {issue.originalRow?.['Medicine Name'] || issue.originalRow?.name || issue.originalRow?.Name || 'Medicine details need correction'}</p>
                <p className="text-[11px] text-slate-500">{issue.sourceFile || 'Bulk/Excel import'} · added by {issue.createdBy?.name || 'staff'}</p>
                <ul className="mt-1 list-inside list-disc text-[11px] text-rose-700">{(issue.validationErrors || []).map((error, index) => <li key={index}>{error}</li>)}</ul>
              </div>
              <button type="button" onClick={() => beginFix(issue)} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white"><Wrench size={13} /> Fix & add</button>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <form onSubmit={(event) => { event.preventDefault(); resolveMutation.mutate({ id: editing._id, medicine: form }); }} className="mt-4 rounded-xl border border-amber-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold text-slate-900">Correct row {editing.rowNumber}, then add it</h3><button type="button" onClick={() => setEditing(null)} className="text-xs font-semibold text-slate-500">Cancel</button></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map(([key, label, type]) => <label key={key} className="flex flex-col gap-1 text-xs font-semibold text-slate-600">{label}<input required={!['genericName', 'reorderLevel', 'category', 'barcode', 'rackLocation'].includes(key)} type={type} min={type === 'number' ? (key === 'quantity' || key === 'reorderLevel' ? '0' : '0.01') : undefined} step={type === 'number' ? (['unitsPerPack', 'quantity', 'reorderLevel'].includes(key) ? '1' : '0.01') : undefined} value={form[key] ?? ''} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>)}
          </div>
          <button type="submit" disabled={resolveMutation.isPending} className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{resolveMutation.isPending ? 'Validating…' : 'Validate & add medicine'}</button>
        </form>
      )}
    </section>
  );
}
