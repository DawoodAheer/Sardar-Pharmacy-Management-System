import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArchiveRestore, Download, RefreshCw, ShieldCheck } from 'lucide-react';
import api from '../utils/api';

const dateTime = (value) => value ? new Date(value).toLocaleString('en-PK') : 'Never';
const sizeText = (value) => value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`;

export default function BackupRestorePanel() {
  const queryClient = useQueryClient();
  const inputRef = useRef(null);
  const [backupData, setBackupData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const { data: status, isFetching, refetch } = useQuery({ queryKey: ['backupStatus'], queryFn: async () => (await api.get('/backups/status')).data, refetchInterval: 30000 });
  const createMutation = useMutation({
    mutationFn: async () => (await api.post('/backups/create')).data,
    onSuccess: async (result) => { setMessage(result.message); await queryClient.invalidateQueries({ queryKey: ['backupStatus'] }); },
    onError: (error) => { setMessage(error?.response?.data?.message || 'Backup failed; check the warning below and server storage.'); queryClient.invalidateQueries({ queryKey: ['backupStatus'] }); },
  });
  const restoreMutation = useMutation({
    mutationFn: async () => (await api.post('/backups/restore', { confirmation, backupData, fileName })).data,
    onSuccess: async (result) => { setMessage(result.message); setBackupData(null); setFileName(''); setConfirmation(''); if (inputRef.current) inputRef.current.value = ''; await queryClient.invalidateQueries(); },
    onError: (error) => { setMessage(error?.response?.data?.message || 'Restore failed; the current database was not intentionally replaced.'); queryClient.invalidateQueries({ queryKey: ['backupStatus'] }); },
  });
  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage(''); setFileName(file.name);
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || !parsed.collections) throw new Error('This file does not contain a recognized pharmacy backup.');
      setBackupData(parsed);
    } catch (error) { setBackupData(null); setMessage(error.message || 'Could not read the backup JSON file.'); }
  };
  const downloadLatest = async () => {
    try {
      const { data } = await api.get('/backups/latest', { responseType: 'blob' });
      const url = URL.createObjectURL(data); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = status?.lastBackupName || 'pharmadesk_backup.json'; anchor.click(); URL.revokeObjectURL(url);
    } catch (error) { setMessage(error?.response?.data?.message || 'Could not download the latest backup.'); }
  };
  return <section className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><ShieldCheck size={18} className="text-indigo-700" /> Database backup & restore</h2><p className="mt-1 text-[11px] text-slate-500">Automatic nightly backup status and guarded restore controls</p></div><button type="button" onClick={() => refetch()} aria-label="Refresh backup status" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} /></button></div>
    {status?.lastError && <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">Latest backup warning: {status.lastError}</div>}
    <div className="mt-3 grid gap-2 sm:grid-cols-3"><div className="rounded-lg bg-slate-50 p-3 text-xs"><span className="text-slate-500">Last successful backup</span><strong className="mt-1 block text-slate-900">{dateTime(status?.lastSuccessAt)}</strong></div><div className="rounded-lg bg-slate-50 p-3 text-xs"><span className="text-slate-500">Last attempt</span><strong className="mt-1 block text-slate-900">{dateTime(status?.lastAttemptAt)}</strong></div><div className="rounded-lg bg-slate-50 p-3 text-xs"><span className="text-slate-500">Last restore</span><strong className="mt-1 block text-slate-900">{dateTime(status?.lastRestoreAt)}</strong></div></div>
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{createMutation.isPending ? 'Creating backup…' : 'Create backup now'}</button><button type="button" onClick={downloadLatest} disabled={!status?.lastBackupName} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50"><Download size={14} /> Download latest</button><label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-800"><ArchiveRestore size={14} /> Select backup to restore<input ref={inputRef} type="file" accept=".json,application/json" onChange={handleFile} className="hidden" /></label></div>
    {backupData && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-bold text-amber-900">Selected: {fileName} · {Object.keys(backupData.collections || {}).length} collections</p><p className="mt-1 text-[11px] text-amber-800">Restore replaces current database records. The system automatically creates a safety backup first. Type RESTORE to enable the operation.</p><div className="mt-2 flex flex-wrap gap-2"><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Type RESTORE" className="rounded-lg border px-3 py-2 text-xs" /><button type="button" onClick={() => { if (window.confirm('Restore this backup and replace the current database? A safety backup will be made first.')) restoreMutation.mutate(); }} disabled={confirmation !== 'RESTORE' || restoreMutation.isPending} className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{restoreMutation.isPending ? 'Restoring…' : 'Restore database'}</button></div></div>}
    {status?.backups?.length > 0 && <details className="mt-4"><summary className="cursor-pointer text-xs font-bold text-slate-700">Available backups ({status.backups.length})</summary><div className="mt-2 max-h-36 space-y-1 overflow-auto">{status.backups.slice(0, 20).map((file) => <div key={file.name} className="flex justify-between gap-2 border-b py-1 text-[10px] text-slate-600"><span className="truncate">{file.name}</span><span>{dateTime(file.createdAt)} · {sizeText(file.size)}</span></div>)}</div></details>}
    {message && <p role="status" className="mt-3 text-xs font-semibold text-slate-700">{message}</p>}
  </section>;
}
