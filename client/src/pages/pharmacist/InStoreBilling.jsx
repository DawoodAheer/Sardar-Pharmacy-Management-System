import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  Minus,
  Package,
  Plus,
  Receipt,
  Search,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  User,
  Wallet,
  X,
} from 'lucide-react';
import api from '../../utils/api';

const SEARCH_DEBOUNCE_MS = 350;

const PAYMENT_METHODS = [
  {
    value: 'Cash',
    label: 'Cash',
    icon: Banknote,
  },
  { value: 'Card', label: 'Card', icon: CreditCard },
  { value: 'UPI', label: 'Online / UPI', icon: Wallet },
];

const formatPKR = (amount) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const formatDate = (date) => {
  if (!date) {
    return 'N/A';
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'N/A';
  }

  return parsedDate.toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (date) => {
  if (!date) {
    return 'N/A';
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'N/A';
  }

  return parsedDate.toLocaleString('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const getExpiryMeta = (status) => {
  switch (status) {
    case 'EXPIRED':
      return {
        label: 'Expired',
        className:
          'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900/60',
      };

    case 'CRITICAL':
      return {
        label: 'Critical',
        className:
          'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900/60',
      };

    case 'WARNING':
      return {
        label: 'Warning',
        className:
          'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60',
      };

    case 'CAUTION':
      return {
        label: 'Caution',
        className:
          'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-300 dark:ring-yellow-900/50',
      };

    default:
      return {
        label: 'Safe',
        className:
          'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900/50',
      };
  }
};

const InStoreBilling = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [confirmedBill, setConfirmedBill] = useState(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const [cartItems, setCartItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [discount, setDiscount] = useState('');
  const [billLoading, setBillLoading] = useState(false);
  const [billError, setBillError] = useState('');
  const [cartNotice, setCartNotice] = useState('');

  /*
   * Debounce medicine search.
   *
   * The state update happens inside setTimeout rather than directly
   * inside the effect, which avoids the React set-state-in-effect lint
   * violation while still giving us a smooth search experience.
   */
  useEffect(() => {
    const normalizedSearch = searchQuery.trim();

    const timeoutId = setTimeout(() => {
      setDebouncedSearch(normalizedSearch);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  /*
   * Medicine search is handled by React Query instead of manually
   * storing searchResults and searchLoading state.
   */
  const {
    data: searchResults = [],
    isFetching: searchLoading,
    isError: searchIsError,
  } = useQuery({
    queryKey: ['instore-medicine-search', debouncedSearch],
    queryFn: async () => {
      const { data } = await api.get(
        `/medicines?search=${encodeURIComponent(debouncedSearch)}`
      );

      if (Array.isArray(data)) {
        return data;
      }

      if (Array.isArray(data?.medicines)) {
        return data.medicines;
      }

      if (Array.isArray(data?.data)) {
        return data.data;
      }

      return [];
    },
    enabled: debouncedSearch.length > 0,
    staleTime: 30000,
    gcTime: 120000,
  });

  const handleStartNewBill = () => {
    setConfirmedBill(null);
    setCartItems([]);
    setSearchQuery('');
    setDebouncedSearch('');
    setBillError('');
    setCartNotice('');
    setCustomerName('');
    setCustomerPhone('');
    setDiscount('');
    setPaymentMethod('Cash');
  };

  const subtotal = cartItems.reduce((sum, item) => sum + toNumber(item.unitPrice) * toNumber(item.quantity), 0);
  const safeDiscount = Math.min(Math.max(0, toNumber(discount)), subtotal);
  const total = Math.max(0, subtotal - safeDiscount);
  const totalItems = cartItems.reduce((sum, item) => sum + toNumber(item.quantity), 0);
  const hasExpiredItems = cartItems.some((item) => item.expiryStatus === 'EXPIRED');

  const handleAddToCart = (medicine) => {
    if (medicine.expiryStatus === 'EXPIRED' || Number(medicine.quantity) <= 0) return;
    setCartItems((current) => {
      const existing = current.find((item) => item.medicineId === medicine._id);
      if (existing) return current.map((item) => item.medicineId === medicine._id ? { ...item, quantity: Math.min(item.stock, item.quantity + 1) } : item);
      return [...current, {
        medicineId: medicine._id, name: medicine.name, quantity: 1,
        unitPrice: toNumber(medicine.price), purchasePrice: toNumber(medicine.purchasePrice),
        stock: toNumber(medicine.quantity), expiryStatus: medicine.expiryStatus,
        expiryDate: medicine.expiryDate, rackLocation: medicine.rackLocation || '',
      }];
    });
    setCartNotice(`${medicine.name} added to this bill.`);
    setSearchQuery('');
  };

  const updateQuantity = (medicineId, quantity) => setCartItems((current) => current
    .map((item) => item.medicineId === medicineId ? { ...item, quantity: Math.min(item.stock, Math.max(0, Math.floor(quantity))) } : item)
    .filter((item) => item.quantity > 0));
  const updatePrice = (medicineId, unitPrice) => setCartItems((current) => current.map((item) => item.medicineId === medicineId ? { ...item, unitPrice: Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : item.unitPrice } : item));
  const handleRemoveFromCart = (medicineId) => setCartItems((current) => current.filter((item) => item.medicineId !== medicineId));
  const handleDiscountChange = (event) => {
    const value = event.target.value;
    if (value === '') return setDiscount('');
    const amount = Number(value);
    setDiscount(Number.isFinite(amount) ? String(Math.min(Math.max(0, amount), subtotal)) : '');
  };

  const handleConfirmBill = async () => {
    if (!cartItems.length || hasExpiredItems || billLoading) return;
    setBillLoading(true);
    setBillError('');
    try {
      const { data } = await api.post('/bills/instore', {
        customerName, customerPhone, discount: safeDiscount, paymentMethod,
        items: cartItems.map(({ medicineId, quantity, unitPrice }) => ({ medicineId, quantity, salePrice: unitPrice })),
      });
      const createdBill = data?.bill || data;
      setConfirmedBill(createdBill);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['medicines'] }),
        queryClient.invalidateQueries({ queryKey: ['bills'] }),
        queryClient.invalidateQueries({ queryKey: ['salesSummary'] }),
        queryClient.invalidateQueries({ queryKey: ['profitSummary'] }),
      ]);
    } catch (error) {
      setBillError(error?.response?.data?.message || 'Could not complete the bill. Refresh stock and try again.');
    } finally { setBillLoading(false); }
  };

    return (
    <div className="min-h-screen bg-[var(--page-bg)] px-4 py-5 font-sans text-[var(--text-body)] sm:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-gradient-to-r from-teal-700 to-emerald-600 p-5 shadow-sm text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                  Counter Billing
                </h1>

                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-50 ring-1 ring-white/20">
                  POS Active
                </span>
              </div>

              <p className="mt-1 text-xs text-emerald-50/90">
                Create and complete an in-store pharmacy sale.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-white shadow-sm backdrop-blur-sm">
            <User className="h-4 w-4 text-emerald-100" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-50/80">
                Customer
              </p>
              <p className="max-w-[220px] truncate text-xs font-bold text-white">
                {customerName || 'Guest Customer'}
              </p>
            </div>
            <span className="mx-1 h-6 w-px bg-white/30" />
            <p className="text-xs font-medium text-emerald-50/90">
              {customerPhone}
            </p>
          </div>
        </div>

        {/* Main layout */}
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Left side */}
          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              {/* Search */}
              <div className="p-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <label
                      htmlFor="medicine-search"
                      className="text-sm font-bold text-slate-800 dark:text-slate-100"
                    >
                      Add medicines
                    </label>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Search by medicine name, generic name or batch number.
                    </p>
                  </div>

                  <div className="hidden items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400 sm:flex">
                    <Package className="h-3.5 w-3.5" />
                    Stock-aware
                  </div>
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    id="medicine-search"
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search medicines..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-12 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-blue-400 dark:focus:bg-slate-800"
                  />

                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setDebouncedSearch('');
                      }}
                      className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                      aria-label="Clear medicine search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Search results */}
                {debouncedSearch && (
                  <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/30 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/20">
                    {searchLoading && (
                      <div className="flex items-center justify-center gap-2 px-4 py-6 text-xs text-slate-500 dark:text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Searching medicines...
                      </div>
                    )}

                    {!searchLoading && searchIsError && (
                      <div className="flex items-start gap-2 px-4 py-5 text-xs text-red-600 dark:text-red-300">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                          Medicine search failed. Please check the connection
                          and try again.
                        </span>
                      </div>
                    )}

                    {!searchLoading &&
                      !searchIsError &&
                      searchResults.length === 0 && (
                        <div className="px-4 py-7 text-center">
                          <Package className="mx-auto h-7 w-7 text-slate-300 dark:text-slate-600" />
                          <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                            No medicines found
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Try another medicine or generic name.
                          </p>
                        </div>
                      )}

                    {!searchLoading &&
                      !searchIsError &&
                      searchResults.length > 0 &&
                      searchResults.map((medicine) => {
                        const expiry = getExpiryMeta(
                          medicine.expiryStatus
                        );
                        const isExpired =
                          medicine.expiryStatus === 'EXPIRED';
                        const stock = toNumber(medicine.quantity);
                        const price = toNumber(medicine.price);

                        return (
                          <button
                            key={medicine._id}
                            type="button"
                            disabled={isExpired || stock <= 0}
                            onClick={() => handleAddToCart(medicine)}
                            className="flex w-full items-center justify-between gap-4 border-b border-slate-100 p-4 text-left transition last:border-b-0 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:hover:bg-slate-800/70"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                                  {medicine.name}
                                </p>

                                <span
                                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${expiry.className}`}
                                >
                                  {expiry.label}
                                </span>
                              </div>

                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {medicine.genericName || 'Generic name unavailable'}
                              </p>

                              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
                                <span>
                                  Stock:{' '}
                                  <strong className="text-slate-600 dark:text-slate-300">
                                    {stock}
                                  </strong>
                                </span>

                                <span>
                                  Rack:{' '}
                                  <strong className="text-slate-600 dark:text-slate-300">
                                    {medicine.rackLocation || 'Not assigned'}
                                  </strong>
                                </span>

                                <span>
                                  Exp:{' '}
                                  <strong className="text-slate-600 dark:text-slate-300">
                                    {formatDate(medicine.expiryDate)}
                                  </strong>
                                </span>
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                {formatPKR(price)}
                              </p>

                              <span
                                className={`mt-2 inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-bold ${
                                  isExpired
                                    ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300'
                                    : stock <= 0
                                      ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                      : 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
                                }`}
                              >
                                {isExpired
                                  ? 'Unavailable'
                                  : stock <= 0
                                    ? 'Out of stock'
                                    : 'Add'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            {/* Cart */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                    <ShoppingCart className="h-4 w-4" />
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      Checkout Cart
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      {totalItems} item{totalItems === 1 ? '' : 's'} selected
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {formatPKR(subtotal)}
                </div>
              </div>

              {cartItems.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                    <ShoppingCart className="h-6 w-6" />
                  </div>

                  <h3 className="mt-4 text-sm font-bold text-slate-700 dark:text-slate-200">
                    Cart is empty
                  </h3>

                  <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-slate-400">
                    Search for a medicine above and add it to the customer&apos;s
                    bill.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {cartItems.map((item) => {
                    const expiry = getExpiryMeta(item.expiryStatus);
                    const lineTotal = item.unitPrice * item.quantity;

                    return (
                      <div
                        key={item.medicineId}
                        className="p-4 transition hover:bg-slate-50/70 dark:hover:bg-slate-800/30 sm:p-5"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                                {item.name}
                              </p>

                              <span
                                className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${expiry.className}`}
                              >
                                {expiry.label}
                              </span>
                            </div>

                            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
                              <span>
                                Purchase: <strong className="text-slate-600 dark:text-slate-300">{formatPKR(item.purchasePrice || 0)}</strong>
                              </span>
                              <span>
                                Sale Price:{' '}
                                <input
                                  type="number"
                                  min="0"
                                  value={item.unitPrice}
                                  onChange={(e) => updatePrice(item.medicineId, Number(e.target.value))}
                                  className="w-16 ml-1 px-1 py-0.5 text-[10px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </span>

                              <span>
                                Stock:{' '}
                                <strong className="text-slate-600 dark:text-slate-300">
                                  {item.stock}
                                </strong>
                              </span>

                              <span>
                                Exp:{' '}
                                <strong className="text-slate-600 dark:text-slate-300">
                                  {formatDate(item.expiryDate)}
                                </strong>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-4 sm:justify-end">
                            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuantity(
                                    item.medicineId,
                                    item.quantity - 1
                                  )
                                }
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-white"
                                aria-label={`Decrease ${item.name} quantity`}
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>

                              <span className="w-8 text-center text-xs font-bold text-slate-800 dark:text-slate-100">
                                {item.quantity}
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  updateQuantity(
                                    item.medicineId,
                                    item.quantity + 1
                                  )
                                }
                                disabled={item.quantity >= item.stock}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-slate-700 dark:hover:text-white"
                                aria-label={`Increase ${item.name} quantity`}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="min-w-[90px] text-right">
                              <p className="text-sm font-bold text-slate-900 dark:text-white">
                                {formatPKR(lineTotal)}
                              </p>

                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveFromCart(item.medicineId)
                                }
                                className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 transition hover:text-red-500"
                              >
                                <Trash2 className="h-3 w-3" />
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {cartNotice && (
                <div className="border-t border-amber-100 bg-amber-50 px-5 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <div className="flex items-start gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{cartNotice}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right side */}
          <aside className="space-y-5 lg:sticky lg:top-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Bill Summary
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Review payment before confirmation.
                  </p>
                </div>

                <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>

              <div className="space-y-5 pt-5">
                {/* Customer Info */}
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">Payment method
                  <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
                    {PAYMENT_METHODS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>

                {/* Confirm & Print Bill - AT THE TOP */}
                <button
                  type="button"
                  onClick={handleConfirmBill}
                  disabled={
                    cartItems.length === 0 ||
                    billLoading ||
                    hasExpiredItems
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {billLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing payment...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Confirm & Print Bill
                    </>
                  )}
                </button>

                {billError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{billError}</span>
                    </div>
                  </div>
                )}

                {/* Discount */}
                <div>
                  <label
                    htmlFor="discount"
                    className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-200"
                  >
                    Discount
                  </label>

                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                      Rs.
                    </span>

                    <input
                      id="discount"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max={subtotal}
                      step="0.01"
                      value={discount}
                      onChange={handleDiscountChange}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-right text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-800"
                    />
                  </div>

                  <p className="mt-1.5 text-[10px] text-slate-400">
                    Maximum discount: {formatPKR(subtotal)}
                  </p>
                </div>

                {/* Items */}
                {cartItems.length > 0 && (
                  <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Items
                    </p>

                    <div className="max-h-40 space-y-2.5 overflow-y-auto pr-1">
                      {cartItems.map((item) => (
                        <div
                          key={item.medicineId}
                          className="flex items-start justify-between gap-3 text-xs"
                        >
                          <span className="min-w-0 truncate text-slate-500 dark:text-slate-400">
                            {item.name} × {item.quantity}
                          </span>

                          <span className="shrink-0 font-semibold text-slate-700 dark:text-slate-200">
                            {formatPKR(
                              item.unitPrice * item.quantity
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Totals */}
                <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Subtotal</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {formatPKR(subtotal)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Discount</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      - {formatPKR(safeDiscount)}
                    </span>
                  </div>

                  <div className="rounded-2xl bg-blue-600 p-4 text-white shadow-lg shadow-blue-600/20">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-100">
                          Total Payable
                        </p>
                        <p className="mt-1 text-2xl font-bold tracking-tight">
                          {formatPKR(total)}
                        </p>
                      </div>

                      <Receipt className="h-7 w-7 text-blue-200" />
                    </div>
                  </div>
                </div>
                {hasExpiredItems && (
                  <p className="text-center text-[10px] font-semibold text-red-600 dark:text-red-400">
                    Remove expired medicines before confirming the bill.
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Success Modal */}
      {confirmedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bill-success-title"
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-7 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>

                  <h2
                    id="bill-success-title"
                    className="text-2xl font-bold"
                  >
                    Payment Completed
                  </h2>

                  <p className="mt-1.5 text-sm text-emerald-50">
                    The in-store bill has been created successfully.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setConfirmedBill(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
                  aria-label="Close bill confirmation"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/60">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Bill number
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">
                    {confirmedBill.billNumber || 'N/A'}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/60">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Payment
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">
                    {confirmedBill.paymentMethod || paymentMethod}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Customer
                    </p>

                    <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">
                      {confirmedBill.customerName || 'Guest'}
                    </p>

                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {confirmedBill.customerPhone || customerPhone}
                    </p>
                  </div>

                  <p className="text-right text-[10px] text-slate-400">
                    {formatDateTime(confirmedBill.createdAt)}
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Purchased medicines
                  </p>

                  <span className="text-[10px] font-semibold text-slate-400">
                    {confirmedBill.items?.length || 0} line items
                  </span>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800">
                  {(confirmedBill.items || []).map((item, index) => {
                    const itemPrice = toNumber(item.unitPrice);
                    const itemQuantity = toNumber(item.quantity);

                    return (
                      <div
                        key={`${item.medicineId || item.name}-${index}`}
                        className="flex items-center justify-between gap-4 border-b border-slate-100 p-3.5 last:border-b-0 dark:border-slate-800"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                            {item.name}
                          </p>

                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {itemQuantity} × {formatPKR(itemPrice)}
                          </p>
                        </div>

                        <p className="shrink-0 text-xs font-bold text-slate-800 dark:text-slate-100">
                          {formatPKR(itemPrice * itemQuantity)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-semibold">
                    {formatPKR(confirmedBill.subtotal)}
                  </span>
                </div>

                {toNumber(confirmedBill.discount) > 0 && (
                  <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                    <span>Discount</span>
                    <span className="font-semibold">
                      - {formatPKR(confirmedBill.discount)}
                    </span>
                  </div>
                )}

                <div className="flex items-end justify-between gap-4 pt-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Total paid
                    </p>
                  </div>

                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatPKR(confirmedBill.total)}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/pharmacist/receipt/${confirmedBill._id}`
                    )
                  }
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-blue-600 px-4 py-3 text-sm font-bold text-blue-600 transition hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-950/30"
                >
                  <Receipt className="h-4 w-4" />
                  View / Print Receipt
                </button>

                <button
                  type="button"
                  onClick={handleStartNewBill}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  New Bill
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InStoreBilling;
