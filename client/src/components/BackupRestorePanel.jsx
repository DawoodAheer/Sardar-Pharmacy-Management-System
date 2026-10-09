import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArchiveRestore, CheckCircle2, Clock, Database, Download, RefreshCw,
  ShieldAlert, ShieldCheck, Loader2, AlertTriangle, HardDrive, Upload,
} from 'lucide-react';
import api from '../utils/api';

const fmtDT = (v) =>
  v ? new Date(v).toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never';

const fmtSize = (v) => {
  if (!v) return '—';
  return v < 1024 * 1024 ? Math.ceil(v / 1024) + ' KB' : (v / 1024 / 1024).toFixed(1) + ' MB';
};

const timeSince = (v) => {
  if (!v) return null;
  const m = Math.floor((Date.now() - new Date(v).getTime()) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
};

export default function BackupRestorePanel() {
  const queryClient = useQueryClient();
  const inputRef = useRef(null);
  const [backupData, setBackupData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [msg, setMsg] = useState({ text: '', type: 'info' });

  const { data: status, isFetching, refetch } = useQuery({
    queryKey: ['backupStatus'],
    queryFn: async () => (await api.get('/backups/status')).data,
    refetchInterval: 30000,
  });

  const createMutation = useMutation({
    mutationFn: async () => (await api.post('/backups/create')).data,
    onSuccess: async (r) => {
      setMsg({ text: r.message, type: 'success' });
      await queryClient.invalidateQueries({ queryKey: ['backupStatus'] });
    },
    onError: (e) => {
      setMsg({ text: e?.response?.data?.message || 'Backup failed. Check server storage.', type: 'error' });
      queryClient.invalidateQueries({ queryKey: ['backupStatus'] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => (await api.post('/backups/restore', { confirmation, backupData, fileName })).data,
    onSuccess: async (r) => {
      setMsg({ text: r.message, type: 'success' });
      setBackupData(null); setFileName(''); setConfirmation('');
      if (inputRef.current) inputRef.current.value = '';
      await queryClient.invalidateQueries();
    },
    onError: (e) => {
      setMsg({ text: e?.response?.data?.message || 'Restore failed.', type: 'error' });
      queryClient.invalidateQueries({ queryKey: ['backupStatus'] });
    },
  });

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg({ text: '', type: 'info' }); setFileName(file.name);
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || !parsed.collections)
        throw new Error('Not a recognized pharmacy backup.');
      setBackupData(parsed);
      setMsg({ text: 'Backup loaded: ' + Object.keys(parsed.collections || {}).length + ' collections found.', type: 'success' });
    } catch (err) {
      setBackupData(null);
      setMsg({ text: err.message || 'Could not read backup JSON file.', type: 'error' });
    }
  };

  const downloadLatest = async () => {
    try {
      const { data } = await api.get('/backups/latest', { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url; a.download = status?.lastBackupName || 'pharmadesk_backup.json'; a.click(); URL.revokeObjectURL(url);
    } catch (err) { setMsg({ text: err?.response?.data?.message || 'Could not download latest backup.', type: 'error' }); }
  };

  const backupAge = status?.lastSuccessAt ? timeSince(status.lastSuccessAt) : null;
  const hasError = Boolean(status?.lastError);
  const hasBackup = Boolean(status?.lastBackupName);
  const collectionCount = backupData ? Object.keys(backupData.collections || {}).length : 0;

  return (
    <section className="rounded-2xl border border-indigo-200 bg-white shadow-sm dark:border-indigo-900/50 dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-indigo-100 bg-indigo-50/70 px-5 py-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600">
            <Database size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Database Backup &amp; Restore</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Nightly backup status · guarded restore controls</p>
          </div>
        </div>
        <button
          type="button" onClick={() => refetch()} aria-label="Refresh backup status"
          className="rounded-lg p-2 text-slate-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
        >
          <RefreshCw size={15} className={isFetching ? 'animate-spin text-indigo-500' : ''} />
        </button>
      </div>

      <div className="space-y-4 p-5">
        {/* Failure Warning */}
        {hasError && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 dark:border-rose-800/50 dark:bg-rose-950/30">
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
            <div>
              <p className="text-xs font-bold text-rose-800 dark:text-rose-300">Backup Warning</p>
              <p className="mt-0.5 text-[11px] text-rose-700 dark:text-rose-400">{status.lastError}</p>
            </div>
          </div>
        )}

        {/* Status Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className={'rounded-xl border p-3.5 ' + (hasError
            ? 'border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/20'
            : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-950/20')}>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={13} className={hasError ? 'text-amber-500' : 'text-emerald-600'} />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Last Successful</span>
            </div>
            <p className="mt-1.5 text-xs font-bold text-slate-800 dark:text-white">{fmtDT(status?.lastSuccessAt)}</p>
            {backupAge && <p className="mt-0.5 text-[10px] text-slate-500">{backupAge}</p>}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-800/40">
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-slate-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Last Attempt</span>
            </div>
            <p className="mt-1.5 text-xs font-bold text-slate-800 dark:text-white">{fmtDT(status?.lastAttemptAt)}</p>
            {status?.lastBackupName && (
              <p className="mt-0.5 truncate text-[10px] text-slate-400">{status.lastBackupName}</p>
            )}
          </div>

          <div className="rounded-xl border border-violet-200 bg-violet-50 p-3.5 dark:border-violet-800/40 dark:bg-violet-950/20">
            <div className="flex items-center gap-2">
              <ArchiveRestore size={13} className="text-violet-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Last Restore</span>
            </div>
            <p className="mt-1.5 text-xs font-bold text-slate-800 dark:text-white">{fmtDT(status?.lastRestoreAt)}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            {createMutation.isPending ? 'Creating backup…' : 'Create Backup Now'}
          </button>
          <button
            type="button" onClick={downloadLatest} disabled={!hasBackup}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            <Download size={14} /> Download Latest
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
            <Upload size={14} /> Select Backup to Restore
            <input ref={inputRef} type="file" accept=".json,application/json" onChange={handleFile} className="hidden" />
          </label>
        </div>

        {/* Restore Confirmation Panel */}
        {backupData && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-950/20">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-amber-900 dark:text-amber-300">
                  Selected: {fileName}
                </p>
                <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                  {collectionCount} collections · Restore replaces current database. A safety backup is created first.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    type="text" value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    placeholder="Type RESTORE to confirm"
                    className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-mono focus:border-amber-500 focus:outline-none dark:border-amber-700 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Replace current database with this backup? A safety backup will be saved first.'))
                        restoreMutation.mutate();
                    }}
                    disabled={confirmation !== 'RESTORE' || restoreMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                  >
                    {restoreMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <ArchiveRestore size={13} />}
                    {restoreMutation.isPending ? 'Restoring…' : 'Restore Database'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Available Backups Dropdown */}
        {status?.backups?.length > 0 && (
          <details>
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              <HardDrive size={13} /> Available Backups
              <span className="ml-auto rounded-full bg-slate-200 px-2 py-0.5 text-[10px] dark:bg-slate-700 dark:text-slate-300">
                {status.backups.length}
              </span>
            </summary>
            <div className="mt-2 max-h-40 space-y-1 overflow-auto rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
              {status.backups.slice(0, 20).map((f) => (
                <div key={f.name} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[10px] hover:bg-slate-50 dark:hover:bg-slate-800">
                  <span className="truncate text-slate-700 dark:text-slate-300">{f.name}</span>
                  <span className="shrink-0 text-slate-400">{fmtDT(f.createdAt)} · {fmtSize(f.size)}</span>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Feedback Message */}
        {msg.text && (
          <div className={'flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold ' + (
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
              : msg.type === 'error'
              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300'
              : 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          )}>
            {msg.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            <span role="status">{msg.text}</span>
          </div>
        )}
      </div>
    </section>
  );
}
