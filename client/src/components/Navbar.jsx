
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LogOut, Moon, Sun, Stethoscope } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'superadmin':
        return 'border border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-slate-600 dark:bg-slate-700 dark:text-indigo-100';
      case 'pharmacist':
        return 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200';
      case 'customer':
        return 'border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100';
      default:
        return 'border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100';
    }
  };

  const getRoleLabel = (role) => {
    if (role === 'superadmin') return 'Super Admin';
    if (role === 'pharmacist') return 'Pharmacist';
    return 'Customer';
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 shadow-sm backdrop-blur-sm transition-colors duration-200 dark:border-slate-700 dark:bg-slate-900/95 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-emerald-500 text-white shadow-sm shadow-teal-600/20">
          <Stethoscope className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <span className="block text-sm font-extrabold tracking-[0.18em] text-slate-900 dark:text-slate-100">SARDAR</span>
          <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-teal-700 dark:text-teal-300">Pharmacy</span>
        </div>
      </div>

      {user && (
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800 sm:flex">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${getRoleBadgeStyle(user.role)}`}>
              {getRoleLabel(user.role)}
            </span>
            <div className="flex flex-col text-right">
              <span className="text-xs font-semibold leading-tight text-slate-900 dark:text-slate-100">{user.name}</span>
              <span className="text-[9px] leading-none text-slate-500 dark:text-slate-400">{user.email}</span>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-teal-200 bg-teal-50 text-xs font-bold uppercase text-teal-700 dark:border-teal-700 dark:bg-slate-700 dark:text-teal-200">
              {user.name.charAt(0)}
            </div>
          </div>

          <button
            type="button"
            onClick={toggle}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-teal-700 dark:hover:bg-slate-700"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            onClick={logout}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-red-700 dark:hover:bg-red-950/30 dark:hover:text-red-300"
            title="Logout"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="hidden text-sm font-semibold sm:inline">Logout</span>
          </button>
        </div>
      )}
    </header>
  );
};

export default Navbar;