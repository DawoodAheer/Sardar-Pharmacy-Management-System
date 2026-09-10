import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Activity,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
  Mail,
  Hash,
} from 'lucide-react';
import api from '../utils/api';

const ResetPassword = () => {
  const { token: paramToken } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryToken = searchParams.get('token') || '';
  const queryCode = searchParams.get('code') || '';
  const queryEmail = searchParams.get('email') || '';

  const activeToken = paramToken || queryToken;

  const [email, setEmail] = useState(queryEmail);
  const [otp, setOtp] = useState(queryCode);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

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

  // Password strength calculator
  const getStrength = (pass) => {
    if (!pass) return { score: 0, label: '', color: 'bg-slate-700' };
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score++;

    switch (score) {
      case 1:
        return { score: 1, label: 'Weak', color: 'bg-rose-500' };
      case 2:
        return { score: 2, label: 'Fair', color: 'bg-amber-500' };
      case 3:
        return { score: 3, label: 'Good', color: 'bg-teal-500' };
      case 4:
        return { score: 4, label: 'Strong', color: 'bg-emerald-400' };
      default:
        return { score: 0, label: '', color: 'bg-slate-700' };
    }
  };

  const strength = getStrength(password);

  // Auto redirect countdown on success
  useEffect(() => {
    if (!success) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/login', {
            state: { message: 'Password reset successfully! Please sign in with your new password.' },
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [success, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!activeToken && (!otp?.trim() || !email?.trim())) {
      setError('Please provide your email and 6-digit reset code or use the reset link.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = activeToken
        ? `/auth/reset-password/${activeToken}`
        : '/auth/reset-password';

      const payload = {
        password,
        ...(activeToken ? { token: activeToken } : { otp: otp.trim(), email: email.trim() }),
      };

      const res = await api.post(endpoint, payload);

      if (res.data?.success) {
        setSuccess(true);
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        'Failed to reset password. The link or code may have expired.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 px-4 py-12 text-slate-800 sm:px-6 lg:px-8">
      {/* Background ambient glows */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* Header */}
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
            <h2 className="text-xl font-bold text-white">Reset Your Password</h2>
            <p className="mt-1 text-xs text-slate-400">
              Choose a strong, secure password for your account.
            </p>
          </div>

          {/* Success Screen */}
          {success ? (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                <CheckCircle className="h-10 w-10" />
              </div>
              <h3 className="text-lg font-bold text-white">Password Updated!</h3>
              <p className="mt-2 text-xs text-slate-300">
                Your password has been reset successfully. Redirecting you to login in {countdown} seconds...
              </p>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 py-3 text-sm font-bold text-slate-950 shadow-lg transition hover:brightness-110"
              >
                Sign In Now
              </button>
            </div>
          ) : (
            <>
              {/* Error Banner */}
              {error && (
                <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* If reset link token is not in URL, require email and 6-digit code */}
                {!activeToken && (
                  <>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                        Account Email
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

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                        6-Digit Recovery Code
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                          <Hash className="h-5 w-5" />
                        </div>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          placeholder="123456"
                          className="block w-full rounded-xl border border-slate-700 bg-slate-900/60 py-3 pl-11 pr-4 font-mono text-sm tracking-widest text-white placeholder-slate-500 transition focus:border-teal-500 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* New Password */}
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    New Password
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Lock className="h-5 w-5" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full rounded-xl border border-slate-700 bg-slate-900/60 py-3 pl-11 pr-11 text-sm text-white placeholder-slate-500 transition focus:border-teal-500 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {password && (
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Strength</span>
                        <span className="font-semibold text-slate-300">{strength.label}</span>
                      </div>
                      <div className="mt-1 flex h-1.5 gap-1.5 overflow-hidden rounded-full bg-slate-800">
                        {[1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            className={`h-full flex-1 transition-all duration-300 ${
                              strength.score >= level ? strength.color : 'bg-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full rounded-xl border border-slate-700 bg-slate-900/60 py-3 pl-11 pr-11 text-sm text-white placeholder-slate-500 transition focus:border-teal-500 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition hover:text-slate-200"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="mt-1 text-[11px] text-rose-400">Passwords do not match.</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-teal-500/20 transition hover:brightness-110 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                      Updating Password...
                    </>
                  ) : (
                    'Set New Password'
                  )}
                </button>
              </form>
            </>
          )}

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-400 transition hover:text-teal-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
