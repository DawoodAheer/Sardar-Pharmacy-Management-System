import {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
  useLocation,
  Link,
} from "react-router-dom";

import {
  Activity,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";

/*
|--------------------------------------------------------------------------
| Login Page
|--------------------------------------------------------------------------
|
| Authentication is handled by AuthContext.
|
| Login.jsx only:
| - collects credentials
| - validates basic input
| - calls login()
| - checks selected role
| - redirects after successful login
| - displays success/error messages
|
| Token handling is NOT done here.
| Axios is NOT used directly here.
|
|--------------------------------------------------------------------------
*/

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();

  /*
  |--------------------------------------------------------------------------
  | Authentication
  |--------------------------------------------------------------------------
  */
  const {
    login,
    loading: authLoading,
  } = useAuth();

  /*
  |--------------------------------------------------------------------------
  | Form State
  |--------------------------------------------------------------------------
  */
  const [role, setRole] =
    useState("pharmacist");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState(
      location.state?.message || ""
    );

  /*
  |--------------------------------------------------------------------------
  | Load Sora Font
  |--------------------------------------------------------------------------
  */
  useEffect(() => {
    const existingLink =
      document.querySelector(
        'link[data-pharmadesk-sora="true"]'
      );

    if (existingLink) {
      return;
    }

    const link =
      document.createElement("link");

    link.href =
      "https://fonts.googleapis.com/css2?family=Sora:wght@600;700&display=swap";

    link.rel = "stylesheet";

    link.dataset.pharmadeskSora =
      "true";

    document.head.appendChild(link);
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Show Navigation Message
  |--------------------------------------------------------------------------
  |
  | Example:
  |
  | After logout:
  |
  | navigate("/login", {
  |   state: {
  |     message: "Logged out successfully"
  |   }
  | });
  |
  | The message is displayed once.
  |--------------------------------------------------------------------------
  */
  useEffect(() => {
    if (location.state?.message) {
      const timer = setTimeout(() => {
        navigate(location.pathname, {
          replace: true,
          state: {},
        });
      }, 50);

      return () => {
        clearTimeout(timer);
      };
    }

    return undefined;
  }, [
    location.pathname,
    location.state?.message,
    navigate,
  ]);

  /*
  |--------------------------------------------------------------------------
  | Login Handler
  |--------------------------------------------------------------------------
  */
  const handleLogin = async (event) => {
    event.preventDefault();

    /*
     * Clear previous messages.
     */
    setError("");
    setSuccessMessage("");

    /*
     * Clean email before sending.
     */
    const cleanEmail =
      email.trim().toLowerCase();

    /*
     * Basic frontend validation.
     * Backend performs complete validation.
     */
    if (!cleanEmail || !password) {
      setError(
        "Please enter your email and password."
      );
      return;
    }

    setLoading(true);

    try {
      /*
       * AuthContext handles:
       *
       * POST /api/auth/login
       * access token
       * refresh cookie
       * user state
       */
      const result = await login(
        cleanEmail,
        password
      );

      /*
       * AuthContext returns:
       *
       * {
       *   user,
       *   message
       * }
       */
      const loggedInUser =
        result?.user;

      if (!loggedInUser) {
        throw new Error(
          "Login response did not contain user information."
        );
      }

      /*
       * The backend determines the REAL role from
       * the database.
       *
       * The selected role is only used to make sure
       * the user selected the correct login option.
       */
      if (
        loggedInUser.role !== role
      ) {
        setError(
          `This account is registered as ${loggedInUser.role}. Please select the correct role and try again.`
        );

        return;
      }

      /*
       * Success message.
       */
      const message =
        result?.message ||
        `Welcome back, ${loggedInUser.name}!`;

      /*
       * IMPORTANT:
       *
       * Redirect directly here after successful login.
       *
       * No useEffect is used for this redirect,
       * so React will not report cascading-render
       * warnings.
       */
      switch (loggedInUser.role) {
        case "pharmacist":
          navigate("/pharmacist", {
            replace: true,
            state: {
              message,
            },
          });
          break;

        case "superadmin":
          navigate("/superadmin", {
            replace: true,
            state: {
              message,
            },
          });
          break;

        case "customer":
          navigate(
            "/customer/dashboard",
            {
              replace: true,
              state: {
                message,
              },
            }
          );
          break;

        default:
          /*
           * This should normally never happen because
           * role should be validated by the backend/model.
           */
          setError(
            "Your account role is not configured correctly. Please contact the administrator."
          );
      }
    } catch (err) {
      /*
       * AuthContext converts backend errors into
       * normal Error objects.
       */
      setError(
        err.message ||
          "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Submit Loading State
  |--------------------------------------------------------------------------
  */
  const isSubmitting =
    loading || authLoading;

  return (
    <div className="min-h-screen flex font-sans">

      {/* ================================================================ */}
      {/* LEFT PANEL                                                       */}
      {/* ================================================================ */}

      <div className="hidden md:flex md:w-[55%] bg-[#0C1628] text-white flex-col justify-between p-12 relative overflow-hidden">

        {/* Decorative blur */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-[#1A56A0]/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-teal-500/5 rounded-full blur-[100px] pointer-events-none" />

        {/* ============================================================ */}
        {/* LOGO                                                          */}
        {/* ============================================================ */}

        <div className="flex items-center gap-3 relative z-10">

          <div className="w-10 h-10 rounded-xl bg-[#1A56A0] flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Activity className="w-5 h-5 text-white" />
          </div>

          <div>
            <span className="block font-bold text-lg tracking-tight text-white">
              Pharmadesk
            </span>

            <span className="block text-[9px] font-bold text-slate-400 tracking-widest uppercase mt-0.5">
              PHARMACY MANAGEMENT SYSTEM
            </span>
          </div>

        </div>

        {/* ============================================================ */}
        {/* MAIN HEADLINE                                                 */}
        {/* ============================================================ */}

        <div className="my-auto py-12 relative z-10 max-w-xl">

          <h1 className="font-['Sora'] font-extrabold text-4xl lg:text-5xl leading-tight text-white tracking-tight space-y-2">

            <span className="block">
              Smart pharmacy
            </span>

            <span className="block">
              management,
            </span>

            <span className="block bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-400">
              built for safety.
            </span>

          </h1>

          <p className="text-slate-400 text-sm md:text-base mt-6 font-medium leading-relaxed">
            Every expiry checked. Every bill validated.
            Automatically.
          </p>

        </div>

        {/* ============================================================ */}
        {/* STATISTICS                                                    */}
        {/* ============================================================ */}

        <div className="border border-slate-800/80 bg-slate-900/30 backdrop-blur-sm p-6 rounded-2xl relative z-10">

          <div className="grid grid-cols-3 gap-4 divide-x divide-slate-800/80 text-center">

            <div>
              <span className="block text-xl lg:text-2xl font-bold text-white tracking-tight">
                12,480
              </span>

              <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1">
                Medicines Tracked
              </span>
            </div>

            <div>
              <span className="block text-xl lg:text-2xl font-bold text-white tracking-tight">
                99.8%
              </span>

              <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1">
                Expiry Accuracy
              </span>
            </div>

            <div>
              <span className="block text-xl lg:text-2xl font-bold text-white tracking-tight">
                4,200+
              </span>

              <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-1">
                Bills Generated
              </span>
            </div>

          </div>

        </div>

      </div>

      {/* ================================================================ */}
      {/* RIGHT PANEL                                                      */}
      {/* ================================================================ */}

      <div className="w-full md:w-[45%] bg-white flex flex-col justify-between p-8 md:p-12 overflow-y-auto">

        <div className="hidden md:block h-6" />

        <div className="max-w-md w-full mx-auto my-auto py-8">

          {/* ============================================================ */}
          {/* HEADER                                                        */}
          {/* ============================================================ */}

          <div className="mb-8">

            <span className="block text-xs font-bold text-[#1A56A0] tracking-widest uppercase mb-1.5">
              SECURE ACCESS
            </span>

            <h2 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              Sign in to your account
            </h2>

            <p className="text-sm text-slate-500 mt-2 font-medium">
              Select your role to continue
            </p>

          </div>

          {/* ============================================================ */}
          {/* SUCCESS MESSAGE                                               */}
          {/* ============================================================ */}

          {successMessage && (
            <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-start gap-3 font-medium">

              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5 text-green-600" />

              <span>
                {successMessage}
              </span>

            </div>
          )}

          {/* ============================================================ */}
          {/* ERROR MESSAGE                                                 */}
          {/* ============================================================ */}

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3 font-medium">

              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />

              <span>
                {error}
              </span>

            </div>
          )}

          {/* ============================================================ */}
          {/* ROLE SELECTOR                                                 */}
          {/* ============================================================ */}

          <div className="grid grid-cols-3 gap-3 mb-6">

            {/* Pharmacist */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setRole("pharmacist");
                setError("");
              }}
              className={`py-2.5 px-3 text-xs font-bold rounded-xl border transition-all text-center disabled:opacity-60 disabled:cursor-not-allowed ${
                role === "pharmacist"
                  ? "border-[#1A56A0] bg-blue-50 text-[#1A56A0] shadow-sm shadow-[#1A56A0]/5"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              Pharmacist
            </button>

            {/* Admin */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setRole("superadmin");
                setError("");
              }}
              className={`py-2.5 px-3 text-xs font-bold rounded-xl border transition-all text-center disabled:opacity-60 disabled:cursor-not-allowed ${
                role === "superadmin"
                  ? "border-[#1A56A0] bg-blue-50 text-[#1A56A0] shadow-sm shadow-[#1A56A0]/5"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              Admin
            </button>

            {/* Customer */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setRole("customer");
                setError("");
              }}
              className={`py-2.5 px-3 text-xs font-bold rounded-xl border transition-all text-center disabled:opacity-60 disabled:cursor-not-allowed ${
                role === "customer"
                  ? "border-[#1A56A0] bg-blue-50 text-[#1A56A0] shadow-sm shadow-[#1A56A0]/5"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              Customer
            </button>

          </div>

          {/* ============================================================ */}
          {/* LOGIN FORM                                                    */}
          {/* ============================================================ */}

          <form
            onSubmit={handleLogin}
            className="space-y-5"
          >

            {/* Email */}
            <div>

              <label className="block text-[10px] font-bold text-slate-700 tracking-wider mb-2 uppercase">
                Email Address
              </label>

              <div className="relative">

                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-5 h-5" />
                </div>

                <input
                  type="email"
                  required
                  disabled={isSubmitting}
                  value={email}
                  onChange={(event) => {
                    setEmail(
                      event.target.value
                    );
                    setError("");
                  }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#1A56A0] focus:ring-1 focus:ring-[#1A56A0] transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                />

              </div>

            </div>

            {/* Password */}
            <div>

              <div className="flex justify-between items-center mb-2">

                <label className="block text-[10px] font-bold text-slate-700 tracking-wider uppercase">
                  Password
                </label>

                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-[#1A56A0] hover:underline"
                >
                  Forgot password?
                </Link>

              </div>

              <div className="relative">

                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>

                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  required
                  disabled={isSubmitting}
                  value={password}
                  onChange={(event) => {
                    setPassword(
                      event.target.value
                    );
                    setError("");
                  }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#1A56A0] focus:ring-1 focus:ring-[#1A56A0] transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                />

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() =>
                    setShowPassword(
                      (previous) =>
                        !previous
                    )
                  }
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>

              </div>

            </div>

            {/* ========================================================== */}
            {/* SUBMIT BUTTON                                               */}
            {/* ========================================================== */}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-[#1A56A0] hover:bg-[#1A56A0]/95 text-white font-bold rounded-xl transition-all duration-300 shadow-md flex justify-center items-center disabled:opacity-60 disabled:cursor-not-allowed text-sm mt-6"
            >

              {isSubmitting ? (
                <div className="flex items-center gap-2">

                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />

                  <span>
                    Authenticating...
                  </span>

                </div>
              ) : (
                <span>
                  {role === "pharmacist" &&
                    "Sign in as Pharmacist"}

                  {role === "superadmin" &&
                    "Sign in as Admin"}

                  {role === "customer" &&
                    "Sign in as Customer"}
                </span>
              )}

            </button>

          </form>

          {/* ============================================================ */}
          {/* REGISTER                                                       */}
          {/* ============================================================ */}

          <div className="mt-6 text-center text-sm text-slate-500">

            Don't have an account?{" "}

            <Link
              to="/register"
              className="text-[#1A56A0] hover:underline font-bold"
            >
              Create one &rarr;
            </Link>

          </div>

        </div>

        {/* ============================================================ */}
        {/* TRUST BADGES                                                  */}
        {/* ============================================================ */}

        <div className="flex justify-center items-center gap-6 text-[11px] text-slate-400 font-medium mt-auto pt-8 border-t border-slate-100">

          <span>
            SSL Encrypted
          </span>

          <span>
            HIPAA Safe
          </span>

          <span>
            ISO 27001
          </span>

        </div>

      </div>
    </div>
  );
};

export default Login;