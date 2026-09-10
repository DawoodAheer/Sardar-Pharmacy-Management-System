import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  CheckCircle,
  Download,
  FileText,
  LayoutGrid,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Store,
  Trash2,
  User,
  X,
} from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

/*
|--------------------------------------------------------------------------
| Currency
|--------------------------------------------------------------------------
| PharmaDesk uses Pakistani Rupees.
*/
const formatPKR = (value) => {
  const amount = Number(value) || 0;

  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/*
|--------------------------------------------------------------------------
| Safe number
|--------------------------------------------------------------------------
*/
const toNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
};

/*
|--------------------------------------------------------------------------
| Category styles
|--------------------------------------------------------------------------
*/
const CATEGORY_COLORS = {
  'Pain Relief': {
    bg: '#FCEBEB',
    text: '#791F1F',
  },
  Antibiotics: {
    bg: '#E6F1FB',
    text: '#0C447C',
  },
  Antibiotic: {
    bg: '#E6F1FB',
    text: '#0C447C',
  },
  'Cough & Cold': {
    bg: '#EEEDFE',
    text: '#3C3489',
  },
  Allergy: {
    bg: '#FAEEDA',
    text: '#633806',
  },
  Cardiovascular: {
    bg: '#FDE8E8',
    text: '#9B1C1C',
  },
  Cardiology: {
    bg: '#FDE8E8',
    text: '#9B1C1C',
  },
  Diabetes: {
    bg: '#FEF3C7',
    text: '#92400E',
  },
  Vitamins: {
    bg: '#D1FAE5',
    text: '#065F46',
  },
  'Vitamins/Supplements': {
    bg: '#D1FAE5',
    text: '#065F46',
  },
  Antiviral: {
    bg: '#EDE9FE',
    text: '#5B21B6',
  },
  Analgesic: {
    bg: '#FCEBEB',
    text: '#791F1F',
  },
  Antihistamine: {
    bg: '#FAEEDA',
    text: '#633806',
  },
  Other: {
    bg: '#F3F4F6',
    text: '#374151',
  },
};

const getCategoryStyle = (category) => {
  return (
    CATEGORY_COLORS[category] || {
      bg: '#F3F4F6',
      text: '#374151',
    }
  );
};

const CustomerShop = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  /*
  |--------------------------------------------------------------------------
  | Search
  |--------------------------------------------------------------------------
  */
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  /*
  |--------------------------------------------------------------------------
  | Cart
  |--------------------------------------------------------------------------
  */
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);

  /*
  |--------------------------------------------------------------------------
  | Checkout
  |--------------------------------------------------------------------------
  */
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState(
    currentUser?.phone || ''
  );

  const [checkoutError, setCheckoutError] = useState('');
  const [isProcessingCheckout, setIsProcessingCheckout] =
    useState(false);

  const [lastReceipt, setLastReceipt] = useState(null);

  /*
  |--------------------------------------------------------------------------
  | Medicine catalog
  |--------------------------------------------------------------------------
  */
  const {
    data: medicines = [],
    isLoading,
    isError,
    error,
    refetch: refetchMedicines,
  } = useQuery({
    queryKey: [
      'medicines',
      search,
      categoryFilter,
    ],

    queryFn: async () => {
      const params = {};

      const cleanSearch = search.trim();

      if (cleanSearch) {
        params.search = cleanSearch;
      }

      if (categoryFilter) {
        params.category = categoryFilter;
      }

      const { data } = await api.get('/medicines', {
        params,
      });

      return Array.isArray(data) ? data : [];
    },

    enabled: Boolean(currentUser?._id),
  });

  /*
  |--------------------------------------------------------------------------
  | All medicines for categories
  |--------------------------------------------------------------------------
  */
  const {
    data: allMedicines = [],
    isLoading: categoriesLoading,
  } = useQuery({
    queryKey: ['allMedicines'],

    queryFn: async () => {
      const { data } = await api.get('/medicines');

      return Array.isArray(data) ? data : [];
    },

    enabled: Boolean(currentUser?._id),
    staleTime: 60000,
  });

  /*
  |--------------------------------------------------------------------------
  | Categories
  |--------------------------------------------------------------------------
  */
  const fullCategoryList = useMemo(() => {
    const categories = new Set();

    allMedicines.forEach((medicine) => {
      const category = String(
        medicine?.category || ''
      ).trim();

      if (category) {
        categories.add(category);
      }
    });

    return Array.from(categories).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [allMedicines]);

  /*
  |--------------------------------------------------------------------------
  | User information
  |--------------------------------------------------------------------------
  */
  const userName = currentUser?.name || 'Customer';
  const userEmail = currentUser?.email || '';

  const userInitial = userName
    .charAt(0)
    .toUpperCase();

  /*
  |--------------------------------------------------------------------------
  | Cart calculations
  |--------------------------------------------------------------------------
  */
  const cartCount = cart.reduce(
    (sum, item) => sum + toNumber(item.quantity),
    0
  );

  const cartTotal = cart.reduce(
    (sum, item) =>
      sum +
      toNumber(item.price) *
        toNumber(item.quantity),
    0
  );

  /*
  |--------------------------------------------------------------------------
  | Add to cart
  |--------------------------------------------------------------------------
  */
  const handleAddToCart = (medicine) => {
    const stock = toNumber(medicine.quantity);

    if (stock <= 0) {
      return;
    }

    setCart((previousCart) => {
      const existingItem = previousCart.find(
        (item) => item._id === medicine._id
      );

      if (existingItem) {
        if (existingItem.quantity >= stock) {
          return previousCart;
        }

        return previousCart.map((item) =>
          item._id === medicine._id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      }

      return [
        ...previousCart,
        {
          ...medicine,
          quantity: 1,
        },
      ];
    });

    setCartOpen(true);
  };

  /*
  |--------------------------------------------------------------------------
  | Update cart quantity
  |--------------------------------------------------------------------------
  */
  const handleUpdateQuantity = (id, delta) => {
    setCart((previousCart) =>
      previousCart
        .map((item) => {
          if (item._id !== id) {
            return item;
          }

          const newQuantity =
            item.quantity + delta;

          if (newQuantity <= 0) {
            return {
              ...item,
              quantity: 0,
            };
          }

          if (delta > 0) {
            const currentMedicine =
              medicines.find(
                (medicine) =>
                  medicine._id === id
              );

            const stock = toNumber(
              currentMedicine?.quantity
            );

            if (
              currentMedicine &&
              newQuantity > stock
            ) {
              return item;
            }
          }

          return {
            ...item,
            quantity: newQuantity,
          };
        })
        .filter(
          (item) => item.quantity > 0
        )
    );
  };

  /*
  |--------------------------------------------------------------------------
  | Remove item
  |--------------------------------------------------------------------------
  */
  const handleRemoveFromCart = (id) => {
    setCart((previousCart) =>
      previousCart.filter(
        (item) => item._id !== id
      )
    );
  };

  /*
  |--------------------------------------------------------------------------
  | Open checkout
  |--------------------------------------------------------------------------
  */
  const handleOpenCheckout = () => {
    if (cart.length === 0) {
      return;
    }

    setCheckoutError('');
    setCartOpen(false);

    setPhone(
      currentUser?.phone || phone
    );

    setCheckoutOpen(true);
  };

  /*
  |--------------------------------------------------------------------------
  | Close checkout
  |--------------------------------------------------------------------------
  */
  const handleCloseCheckout = () => {
    if (isProcessingCheckout) {
      return;
    }

    setCheckoutOpen(false);
    setCheckoutError('');
  };

  /*
  |--------------------------------------------------------------------------
  | Validate checkout
  |--------------------------------------------------------------------------
  */
  const validateCheckout = () => {
    const cleanAddress = address.trim();
    const cleanPhone = phone.trim();

    if (!cleanPhone) {
      return 'Please enter your contact phone number.';
    }

    if (cleanPhone.length < 7) {
      return 'Please enter a valid contact phone number.';
    }

    if (!cleanAddress) {
      return 'Please enter your delivery address.';
    }

    if (cleanAddress.length < 8) {
      return 'Please enter a more complete delivery address.';
    }

    if (cart.length === 0) {
      return 'Your cart is empty.';
    }

    return '';
  };

  /*
  |--------------------------------------------------------------------------
  | Place customer order
  |--------------------------------------------------------------------------
  */
  const handleCheckoutSubmit = async (event) => {
    event.preventDefault();

    setCheckoutError('');

    const validationError =
      validateCheckout();

    if (validationError) {
      setCheckoutError(validationError);
      return;
    }

    setIsProcessingCheckout(true);

    try {
      /*
       * We keep the existing bill API used by the project.
       *
       * No card information is sent.
       *
       * Cash is used as the default customer-order
       * payment method because online card processing
       * is not implemented in this project.
       */
      const payload = {
        customerId: currentUser?._id,
        customerPhone: phone.trim(),
        customerName: userName,
        shippingAddress: address.trim(),
        paymentMethod: 'Cash',
        discount: 0,

        items: cart.map((item) => ({
          medicineId: item._id,
          name: item.name,
          quantity: toNumber(item.quantity),
          unitPrice: toNumber(item.price),
        })),
      };

      const { data } = await api.post(
        '/bills',
        payload
      );

      const createdBill =
        data?.bill || data;

      const billId =
        createdBill?._id ||
        data?._id ||
        null;

      const billNumber =
        createdBill?.billNumber ||
        data?.billNumber ||
        billId ||
        'N/A';

      const receiptItems =
        Array.isArray(
          createdBill?.items
        )
          ? createdBill.items
          : cart.map((item) => ({
              medicineId: item._id,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.price,
            }));

      const totalFromServer =
        createdBill?.total ??
        data?.total;

      const finalTotal =
        totalFromServer !== undefined
          ? toNumber(totalFromServer)
          : cartTotal;

      setLastReceipt({
        id: billId,
        billNumber,
        date:
          createdBill?.createdAt ||
          data?.createdAt ||
          new Date().toISOString(),

        items: receiptItems,

        subtotal:
          createdBill?.subtotal ??
          cartTotal,

        discount:
          createdBill?.discount ??
          0,

        total: finalTotal,

        shippingAddress:
          address.trim(),

        phone: phone.trim(),

        paymentMethod:
          createdBill?.paymentMethod ||
          data?.paymentMethod ||
          'Cash',
      });

      /*
       * Clear cart after successful order.
       */
      setCart([]);

      /*
       * Close checkout and show confirmation.
       */
      setCheckoutOpen(false);
      setCheckoutSuccess(true);

      /*
       * Refresh inventory because the order
       * should reduce medicine stock on the backend.
       */
      await queryClient.invalidateQueries({
        queryKey: ['medicines'],
      });

      await queryClient.invalidateQueries({
        queryKey: ['allMedicines'],
      });

      await queryClient.invalidateQueries({
        queryKey: ['bills'],
      });

      await queryClient.invalidateQueries({
        queryKey: [
          'bills',
          currentUser?._id,
        ],
      });

      /*
       * Clear checkout form.
       */
      setAddress('');
      setCheckoutError('');
    } catch (checkoutRequestError) {
      console.error(
        'Customer order error:',
        checkoutRequestError
      );

      setCheckoutError(
        checkoutRequestError?.response?.data
          ?.message ||
          checkoutRequestError?.message ||
          'Order could not be placed. Please try again.'
      );
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Download PDF
  |--------------------------------------------------------------------------
  */
  const handleDownloadPDF = async (
    billId,
    billNumber
  ) => {
    if (!billId) {
      return;
    }

    try {
      const response = await api.get(
        `/bills/${billId}/pdf`,
        {
          responseType: 'blob',
        }
      );

      const blob = new Blob(
        [response.data],
        {
          type: 'application/pdf',
        }
      );

      const objectUrl =
        window.URL.createObjectURL(blob);

      const link =
        document.createElement('a');

      link.href = objectUrl;

      link.download =
        `invoice-${billNumber || billId}.pdf`;

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(
        objectUrl
      );
    } catch (downloadError) {
      console.error(
        'PDF download error:',
        downloadError
      );

      setCheckoutError(
        'Failed to download the invoice PDF.'
      );
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Navigation
  |--------------------------------------------------------------------------
  */
  const navLinks = [
    {
      name: 'Dashboard',
      path: '/customer/dashboard',
      icon: LayoutGrid,
    },
    {
      name: 'Medicine Shop',
      path: '/customer/shop',
      icon: Store,
    },
    {
      name: 'Invoice History',
      path: '/customer/bills',
      icon: FileText,
    },
    {
      name: 'Medication Reminders',
      path: '/customer/reminders',
      icon: Bell,
    },
    {
      name: 'My Profile',
      path: '/customer/profile',
      icon: User,
    },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans antialiased text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      {/* =================================================
          DESKTOP SIDEBAR
      ================================================= */}
      <aside className="hidden h-full w-[210px] shrink-0 flex-col justify-between border-r border-slate-200 bg-white p-4 md:flex dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="mb-6 flex items-center gap-2.5 border-b border-slate-100 pb-5 dark:border-slate-800">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-xs font-extrabold text-white shadow-sm shadow-blue-600/20">
              Rx
            </div>

            <div className="leading-none">
              <span className="block text-[12px] font-extrabold uppercase tracking-tight text-slate-900 dark:text-white">
                Sardar
              </span>

              <span className="block text-[12px] font-extrabold uppercase tracking-tight text-blue-600 dark:text-blue-400">
                Pharmacy
              </span>
            </div>
          </div>

          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Menu
          </p>

          <nav className="space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;

              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {link.name}
                  </span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />

          <p className="text-[10px] font-semibold leading-4">
            Secure customer shopping
          </p>
        </div>
      </aside>

      {/* =================================================
          MOBILE NAVIGATION
      ================================================= */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-slate-200 bg-white px-1 shadow-lg md:hidden dark:border-slate-800 dark:bg-slate-900">
        {navLinks.map((link) => {
          const Icon = link.icon;

          const shortName =
            link.name ===
            'Medication Reminders'
              ? 'Reminders'
              : link.name ===
                  'Invoice History'
                ? 'Bills'
                : link.name ===
                    'My Profile'
                  ? 'Profile'
                  : link.name ===
                      'Medicine Shop'
                    ? 'Shop'
                    : 'Dashboard';

          return (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) =>
                `flex h-full flex-1 flex-col items-center justify-center py-1 text-[9px] font-semibold ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-400'
                }`
              }
            >
              <Icon className="mb-1 h-4 w-4" />

              <span className="max-w-[70px] truncate">
                {shortName}
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* =================================================
          MAIN
      ================================================= */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 dark:text-white">
                Medicine Marketplace
              </h1>

              <p className="mt-0.5 truncate text-[11px] text-slate-400">
                Browse medicines and place pharmacy orders
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="max-w-[160px] truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                  {userName}
                </p>

                <p className="max-w-[190px] truncate text-[10px] text-slate-400">
                  {userEmail}
                </p>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {userInitial}
              </div>

              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"
              >
                <ShoppingCart className="h-4 w-4" />
                <span className="hidden sm:inline">
                  My Cart
                </span>

                {cartCount > 0 && (
                  <span className="flex min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 space-y-5 overflow-y-auto p-5 pb-24 md:pb-5">
          {/* Search */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="search"
                placeholder="Search medicine, generic name or manufacturer..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div className="flex gap-2">
              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(
                    event.target.value
                  )
                }
                disabled={categoriesLoading}
                className="w-full min-w-[180px] rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="">
                  All Categories
                </option>

                {fullCategoryList.map(
                  (category) => (
                    <option
                      key={category}
                      value={category}
                    >
                      {category}
                    </option>
                  )
                )}
              </select>

              <button
                type="button"
                onClick={() =>
                  refetchMedicines()
                }
                className="rounded-xl border border-slate-200 bg-white px-3 text-slate-500 transition hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                aria-label="Refresh medicine catalog"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategoryFilter('')}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${
                categoryFilter === ''
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
              }`}
            >
              All
            </button>

            {fullCategoryList.map(
              (category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() =>
                    setCategoryFilter(
                      category
                    )
                  }
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${
                    categoryFilter ===
                    category
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                  }`}
                >
                  {category}
                </button>
              )
            )}
          </div>

          {/* Catalog */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />

              <p className="mt-3 text-xs text-slate-400">
                Loading medicine catalog...
              </p>
            </div>
          ) : isError ? (
            <div className="py-20 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-red-400" />

              <p className="mt-3 text-sm font-bold text-red-600 dark:text-red-400">
                Failed to load medicines
              </p>

              <p className="mt-1 text-xs text-slate-400">
                {error?.message ||
                  'Please try again.'}
              </p>

              <button
                type="button"
                onClick={() =>
                  refetchMedicines()
                }
                className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white"
              >
                Try Again
              </button>
            </div>
          ) : medicines.length === 0 ? (
            <div className="py-20 text-center">
              <Package className="mx-auto h-9 w-9 text-slate-300 dark:text-slate-700" />

              <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                No medicines found
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Try another search or category.
              </p>

              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCategoryFilter('');
                }}
                className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
              {medicines.map((medicine) => {
                const stock = toNumber(
                  medicine.quantity
                );

                const price = toNumber(
                  medicine.price
                );

                const isLowStock =
                  stock > 0 && stock <= 10;

                const categoryStyle =
                  getCategoryStyle(
                    medicine.category
                  );

                return (
                  <div
                    key={medicine._id}
                    className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="rounded-full px-2 py-1 text-[9px] font-bold uppercase"
                        style={{
                          backgroundColor:
                            categoryStyle.bg,
                          color:
                            categoryStyle.text,
                        }}
                      >
                        {medicine.category ||
                          'Other'}
                      </span>

                      <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                        <CheckCircle className="h-3 w-3" />
                        Verified
                      </span>
                    </div>

                    <h3
                      className="mt-3 truncate text-sm font-bold text-slate-900 dark:text-white"
                      title={medicine.name}
                    >
                      {medicine.name}
                    </h3>

                    <p
                      className="mt-1 truncate text-[11px] font-medium italic text-blue-600 dark:text-blue-400"
                      title={medicine.genericName}
                    >
                      {medicine.genericName ||
                        'Generic information unavailable'}
                    </p>

                    <div className="mt-4 flex-1 space-y-2 text-[11px]">
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-400">
                          Manufacturer
                        </span>

                        <span className="max-w-[120px] truncate font-semibold text-slate-700 dark:text-slate-300">
                          {medicine.manufacturer ||
                            'N/A'}
                        </span>
                      </div>

                      <div className="flex justify-between gap-3">
                        <span className="text-slate-400">
                          Rack
                        </span>

                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {medicine.rackLocation ||
                            'Not assigned'}
                        </span>
                      </div>

                      <div className="flex justify-between gap-3">
                        <span className="text-slate-400">
                          Stock
                        </span>

                        {stock === 0 ? (
                          <span className="font-bold text-red-600 dark:text-red-400">
                            Out of stock
                          </span>
                        ) : isLowStock ? (
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            {stock} — Low
                          </span>
                        ) : (
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {stock}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="my-4 border-t border-slate-100 dark:border-slate-800" />

                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Unit Price
                        </p>

                        <p className="mt-1 text-base font-extrabold text-slate-900 dark:text-white">
                          {formatPKR(price)}
                        </p>
                      </div>

                      {stock === 0 ? (
                        <span className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-2 text-[10px] font-bold text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                          Unavailable
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            handleAddToCart(
                              medicine
                            )
                          }
                          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-[11px] font-bold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* =================================================
          CART DRAWER
      ================================================= */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close cart"
            onClick={() => setCartOpen(false)}
            className="absolute inset-0 h-full w-full"
          />

          <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />

                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Your Cart
                  </h2>
                </div>

                <p className="mt-1 text-[11px] text-slate-400">
                  {cartCount} item
                  {cartCount === 1 ? '' : 's'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close cart"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <ShoppingCart className="h-10 w-10 text-slate-200 dark:text-slate-700" />

                  <p className="mt-4 text-sm font-bold text-slate-700 dark:text-slate-200">
                    Cart is empty
                  </p>

                  <p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">
                    Add medicines from the shop to continue.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item._id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                    >
                      <div className="flex justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                            {item.name}
                          </p>

                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {item.category ||
                              'Other'}
                          </p>

                          <p className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400">
                            {formatPKR(
                              item.price
                            )}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveFromCart(
                              item._id
                            )
                          }
                          className="self-start rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-slate-400">
                          Quantity
                        </span>

                        <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateQuantity(
                                item._id,
                                -1
                              )
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>

                          <span className="w-9 text-center text-xs font-bold text-slate-900 dark:text-white">
                            {item.quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateQuantity(
                                item._id,
                                1
                              )
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-xs dark:border-slate-700">
                        <span className="text-slate-400">
                          Line total
                        </span>

                        <span className="font-bold text-slate-900 dark:text-white">
                          {formatPKR(
                            toNumber(
                              item.price
                            ) *
                              toNumber(
                                item.quantity
                              )
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Grand Total
                  </span>

                  <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
                    {formatPKR(cartTotal)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={
                    handleOpenCheckout
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Continue to Order
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* =================================================
          ORDER CHECKOUT
      ================================================= */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            {/* Header */}
            <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />

                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Place Pharmacy Order
                    </h2>
                  </div>

                  <p className="mt-1 text-xs text-slate-400">
                    Enter delivery details and confirm your medicines.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    handleCloseCheckout
                  }
                  disabled={
                    isProcessingCheckout
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
                  aria-label="Close checkout"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[78vh] overflow-y-auto p-6">
              {checkoutError && (
                <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

                  <span>{checkoutError}</span>
                </div>
              )}

              <form
                onSubmit={
                  handleCheckoutSubmit
                }
                className="space-y-5"
              >
                {/* Customer */}
                <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600 dark:bg-slate-900 dark:text-blue-400">
                      <User className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                        Customer
                      </p>

                      <p className="mt-0.5 truncate text-sm font-bold text-slate-900 dark:text-white">
                        {userName}
                      </p>

                      <p className="mt-0.5 truncate text-[10px] text-slate-500 dark:text-slate-400">
                        {userEmail}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label
                    htmlFor="order-phone"
                    className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-200"
                  >
                    Contact phone number
                  </label>

                  <input
                    id="order-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    value={phone}
                    onChange={(event) =>
                      setPhone(
                        event.target.value
                      )
                    }
                    placeholder="+92 3XX XXXXXXX"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-800"
                  />
                </div>

                {/* Address */}
                <div>
                  <label
                    htmlFor="order-address"
                    className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-200"
                  >
                    Delivery address
                  </label>

                  <textarea
                    id="order-address"
                    required
                    rows={3}
                    value={address}
                    onChange={(event) =>
                      setAddress(
                        event.target.value
                      )
                    }
                    placeholder="House/Flat, Street, Area, City"
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-800"
                  />
                </div>

                {/* Order summary */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      Order Summary
                    </p>
                  </div>

                  <div className="max-h-36 space-y-2 overflow-y-auto p-4">
                    {cart.map((item) => (
                      <div
                        key={item._id}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="min-w-0 truncate text-slate-500 dark:text-slate-400">
                          {item.name} ×{' '}
                          {item.quantity}
                        </span>

                        <span className="shrink-0 font-bold text-slate-800 dark:text-slate-200">
                          {formatPKR(
                            toNumber(
                              item.price
                            ) *
                              toNumber(
                                item.quantity
                              )
                          )}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        Total
                      </span>

                      <span className="text-lg font-extrabold text-blue-600 dark:text-blue-400">
                        {formatPKR(cartTotal)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment notice */}
                <div className="flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-[10px] leading-4 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />

                  <span>
                    No card information is required. This order uses the
                    project&apos;s existing pharmacy billing flow.
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={
                      handleCloseCheckout
                    }
                    disabled={
                      isProcessingCheckout
                    }
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      isProcessingCheckout ||
                      cart.length === 0
                    }
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isProcessingCheckout ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Placing Order...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Place Order
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          ORDER SUCCESS
      ================================================= */}
      {checkoutSuccess && lastReceipt && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-7 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                    <CheckCircle className="h-7 w-7" />
                  </div>

                  <h2 className="text-2xl font-extrabold">
                    Order Placed
                  </h2>

                  <p className="mt-1 text-sm text-emerald-50">
                    Your pharmacy order has been submitted successfully.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setCheckoutSuccess(false)
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20"
                  aria-label="Close order confirmation"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Order / Bill
                  </p>

                  <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                    {lastReceipt.billNumber}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Payment
                  </p>

                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                    {lastReceipt.paymentMethod}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Delivery Details
                </p>

                <p className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-100">
                  {userName}
                </p>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {lastReceipt.phone}
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {lastReceipt.shippingAddress}
                </p>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Medicines Ordered
                  </p>

                  <span className="text-[10px] font-semibold text-slate-400">
                    {lastReceipt.items.length} item
                    {lastReceipt.items.length ===
                    1
                      ? ''
                      : 's'}
                  </span>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800">
                  {lastReceipt.items.map(
                    (item, index) => {
                      const itemPrice =
                        toNumber(
                          item.unitPrice
                        );

                      const itemQuantity =
                        toNumber(
                          item.quantity
                        );

                      return (
                        <div
                          key={
                            item.medicineId ||
                            item._id ||
                            `${item.name}-${index}`
                          }
                          className="flex items-center justify-between gap-3 border-b border-slate-100 p-3.5 last:border-b-0 dark:border-slate-800"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                              {item.name ||
                                'Medicine'}
                            </p>

                            <p className="mt-0.5 text-[10px] text-slate-400">
                              {itemQuantity} ×{' '}
                              {formatPKR(
                                itemPrice
                              )}
                            </p>
                          </div>

                          <span className="shrink-0 text-xs font-bold text-slate-800 dark:text-slate-100">
                            {formatPKR(
                              itemPrice *
                                itemQuantity
                            )}
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Subtotal</span>

                  <span className="font-semibold">
                    {formatPKR(
                      lastReceipt.subtotal
                    )}
                  </span>
                </div>

                {toNumber(
                  lastReceipt.discount
                ) > 0 && (
                  <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                    <span>Discount</span>

                    <span className="font-semibold">
                      -{' '}
                      {formatPKR(
                        lastReceipt.discount
                      )}
                    </span>
                  </div>
                )}

                <div className="flex items-end justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Total
                  </span>

                  <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                    {formatPKR(
                      lastReceipt.total
                    )}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                {lastReceipt.id && (
                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadPDF(
                        lastReceipt.id,
                        lastReceipt.billNumber
                      )
                    }
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Download className="h-4 w-4" />
                    Download Receipt
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setCheckoutSuccess(false);
                    setLastReceipt(null);
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
                >
                  <Store className="h-4 w-4" />
                  Continue Shopping
                </button>
              </div>

              <p className="text-center text-[10px] leading-4 text-slate-400">
                Your order has been recorded through the pharmacy billing
                system.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerShop;