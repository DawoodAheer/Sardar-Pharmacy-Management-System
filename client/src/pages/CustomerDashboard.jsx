import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import {
  Activity,
  ShoppingBag,
  Bell,
  FileText,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  HeartPulse,
  ChevronDown,
  ChevronUp,
  Package,
  Phone,
  Mail,
  MapPin,
  CalendarDays,
  Receipt,
  UserRound,
} from 'lucide-react';

const formatPKR = (amount = 0) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const formatDate = (date) => {
  if (!date) return 'N/A';

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'N/A';
  }

  return parsedDate.toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const CustomerDashboard = () => {
  const { user } = useAuth();

  const [expandedCard, setExpandedCard] = useState(null);

  const {
    data: bills = [],
    isLoading: billsLoading,
    isError: billsError,
  } = useQuery({
    queryKey: ['bills', user?._id],
    queryFn: async () => {
      const { data } = await api.get(`/bills/customer/${user._id}`);
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(user?._id),
  });

  const {
    data: reminders = [],
    isLoading: remindersLoading,
    isError: remindersError,
  } = useQuery({
    queryKey: ['reminders', user?._id],
    queryFn: async () => {
      const { data } = await api.get(
        `/notifications/reminders/customer/${user._id}`,
      );

      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(user?._id),
  });

  const activeReminders = useMemo(
    () => reminders.filter((reminder) => reminder.isActive),
    [reminders],
  );

  const totalPurchasesThisMonth = useMemo(() => {
    const currentDate = new Date();

    return bills.reduce((sum, bill) => {
      const billDate = new Date(bill.createdAt);

      if (Number.isNaN(billDate.getTime())) {
        return sum;
      }

      const sameMonth =
        billDate.getMonth() === currentDate.getMonth() &&
        billDate.getFullYear() === currentDate.getFullYear();

      if (!sameMonth) {
        return sum;
      }

      return sum + (Number(bill.total) || 0);
    }, 0);
  }, [bills]);

  const expiringMeds = useMemo(() => {
    const uniqueMeds = {};

    bills.forEach((bill) => {
      if (!Array.isArray(bill.items)) {
        return;
      }

      bill.items.forEach((item) => {
        const importantStatuses = ['CRITICAL', 'WARNING', 'CAUTION'];

        if (!importantStatuses.includes(item.expiryStatus)) {
          return;
        }

        const medicineKey = item.medicineId || item.name;

        uniqueMeds[medicineKey] = {
          name: item.name || 'Unknown Medicine',
          expiryStatus: item.expiryStatus,
          expiryDate: item.expiryDate,
          qtyPurchased:
            (uniqueMeds[medicineKey]?.qtyPurchased || 0) +
            (Number(item.quantity) || 0),
        };
      });
    });

    return Object.values(uniqueMeds);
  }, [bills]);

  const toggleCard = (cardName) => {
    setExpandedCard((current) =>
      current === cardName ? null : cardName,
    );
  };

  const customerPhone = user?.phone || 'Not provided';
  const customerEmail = user?.email || 'Not provided';
  const customerName = user?.name || 'Customer';

  return (
    <div className="dashboard-shell mx-auto max-w-7xl space-y-5 p-4 transition-colors duration-200">
      {/* Welcome Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-teal-700 to-emerald-600 p-5 shadow-sm">
        <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Welcome Back,{' '}
              <span className="text-emerald-50">{customerName}</span>
            </h1>

            <p className="mt-1 max-w-2xl text-sm text-emerald-50/90">
              Manage your medicines, purchases, reminders, profile details,
              and pharmacy orders from one place.
            </p>
          </div>

          <Link
            to="/customer/shop"
            className="flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-teal-700 shadow-sm transition-all hover:bg-emerald-50"
          >
            <ShoppingBag className="w-4 h-4" />
            Browse Medicine Shop
          </Link>
        </div>
      </section>

      {/* Customer Information */}
      <section className="bg-white dark:bg-[#1a2438] rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              My Information
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Your account and contact details
            </p>
          </div>

          <ShieldCheck className="w-5 h-5 text-[#1A56A0] dark:text-sky-400" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/70 dark:border-slate-700/40">
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] uppercase font-bold tracking-wider">
                Name
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {customerName}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/70 dark:border-slate-700/40">
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-1">
              <Mail className="w-4 h-4" />
              <span className="text-[10px] uppercase font-bold tracking-wider">
                Email
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {customerEmail}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/70 dark:border-slate-700/40">
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-1">
              <Phone className="w-4 h-4" />
              <span className="text-[10px] uppercase font-bold tracking-wider">
                Phone
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {customerPhone}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/70 dark:border-slate-700/40">
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-1">
              <MapPin className="w-4 h-4" />
              <span className="text-[10px] uppercase font-bold tracking-wider">
                Location
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {user?.address || user?.location || 'Not provided'}
            </p>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-[#1a2438]">
        <div className="mb-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Quick Actions
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Keep your pharmacy tasks one click away.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            to="/customer/shop"
            className="group flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-[#1A56A0] transition hover:border-blue-200 hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-sky-300 dark:hover:bg-blue-500/20"
          >
            <span className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Browse Shop
            </span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <Link
            to="/customer/bills"
            className="group flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 transition hover:border-emerald-200 hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
          >
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              View Invoices
            </span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <Link
            to="/customer/reminders"
            className="group flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 transition hover:border-amber-200 hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
          >
            <span className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Manage Reminders
            </span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <Link
            to="/customer/profile"
            className="group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <span className="flex items-center gap-2">
              <UserRound className="h-4 w-4" />
              Edit Profile
            </span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Purchases */}
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => toggleCard('purchases')}
            className="w-full text-left p-5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Purchases This Month
                </p>

                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                  {billsLoading ? '...' : `PKR ${totalPurchasesThisMonth.toFixed(2)}`}
                </p>

                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                  {bills.length} total order(s)
                </p>
              </div>

              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 dark:text-emerald-400">
                <Receipt className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs font-semibold text-[#1A56A0] dark:text-sky-400">
              <span>
                {expandedCard === 'purchases'
                  ? 'Hide Details'
                  : 'View Details'}
              </span>

              {expandedCard === 'purchases' ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </button>

          {expandedCard === 'purchases' && (
            <div className="px-5 pb-5 border-t border-slate-200 dark:border-slate-700/50 pt-4 space-y-2">
              {billsError ? (
                <p className="text-xs text-red-500">
                  Unable to load purchase information.
                </p>
              ) : bills.length === 0 ? (
                <div className="text-center py-5 text-xs text-slate-500 dark:text-slate-400">
                  No purchases found.
                </div>
              ) : (
                bills.slice(0, 5).map((bill) => (
                  <div
                    key={bill._id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-slate-700/40"
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          Bill #{String(bill._id).slice(-6).toUpperCase()}
                        </p>

                        <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {formatDate(bill.createdAt)}
                        </p>
                      </div>

                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {formatPKR(bill.total)}
                      </span>
                    </div>
                  </div>
                ))
              )}

              <Link
                to="/customer/bills"
                className="flex items-center justify-center gap-2 text-xs font-semibold text-[#1A56A0] dark:text-sky-400 pt-2"
              >
                View All Invoices
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* Reminders */}
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => toggleCard('reminders')}
            className="w-full text-left p-5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  SMS Reminders
                </p>

                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                  {remindersLoading ? '...' : activeReminders.length}
                </p>

                <p className="text-xs text-emerald-500 dark:text-emerald-400 mt-2 font-semibold">
                  Active reminders
                </p>
              </div>

              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-[#1A56A0] dark:text-sky-400">
                <Bell className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs font-semibold text-[#1A56A0] dark:text-sky-400">
              <span>
                {expandedCard === 'reminders'
                  ? 'Hide Details'
                  : 'View Details'}
              </span>

              {expandedCard === 'reminders' ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </button>

          {expandedCard === 'reminders' && (
            <div className="px-5 pb-5 border-t border-slate-200 dark:border-slate-700/50 pt-4">
              {remindersError ? (
                <p className="text-xs text-red-500">
                  Unable to load reminder information.
                </p>
              ) : activeReminders.length === 0 ? (
                <div className="text-center py-5 text-xs text-slate-500 dark:text-slate-400">
                  No active reminders found.
                </div>
              ) : (
                <div className="space-y-2">
                  {activeReminders.slice(0, 5).map((reminder) => (
                    <div
                      key={reminder._id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-slate-700/40"
                    >
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {reminder.medicineName ||
                          reminder.medicine ||
                          'Medicine Reminder'}
                      </p>

                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                        {reminder.time ||
                          reminder.reminderTime ||
                          'Scheduled reminder'}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <Link
                to="/customer/reminders"
                className="flex items-center justify-center gap-2 text-xs font-semibold text-[#1A56A0] dark:text-sky-400 pt-4"
              >
                Manage Reminders
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* Expiring Medicines */}
        <div className="bg-white dark:bg-[#1a2438] rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => toggleCard('expiry')}
            className="w-full text-left p-5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Expiring Medicines
                </p>

                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                  {billsLoading ? '...' : expiringMeds.length}
                </p>

                <p className="text-xs text-amber-500 dark:text-amber-400 mt-2 font-semibold">
                  Require attention
                </p>
              </div>

              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 dark:text-amber-400">
                <HeartPulse className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs font-semibold text-[#1A56A0] dark:text-sky-400">
              <span>
                {expandedCard === 'expiry'
                  ? 'Hide Details'
                  : 'View Details'}
              </span>

              {expandedCard === 'expiry' ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </button>

          {expandedCard === 'expiry' && (
            <div className="px-5 pb-5 border-t border-slate-200 dark:border-slate-700/50 pt-4">
              {expiringMeds.length === 0 ? (
                <div className="text-center py-5 text-xs text-slate-500 dark:text-slate-400">
                  No expiring medicines found in your purchase history.
                </div>
              ) : (
                <div className="space-y-2">
                  {expiringMeds.slice(0, 5).map((medicine) => (
                    <div
                      key={`${medicine.name}-${medicine.expiryStatus}`}
                      className="p-3 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20"
                    >
                      <div className="flex items-center gap-3">
                        <Package className="w-4 h-4 text-amber-500 flex-shrink-0" />

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {medicine.name}
                          </p>

                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                            Status: {medicine.expiryStatus}
                          </p>

                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            Quantity purchased: {medicine.qtyPurchased}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Medication Expiry Section */}
      <section className="bg-white dark:bg-[#1a2438] p-5 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm transition-colors duration-200">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Medication Expiry Advisories
            </h2>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Medicines from your purchase history requiring attention.
            </p>
          </div>
        </div>

        {billsLoading ? (
          <div className="py-10 flex justify-center">
            <div className="w-7 h-7 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : expiringMeds.length === 0 ? (
          <div className="py-8 text-center bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-slate-700/40">
            <HeartPulse className="w-7 h-7 mx-auto text-emerald-500 mb-2" />

            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              No expiry warnings found
            </p>

            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              Your purchased medicines currently have no recorded expiry
              advisories.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {expiringMeds.map((medicine) => (
              <div
                key={`${medicine.name}-${medicine.expiryStatus}-full`}
                className="p-4 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Package className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {medicine.name}
                    </h3>

                    <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-1">
                      {medicine.expiryStatus}
                    </p>

                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      Purchased quantity: {medicine.qtyPurchased}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section className="bg-white dark:bg-[#1a2438] p-5 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-[#1A56A0] dark:text-sky-400" />
          Dashboard Shortcuts
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link
            to="/customer/shop"
            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/60 dark:border-slate-700/30 rounded-xl transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-[#1A56A0] dark:text-sky-400">
                <ShoppingBag className="w-4 h-4" />
              </div>

              <div>
                <span className="block font-semibold text-xs text-slate-900 dark:text-white">
                  Medicine Shop
                </span>

                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  Browse and order medicines
                </span>
              </div>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            to="/customer/reminders"
            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/60 dark:border-slate-700/30 rounded-xl transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 dark:text-purple-400">
                <Bell className="w-4 h-4" />
              </div>

              <div>
                <span className="block font-semibold text-xs text-slate-900 dark:text-white">
                  Medication Reminders
                </span>

                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  Configure daily reminders
                </span>
              </div>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            to="/customer/bills"
            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200/60 dark:border-slate-700/30 rounded-xl transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 dark:text-emerald-400">
                <FileText className="w-4 h-4" />
              </div>

              <div>
                <span className="block font-semibold text-xs text-slate-900 dark:text-white">
                  Invoice History
                </span>

                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  View your purchase records
                </span>
              </div>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default CustomerDashboard;
