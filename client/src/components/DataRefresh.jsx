import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';

export default function DataRefresh() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!user) return;
    let timer;
    const changed = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { client.invalidateQueries(); }, 300);
    };
    const unsubscribe = client.getQueryCache().subscribe(event => {
      if (event.type === 'updated' && event.action?.type === 'success') {
        setMessage(`Updated ${new Date().toLocaleTimeString('en-PK')}`);
      }
    });
    window.addEventListener('pharmacy:data-changed', changed);
    window.addEventListener('focus', changed);
    return () => { clearTimeout(timer); unsubscribe(); window.removeEventListener('pharmacy:data-changed', changed); window.removeEventListener('focus', changed); };
  }, [user, client]);
  if (!user) return null;
  const refresh = async () => {
    setBusy(true); setMessage('Refreshing…');
    try { await client.invalidateQueries({}, { throwOnError: true }); setMessage(`Updated ${new Date().toLocaleTimeString('en-PK')}`); }
    catch { setMessage('Refresh failed. Check connection and retry.'); }
    finally { setBusy(false); }
  };
  return <div className="fixed bottom-3 right-3 z-40 max-w-xs rounded-xl border bg-white p-2 text-xs text-slate-800 shadow-lg dark:bg-slate-900 dark:text-white print:hidden">
    <button type="button" disabled={busy} onClick={refresh} className="rounded-lg bg-teal-700 px-3 py-2 font-bold text-white disabled:opacity-60">{busy ? 'Refreshing…' : 'Refresh page data'}</button>
    <p role="status" className="mt-1">{message}</p>
  </div>;
}
