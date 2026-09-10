import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  Mail,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  KeyRound,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import api from '../utils/api';

const ForgotPassword = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [offlineData, setOfflineData] = useState(null);
  const [copied, setCopied] = useState(false);

  // Load Sora Font
  useEffect(() => {
    const existingLink = document.querySelector('link[data-pharmadesk-sora="true"]');
    if (existingLink) return;

    const link = document.createElement('link');
    link.setAttribute('data-pharmadesk-sora', 'true');
    link.href = 'https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setOfflineData(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/forgot-password', {
        email: cleanEmail,
      });

      if (response.data?.success) {
        setSuccessMessage(response.data.message);

        // If running offline, response includes offlineInfo
        if (response.data.offlineInfo) {
          setOfflineData(response.data.offlineInfo);
        }
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        'Unable to send reset instructions. Please check your email or connection.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (offlineData?.code) {
      navigator.clipboard.writeText(offlineData.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 px-4 py-12 text-slate-800 sm:px-6 lg:px-8">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* Logo & Brand Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-white shadow-lg shadow-teal-500/20">
            <Activity className="h-7 w-7" />
          </div>
          <h1
            style={{ fontFamily: "'Sora', sans-serif" }}
            className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl"
          >
            Pharma Desk
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Intelligent Pharmacy Management System
          </p>
        </div>

        {/* Main Card */}
        <div className="rounded-3xl border border-slate-700/60 bg-slate-800/80 p-8 shadow-2xl backdrop-blur-xl">
          {/* Card Title */}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400">
              <KeyRound className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold text-white">Forgot Password?</h2>
            <p className="mt-1 text-xs text-slate-400">
              Enter your email and we will help you recover access to your account.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {successMessage && !offlineData && (
            <div className="mb-6 rounded-2xl border border-teal-500/30 bg-teal-500/10 p-5 text-center text-sm text-teal-200">
              <CheckCircle className="mx-auto mb-2 h-8 w-8 text-teal-400" />
              <p className="font-semibold text-white">Check Your Inbox</p>
              <p className="mt-1 text-xs text-teal-300/90">{successMessage}</p>
              <p className="mt-4 text-xs text-slate-400">
                Already have a reset code?{' '}
                <Link
                  to={`/reset-password?email=${encodeURIComponent(email)}`}
                  className="font-semibold text-teal-400 underline hover:text-teal-300"
                >
                  Enter code here
                </Link>
              </p>
            </div>
          )}

          {/* Offline Recovery Mode Banner */}
          {offlineData && (
            <div className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-amber-200">
              <div className="flex items-center gap-2 font-semibold text-amber-300">
                <ShieldCheck className="h-5 w-5 text-amber-400" />
                <span>Offline Recovery Active</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-300">
                Email server is not connected (offline mode). You can use this recovery code directly:
              </p>

              {/* Code Box */}
              <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/90 px-4 py-3">
                <span className="font-mono text-2xl font-bold tracking-widest text-emerald-400">
                  {offlineData.code}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </>
                  )}
                </button>
              </div>

              {/* Instant Action */}
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/reset-password?email=${encodeURIComponent(offlineData.email)}&code=${encodeURIComponent(offlineData.code)}&token=${encodeURIComponent(offlineData.token)}`
                  )
                }
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:opacity-95"
              >
                Proceed to Reset Password
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Email Address
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@pharmacy.com"
                  className="block w-full rounded-xl border border-slate-700 bg-slate-900/60 py-3 pl-11 pr-4 text-sm text-white placeholder-slate-500 transition focus:border-teal-500 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                  Generating Recovery Instructions...
                </>
              ) : (
                'Send Recovery Code'
              )}
            </button>
          </form>

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-400 transition hover:text-teal-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Remember your password? Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
