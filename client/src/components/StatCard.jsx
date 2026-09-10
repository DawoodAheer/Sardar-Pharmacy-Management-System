const StatCard = ({ title, icon: Icon, value, color = 'teal' }) => {
  const getColorStyles = () => {
    switch (color) {
      case 'blue':
        return 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-200';
      case 'red':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-200';
      case 'orange':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200';
      case 'green':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200';
      default:
        return 'bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-200';
    }
  };

  const colorClasses = getColorStyles();

  return (
    <div className="relative flex items-center justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors duration-200 dark:border-slate-700 dark:bg-slate-900">
      <div>
        <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">{title}</span>
        <span className="block text-2xl font-bold text-slate-900 dark:text-slate-50">{value}</span>
      </div>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colorClasses}`}>
        {Icon && <Icon className="h-5 w-5" />}
      </div>
    </div>
  );
};

export default StatCard;
