
const StatusBadge = ({ status }) => {
  const normalized = String(status || 'INFO').toUpperCase();

  const getStyles = () => {
    switch (normalized) {
      case 'EXPIRED':
      case 'CRITICAL':
        return 'border border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-200';
      case 'WARNING':
      case 'CAUTION':
        return 'border border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200';
      case 'SAFE':
      case 'IN STOCK':
        return 'border border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200';
      default:
        return 'border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';
    }
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${getStyles()}`}>
      {normalized}
    </span>
  );
};

export default StatusBadge;
