
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ChevronLeft } from 'lucide-react';

const Unauthorized = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleGoBack = () => {
    if (!user) {
      navigate('/login');
    } else {
      if (user.role === 'superadmin') navigate('/superadmin');
      else if (user.role === 'pharmacist') navigate('/pharmacist');
      else navigate('/customer');
    }
  };

  return (
    <div className="min-h-[calc(100vh-48px)] flex items-center justify-center bg-[var(--page-bg)] px-4 transition-colors duration-200">
      <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-rose-100 border border-rose-200 text-rose-600 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-300 mb-4 animate-pulse">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">Access Denied</h1>
        <p className="mb-6 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          Your current credentials do not grant access to this secure terminal. This event has been logged for security auditing.
        </p>

        <button
          onClick={handleGoBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Return to Safety</span>
        </button>
      </div>
    </div>
  );
};

export default Unauthorized;
