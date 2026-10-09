import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, CheckCircle2, RefreshCw, Wrench, Eye, XCircle, CheckCheck,
} from 'lucide-react';
import api from '../utils/api';

const FIELDS = [
  ['name', 'Medicine name', 'text'],
  ['manufacturer', 'Manufacturer', 'text'],
  ['expiryDate', 'Expiry date', 'date'],
  ['purchasePrice', 'Purchase price / pack', 'number'],
  ['unitsPerPack', 'Units per pack', 'number'],
  ['price', 'Sale price / unit', 'number'],
  ['quantity', 'Stock quantity (units)', 'number'],
  ['rackLocation', 'Rack / shelf', 'text'],
];

const OPTIONAL = [
  'rackLocation'
];

const toFormVal = (v) => {
  if (!v) return '';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
};

function PreviewRow({ row }) {
  const hasErrors = Array.isArray(row.errors) && row.errors.length > 0;
  return (
    <div
      className={
        'flex flex-wrap items-start justify-between gap-2 rounded-lg border p-2.5 ' +
        (hasErrors
          ? 'border-rose-200 bg-rose-50 dark:border-rose-800/40 dark:bg-rose-950/20'
          : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-950/10')
      }
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {hasErrors ? (
            <XCircle size={12} className="text-rose-500" />
          ) : (
            <CheckCircle2 size={12} className="text-emerald-600" />
          )}
          <span className="text-xs font-semibold text-slate-800 dark:text-white">
            Row {row.rowNumber}: {row.medicine?.name || '—'}
          </span>
        </div>
        {hasErrors && (
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-[10px] text-rose-700 dark:text-rose-400">
            {row.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
        {!hasErrors && (
          <p className="mt-0.5 text-[10px] text-slate-500">
            {row.medicine?.manufacturer} · Qty {row.medicine?.quantity}
            {row.medicine?.expiryDate
              ? ' · Exp ' + new Date(row.medicine.expiryDate).toLocaleDateString('en-PK')
              : ''}
          </p>
        )}
      </div>
    </div>
  );
}

export default function MedicineImportIssues({ compact = false }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState('');

  // Import Preview state
  const [previewData, setPreviewData] = useState(null);
  const [previewFile, setPreviewFile] = useState('');
  const [bulkPayload, setBulkPayload] = useState(null);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['medicineImportIssues'],
    queryFn: async () => (await api.get('/medicines/import-issues')).data?.issues || [],
    refetchInterval: 15000,
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, medicine }) =>
      (await api.post('/medicines/import-issues/' + id + '/resolve', medicine)).data,
    onSuccess: async (r) => {
      setMsg(r.message);
      setEditing(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['medicineImportIssues'] }),
        queryClient.invalidateQueries({ queryKey: ['medicines'] }),
        queryClient.invalidateQueries({ queryKey: ['superadminMedicines'] }),
      ]);
    },
    onError: (e) => setMsg(e?.response?.data?.message || 'Unable to add the corrected medicine.'),
  });

  const confirmImportMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post('/medicines/bulk', {
          medicines: bulkPayload,
          sourceFile: previewFile,
        })
      ).data,
    onSuccess: async (r) => {
      setMsg(
        'Imported ' +
          (r.insertedCount || 0) +
          ' medicines. Skipped ' +
          (r.skippedCount || 0) +
          '. Invalid rows saved for review.'
      );
      setPreviewData(null);
      setBulkPayload(null);
      setPreviewFile('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['medicines'] }),
        queryClient.invalidateQueries({ queryKey: ['medicineImportIssues'] }),
        queryClient.invalidateQueries({ queryKey: ['superadminMedicines'] }),
      ]);
    },
    onError: (e) => setMsg(e?.response?.data?.message || 'Import failed.'),
  });

  const issues = Array.isArray(data) ? data : [];

  const beginFix = (issue) => {
    const orig = issue.originalRow || {};
    const imp = issue.normalizedRow || {};
    const pick = (key, keys) => {
      if (imp[key] !== undefined && imp[key] !== null) return imp[key];
      for (const k of keys) if (orig[k] !== undefined && orig[k] !== '') return orig[k];
      return '';
    };
    setForm({
      name: pick('name', ['name', 'Name', 'Medicine Name']),
      manufacturer: pick('manufacturer', ['manufacturer', 'Manufacturer', 'Manufacture Company']),
      expiryDate: toFormVal(pick('expiryDate', ['expiryDate', 'Expiry Date'])),
      purchasePrice: pick('purchasePrice', ['purchasePrice', 'Purchase Price']),
      unitsPerPack: pick('unitsPerPack', ['unitsPerPack', 'Units Per Pack']) || '1',
      price: pick('price', ['price', 'Sale Price']),
      quantity: pick('quantity', ['quantity', 'Quantity']),
      rackLocation: pick('rackLocation', ['rackLocation', 'Rack Location']),
    });
    setEditing(issue);
    setMsg('');
  };

  if (!issues.length && !editing && !msg && !previewData) return null;

  const validCount = previewData ? previewData.rows.filter((r) => !r.errors?.length).length : 0;
  const invalidCount = previewData ? previewData.rows.filter((r) => r.errors?.length > 0).length : 0;

  // ── Import Preview Panel ────────────────────────────────
  if (previewData) {
    return (
      <section className="rounded-xl border border-indigo-200 bg-indigo-50 dark:border-slate-700 dark:bg-slate-900 overflow-hidden">
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-indigo-900 dark:text-indigo-200">
              <Eye size={16} /> Import Preview — {previewFile}
            </div>
            <button
              type="button"
              onClick={() => { setPreviewData(null); setBulkPayload(null); setPreviewFile(''); }}
              className="text-xs font-semibold text-slate-500 hover:text-rose-600"
            >
              Discard
            </button>
          </div>

          <div className="flex flex-wrap gap-3 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              <CheckCircle2 size={12} /> {validCount} valid rows
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 font-bold text-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
              <XCircle size={12} /> {invalidCount} rows with errors
            </span>
          </div>

          <div className="max-h-64 space-y-1.5 overflow-auto">
            {previewData.rows.map((row, i) => (
              <PreviewRow key={i} row={row} />
            ))}
          </div>

          {validCount > 0 && (
            <div className="flex gap-2 border-t border-indigo-200 pt-3 dark:border-slate-700">
              <button
                type="button"
                onClick={() => confirmImportMutation.mutate()}
                disabled={confirmImportMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {confirmImportMutation.isPending ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <CheckCheck size={13} />
                )}
                {confirmImportMutation.isPending
                  ? 'Importing…'
                  : 'Confirm Import (' + validCount + ' rows)'}
              </button>
              <button
                type="button"
                onClick={() => { setPreviewData(null); setBulkPayload(null); }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
            </div>
          )}

          {msg && (
            <p role="status" className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {msg}
            </p>
          )}
        </div>
      </section>
    );
  }

  // ── Pending Issues Panel ────────────────────────────────
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 dark:border-slate-700 dark:bg-slate-900 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200">
          <AlertTriangle size={16} /> Medicine Rows Needing Review
          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs dark:bg-amber-700 dark:text-amber-200">
            {issues.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-900 disabled:opacity-60 dark:border-amber-700 dark:text-amber-300"
        >
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {msg && (
        <p role="status" className="mx-4 mb-3 flex items-center gap-1 text-xs font-semibold text-emerald-800 dark:text-emerald-400">
          <CheckCircle2 size={13} /> {msg}
        </p>
      )}

      {!issues.length && !editing ? (
        <p className="px-4 pb-4 text-xs text-amber-800 dark:text-amber-400">No unresolved import rows.</p>
      ) : (
        <div className="space-y-2 px-4 pb-4">
          {issues.map((issue) => (
            <div
              key={issue._id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white p-3 dark:border-amber-800/50 dark:bg-slate-800"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-800 dark:text-white">
                  Row {issue.rowNumber}:{' '}
                  {issue.originalRow?.['Medicine Name'] || issue.originalRow?.name || '—'}
                </p>
                <p className="text-[10px] text-slate-500">
                  {issue.sourceFile || 'Bulk/Excel import'} · by{' '}
                  {issue.createdBy?.name || 'Staff'}
                </p>
                <ul className="mt-1 list-inside list-disc text-[10px] text-rose-700 dark:text-rose-400">
                  {(issue.validationErrors || []).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => beginFix(issue)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-teal-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-teal-800"
              >
                <Wrench size={12} /> Fix &amp; Add
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Correction Form */}
      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            resolveMutation.mutate({ id: editing._id, medicine: form });
          }}
          className="mx-4 mb-4 rounded-xl border border-amber-300 bg-white p-4 dark:border-amber-700 dark:bg-slate-800"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              Correct Row {editing.rowNumber} &amp; Add
            </h3>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="text-xs font-semibold text-slate-500 hover:text-rose-600"
            >
              Cancel
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map(([key, label, type]) => (
              <label key={key} className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
                {label}
                {!OPTIONAL.includes(key) && <span className="text-rose-500"> *</span>}
                <input
                  required={!OPTIONAL.includes(key)}
                  type={type}
                  min={
                    type === 'number'
                      ? ['quantity', 'reorderLevel'].includes(key)
                        ? '0'
                        : '0.01'
                      : undefined
                  }
                  step={
                    type === 'number'
                      ? ['unitsPerPack', 'quantity', 'reorderLevel'].includes(key)
                        ? '1'
                        : '0.01'
                      : undefined
                  }
                  value={form[key] ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-normal focus:border-teal-400 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
              </label>
            ))}
          </div>

          <button
            type="submit"
            disabled={resolveMutation.isPending}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
          >
            {resolveMutation.isPending ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <CheckCircle2 size={13} />
            )}
            {resolveMutation.isPending ? 'Validating…' : 'Validate & Add Medicine'}
          </button>
        </form>
      )}
    </section>
  );
}
