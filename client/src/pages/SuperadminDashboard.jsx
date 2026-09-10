import { useMemo, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle,
  ChevronRight,
  Clock3,
  Eye,
  Loader2,
  Package,
  PackageSearch,
  Pill,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserRound,
  UsersRound,
  UserPlus,
  X,
} from 'lucide-react';

/* =========================================================
   HELPERS
========================================================= */

const getCurrency = (amount = 0) => {
  return `PKR ${Number(amount || 0).toFixed(2)}`;
};

const formatDate = (value) => {
  if (!value) return 'N/A';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (value) => {
  if (!value) return 'N/A';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getArrayFromResponse = (response) => {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.users)) {
    return response.users;
  }

  if (Array.isArray(response?.medicines)) {
    return response.medicines;
  }

  if (Array.isArray(response?.bills)) {
    return response.bills;
  }

  if (Array.isArray(response?.results)) {
    return response.results;
  }

  return [];
};

const getBillDate = (bill) => {
  return (
    bill?.createdAt ||
    bill?.date ||
    bill?.saleDate ||
    bill?.billDate ||
    bill?.updatedAt ||
    null
  );
};

const getBillTotal = (bill) => {
  return Number(
    bill?.totalAmount ??
      bill?.total ??
      bill?.grandTotal ??
      bill?.amount ??
      bill?.netTotal ??
      0
  );
};

const getBillItems = (bill) => {
  if (Array.isArray(bill?.items)) {
    return bill.items;
  }

  if (Array.isArray(bill?.medicines)) {
    return bill.medicines;
  }

  if (Array.isArray(bill?.products)) {
    return bill.products;
  }

  return [];
};

const getItemName = (item) => {
  return (
    item?.medicine?.name ||
    item?.medicine?.medicineName ||
    item?.medicineName ||
    item?.product?.name ||
    item?.productName ||
    item?.name ||
    'Unknown Medicine'
  );
};

const getItemQuantity = (item) => {
  return Number(
    item?.quantity ??
      item?.qty ??
      item?.count ??
      1
  );
};

const getItemPrice = (item) => {
  return Number(
    item?.price ??
      item?.unitPrice ??
      item?.sellingPrice ??
      item?.amount ??
      0
  );
};

const getItemTotal = (item) => {
  const explicitTotal =
    item?.total ??
    item?.lineTotal ??
    item?.subtotal ??
    item?.subTotal;

  if (
    explicitTotal !== undefined &&
    explicitTotal !== null
  ) {
    return Number(explicitTotal || 0);
  }

  return (
    getItemQuantity(item) *
    getItemPrice(item)
  );
};

const getCustomerName = (bill) => {
  return (
    bill?.customer?.name ||
    bill?.customer?.fullName ||
    bill?.customerName ||
    bill?.customer?.email ||
    'Walk-in Customer'
  );
};

const getPharmacistName = (bill) => {
  return (
    bill?.pharmacist?.name ||
    bill?.pharmacistName ||
    bill?.createdBy?.name ||
    bill?.user?.name ||
    'Pharmacist'
  );
};

const getMedicineStock = (medicine) => {
  return Number(
    medicine?.stock ??
      medicine?.quantity ??
      medicine?.availableStock ??
      0
  );
};

const getLowStockLimit = (medicine) => {
  return Number(
    medicine?.lowStockThreshold ??
      medicine?.minimumStock ??
      medicine?.reorderLevel ??
      10
  );
};

const getMedicinePrice = (medicine) => {
  return Number(
    medicine?.price ??
      medicine?.sellingPrice ??
      medicine?.unitPrice ??
      medicine?.salePrice ??
      0
  );
};

const getExpiryDate = (medicine) => {
  return (
    medicine?.expiryDate ||
    medicine?.expiry ||
    null
  );
};

const getDaysUntilExpiry = (medicine) => {
  const expiryValue = getExpiryDate(medicine);

  if (!expiryValue) {
    return null;
  }

  const expiry = new Date(expiryValue);
  const today = new Date();

  if (Number.isNaN(expiry.getTime())) {
    return null;
  }

  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const expiryStart = new Date(
    expiry.getFullYear(),
    expiry.getMonth(),
    expiry.getDate()
  );

  return Math.ceil(
    (expiryStart.getTime() -
      todayStart.getTime()) /
      (1000 * 60 * 60 * 24)
  );
};

const startOfToday = () => {
  const now = new Date();

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );
};

const endOfToday = () => {
  const now = new Date();

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  );
};

const startOfCurrentMonth = () => {
  const now = new Date();

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
    0,
    0,
    0,
    0
  );
};

const endOfCurrentMonth = () => {
  const now = new Date();

  return new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
};

const isDateBetween = (
  value,
  start,
  end
) => {
  if (!value) return false;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return (
    date >= start &&
    date <= end
  );
};

/* =========================================================
   STAT CARD
   IMPORTANT:
   Defined OUTSIDE SuperadminDashboard
========================================================= */

const StatCard = ({
  title,
  value,
  description,
  icon: Icon,
  iconWrapperClass,
  valueClass,
  onClick,
  hasNotification = false,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
    >
      {hasNotification && (
        <span className="absolute right-4 top-4 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
          {value}
        </span>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="pr-4">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>

          <p
            className={`mt-2 text-3xl font-bold ${
              valueClass ||
              'text-slate-900 dark:text-white'
            }`}
          >
            {value}
          </p>

          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconWrapperClass}`}
        >
          <Icon size={22} />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <span className="text-xs font-semibold text-slate-500 transition group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-white">
          View details
        </span>

        <ChevronRight
          size={16}
          className="text-slate-400 transition group-hover:translate-x-1"
        />
      </div>
    </button>
  );
};

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function SuperadminDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedView, setSelectedView] =
    useState(null);

  const [searchTerm, setSearchTerm] =
    useState('');

  const [message, setMessage] =
    useState('');

  /* =======================================================
     USERS
  ======================================================= */

  const {
    data: usersResponse,
    isLoading: isUsersLoading,
    isError: isUsersError,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ['superadminUsers'],
    queryFn: async () => {
      const response =
        await api.get('/users');

      return response.data;
    },
  });

  /* =======================================================
     MEDICINES
  ======================================================= */

  const {
    data: medicinesResponse,
    isLoading: isMedicinesLoading,
    isError: isMedicinesError,
    refetch: refetchMedicines,
  } = useQuery({
    queryKey: ['superadminMedicines'],
    queryFn: async () => {
      const response =
        await api.get('/medicines');

      return response.data;
    },
  });

  /* =======================================================
     BILLS
  ======================================================= */

  const {
    data: billsResponse,
    isLoading: isBillsLoading,
    isError: isBillsError,
    refetch: refetchBills,
  } = useQuery({
    queryKey: ['superadminBills'],
    queryFn: async () => {
      const response =
        await api.get('/bills');

      return response.data;
    },
  });

  /* =======================================================
     SALES SUMMARY
  ======================================================= */

  const {
    data: salesSummary,
    isLoading: isSalesLoading,
    isError: isSalesError,
    refetch: refetchSales,
  } = useQuery({
    queryKey: ['superadminSalesSummary'],
    queryFn: async () => {
      const response =
        await api.get(
          '/bills/sales-summary'
        );

      return response.data;
    },
  });

  /* =======================================================
     NORMALIZED DATA
  ======================================================= */

  const users = useMemo(
    () =>
      getArrayFromResponse(
        usersResponse
      ),
    [usersResponse]
  );

  const medicines = useMemo(
    () =>
      getArrayFromResponse(
        medicinesResponse
      ),
    [medicinesResponse]
  );

  const bills = useMemo(
    () =>
      getArrayFromResponse(
        billsResponse
      ),
    [billsResponse]
  );

  /* =======================================================
     USER COUNTS
  ======================================================= */

  const totalUsers =
    users.length;

  const totalSuperadmins =
    users.filter(
      (item) =>
        item?.role === 'superadmin'
    ).length;

  const totalPharmacists =
    users.filter(
      (item) =>
        item?.role === 'pharmacist'
    ).length;

  const totalCustomers =
    users.filter(
      (item) =>
        item?.role === 'customer'
    ).length;

  /* =======================================================
     PHARMACIST REQUESTS
  ======================================================= */

  const pendingPharmacistRequests =
    useMemo(() => {
      return users
        .filter(
          (item) =>
            item?.role ===
              'pharmacist' &&
            item?.accountStatus ===
              'pending'
        )
        .sort(
          (a, b) =>
            new Date(
              b?.createdAt || 0
            ).getTime() -
            new Date(
              a?.createdAt || 0
            ).getTime()
        );
    }, [users]);

  /* =======================================================
     MEDICINE COUNTS
  ======================================================= */

  const totalMedicines =
    medicines.length;

  const lowStockMedicines =
    useMemo(() => {
      return medicines.filter(
        (medicine) => {
          const stock =
            getMedicineStock(
              medicine
            );

          const limit =
            getLowStockLimit(
              medicine
            );

          return stock <= limit;
        }
      );
    }, [medicines]);

  const expiredMedicines =
    useMemo(() => {
      return medicines.filter(
        (medicine) => {
          const daysLeft =
            getDaysUntilExpiry(
              medicine
            );

          return (
            daysLeft !== null &&
            daysLeft < 0
          );
        }
      );
    }, [medicines]);

  const expiringWithin30Days =
    useMemo(() => {
      return medicines
        .filter((medicine) => {
          const daysLeft =
            getDaysUntilExpiry(
              medicine
            );

          return (
            daysLeft !== null &&
            daysLeft >= 0 &&
            daysLeft <= 30
          );
        })
        .sort((a, b) => {
          const aDays =
            getDaysUntilExpiry(a) ??
            99999;

          const bDays =
            getDaysUntilExpiry(b) ??
            99999;

          return (
            aDays - bDays
          );
        });
    }, [medicines]);

  /* =======================================================
     SALES SUMMARY
  ======================================================= */

  const todaySales = Number(
    salesSummary?.today
      ?.totalSales ??
      salesSummary?.today
        ?.sales ??
      salesSummary?.today
        ?.totalAmount ??
      0
  );

  const todayBills =
    Number(
      salesSummary?.today
        ?.totalBills ??
        salesSummary?.today
          ?.bills ??
        0
    );

  const monthlySales = Number(
    salesSummary?.month
      ?.totalSales ??
      salesSummary?.month
        ?.sales ??
      salesSummary?.month
        ?.totalAmount ??
      0
  );

  const monthlyBills =
    Number(
      salesSummary?.month
        ?.totalBills ??
        salesSummary?.month
          ?.bills ??
        0
    );

  /* =======================================================
     TODAY BILLS
  ======================================================= */

  const todayBillsList = useMemo(
    () => {
      return bills
        .filter((bill) =>
          isDateBetween(
            getBillDate(bill),
            startOfToday(),
            endOfToday()
          )
        )
        .sort(
          (a, b) =>
            new Date(
              getBillDate(b) || 0
            ).getTime() -
            new Date(
              getBillDate(a) || 0
            ).getTime()
        );
    },
    [bills]
  );

  /* =======================================================
     MONTHLY BILLS
  ======================================================= */

  const monthlyBillsList =
    useMemo(() => {
      return bills
        .filter((bill) =>
          isDateBetween(
            getBillDate(bill),
            startOfCurrentMonth(),
            endOfCurrentMonth()
          )
        )
        .sort(
          (a, b) =>
            new Date(
              getBillDate(b) || 0
            ).getTime() -
            new Date(
              getBillDate(a) || 0
            ).getTime()
        );
    }, [bills]);

  /* =======================================================
     SOLD MEDICINES
  ======================================================= */

  const aggregateSoldMedicines = (
    billList
  ) => {
    const medicineMap =
      new Map();

    billList.forEach((bill) => {
      const items =
        getBillItems(bill);

      items.forEach((item) => {
        const medicineName =
          getItemName(item);

        const quantity =
          getItemQuantity(item);

        const lineTotal =
          getItemTotal(item);

        const existing =
          medicineMap.get(
            medicineName
          );

        if (existing) {
          existing.quantity +=
            quantity;

          existing.sales +=
            lineTotal;

          existing.orders += 1;
        } else {
          medicineMap.set(
            medicineName,
            {
              medicineName,
              quantity,
              sales: lineTotal,
              orders: 1,
            }
          );
        }
      });
    });

    return Array.from(
      medicineMap.values()
    ).sort(
      (a, b) =>
        b.quantity - a.quantity
    );
  };

  const todaySoldMedicines =
    useMemo(
      () =>
        aggregateSoldMedicines(
          todayBillsList
        ),
      [todayBillsList]
    );

  const monthlySoldMedicines =
    useMemo(
      () =>
        aggregateSoldMedicines(
          monthlyBillsList
        ),
      [monthlyBillsList]
    );

  /* =======================================================
     APPROVE PHARMACIST
  ======================================================= */

  const approvePharmacistMutation =
    useMutation({
      mutationFn: async (
        pharmacistId
      ) => {
        const response =
          await api.put(
            `/users/${pharmacistId}/approve-pharmacist`
          );

        return response.data;
      },

      onSuccess: () => {
        setMessage(
          'Pharmacist approved successfully. The pharmacist can now log in.'
        );

        queryClient.invalidateQueries(
          {
            queryKey: [
              'superadminUsers',
            ],
          }
        );
      },

      onError: (error) => {
        setMessage(
          error?.response?.data
            ?.message ||
            'Unable to approve pharmacist.'
        );
      },
    });

  /* =======================================================
     UPDATE ROLE
  ======================================================= */

  const updateRoleMutation =
    useMutation({
      mutationFn: async ({
        userId,
        role,
      }) => {
        const response =
          await api.put(
            `/users/${userId}/role`,
            { role }
          );

        return response.data;
      },

      onSuccess: () => {
        setMessage(
          'User role updated successfully.'
        );

        queryClient.invalidateQueries(
          {
            queryKey: [
              'superadminUsers',
            ],
          }
        );
      },

      onError: (error) => {
        setMessage(
          error?.response?.data
            ?.message ||
            'Unable to update user role.'
        );
      },
    });

  /* =======================================================
     DELETE USER
  ======================================================= */

  const deleteUserMutation =
    useMutation({
      mutationFn: async (
        userId
      ) => {
        const response =
          await api.delete(
            `/users/${userId}`
          );

        return response.data;
      },

      onSuccess: () => {
        setMessage(
          'User deleted successfully.'
        );

        queryClient.invalidateQueries(
          {
            queryKey: [
              'superadminUsers',
            ],
          }
        );
      },

      onError: (error) => {
        setMessage(
          error?.response?.data
            ?.message ||
            'Unable to delete user.'
        );
      },
    });

  /* =======================================================
     REFRESH
  ======================================================= */

  const handleRefresh = async () => {
    setMessage('');

    await Promise.all([
      refetchUsers(),
      refetchMedicines(),
      refetchBills(),
      refetchSales(),
    ]);

    setMessage(
      'Dashboard data refreshed.'
    );
  };

  /* =======================================================
     SEARCH
  ======================================================= */

  const normalizeText = (
    value
  ) =>
    String(value || '')
      .toLowerCase();

  const filteredUsersForTable =
    useMemo(() => {
      const search =
        normalizeText(
          searchTerm.trim()
        );

      if (!search) {
        return users;
      }

      return users.filter(
        (item) =>
          normalizeText(
            item?.name
          ).includes(search) ||
          normalizeText(
            item?.email
          ).includes(search) ||
          normalizeText(
            item?.phone
          ).includes(search) ||
          normalizeText(
            item?.role
          ).includes(search)
      );
    }, [
      users,
      searchTerm,
    ]);

  /* =======================================================
     SELECTED VIEW DATA
  ======================================================= */

  const selectedViewData =
    useMemo(() => {
      if (!selectedView) {
        return [];
      }

      switch (selectedView) {
        case 'users':
          return users;

        case 'superadmins':
          return users.filter(
            (item) =>
              item?.role ===
              'superadmin'
          );

        case 'pharmacists':
          return users.filter(
            (item) =>
              item?.role ===
              'pharmacist'
          );

        case 'customers':
          return users.filter(
            (item) =>
              item?.role ===
              'customer'
          );

        case 'pharmacistRequests':
          return pendingPharmacistRequests;

        case 'medicines':
          return medicines;

        case 'lowStock':
          return lowStockMedicines;

        case 'expired':
          return expiredMedicines;

        case 'expiring':
          return expiringWithin30Days;

        default:
          return [];
      }
    }, [
      selectedView,
      users,
      pendingPharmacistRequests,
      medicines,
      lowStockMedicines,
      expiredMedicines,
      expiringWithin30Days,
    ]);

  /* =======================================================
     LOADING
  ======================================================= */

  const initialLoading =
    isUsersLoading &&
    isMedicinesLoading &&
    isBillsLoading &&
    isSalesLoading;

  if (initialLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <Loader2
            className="animate-spin text-blue-600"
            size={22}
          />

          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Loading admin dashboard...
          </span>
        </div>
      </div>
    );
  }

  /* =======================================================
     RETURN
  ======================================================= */

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}

        <div className="section-banner flex flex-col gap-4 rounded-2xl p-6 shadow-sm md:flex-row md:items-center md:justify-between">

          <div>
            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
                <ShieldCheck size={24} />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-white">
                  Superadmin Dashboard
                </h1>

                <p className="mt-1 text-sm text-teal-100">
                  Complete system overview and management
                </p>
              </div>

            </div>

            {user?.name && (
              <p className="mt-4 text-sm text-teal-50">
                Welcome,{' '}
                <span className="font-semibold">
                  {user.name}
                </span>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <RefreshCw size={18} />
            Refresh
          </button>

        </div>

        {/* MESSAGE */}

        {message && (
          <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">

            <span>
              {message}
            </span>

            <button
              type="button"
              onClick={() =>
                setMessage('')
              }
              className="rounded-md p-1 hover:bg-blue-100 dark:hover:bg-blue-900/40"
            >
              <X size={16} />
            </button>

          </div>
        )}

        {/* WARNINGS */}

        {(isUsersError ||
          isMedicinesError ||
          isBillsError ||
          isSalesError) && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">

            <AlertCircle
              size={19}
              className="mt-0.5 shrink-0"
            />

            <div>
              <p className="font-semibold">
                Some dashboard data could not be loaded.
              </p>

              <p className="mt-1 text-xs">
                Check the related API endpoint and server connection.
              </p>
            </div>

          </div>
        )}

        {/* SALES OVERVIEW */}

        <section>

          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Sales Overview
            </h2>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              Click a sales card to see complete sales records.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">

            <button
              type="button"
              onClick={() =>
                setSelectedView(
                  'todaySales'
                )
              }
              className="group rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
            >

              <div className="flex items-start justify-between">

                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Today Sales
                  </p>

                  <p className="mt-2 text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {getCurrency(
                      todaySales
                    )}
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    {todayBills} bill
                    {todayBills === 1
                      ? ''
                      : 's'} today
                  </p>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                  <CalendarDays size={22} />
                </div>

              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-500 group-hover:text-blue-600">
                  Open today's sales
                </span>

                <ChevronRight
                  size={16}
                  className="text-slate-400"
                />
              </div>

            </button>

            <button
              type="button"
              onClick={() =>
                setSelectedView(
                  'monthlySales'
                )
              }
              className="group rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
            >

              <div className="flex items-start justify-between">

                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    Monthly Sales
                  </p>

                  <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {getCurrency(
                      monthlySales
                    )}
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    {monthlyBills} bill
                    {monthlyBills === 1
                      ? ''
                      : 's'} this month
                  </p>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <BarChart3 size={22} />
                </div>

              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-500 group-hover:text-emerald-600">
                  Open monthly sales
                </span>

                <ChevronRight
                  size={16}
                  className="text-slate-400"
                />
              </div>

            </button>

          </div>

        </section>

        {/* USER MANAGEMENT */}

        <section>

          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              User Management
            </h2>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage users and pharmacist registration requests.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">

            <StatCard
              title="Total Users"
              value={totalUsers}
              description="Registered accounts"
              icon={UsersRound}
              iconWrapperClass="bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
              onClick={() =>
                setSelectedView(
                  'users'
                )
              }
            />

            <StatCard
              title="Superadmins"
              value={totalSuperadmins}
              description="System controllers"
              icon={ShieldCheck}
              iconWrapperClass="bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
              onClick={() =>
                setSelectedView(
                  'superadmins'
                )
              }
            />

            <StatCard
              title="Pharmacists"
              value={totalPharmacists}
              description="Inventory controllers"
              icon={Stethoscope}
              iconWrapperClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
              onClick={() =>
                setSelectedView(
                  'pharmacists'
                )
              }
            />

            <StatCard
              title="Customers"
              value={totalCustomers}
              description="Registered customers"
              icon={UserRound}
              iconWrapperClass="bg-cyan-100 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400"
              onClick={() =>
                setSelectedView(
                  'customers'
                )
              }
            />

            <StatCard
              title="Pharmacist Requests"
              value={
                pendingPharmacistRequests.length
              }
              description={
                pendingPharmacistRequests.length ===
                0
                  ? 'No pending requests'
                  : 'Waiting for approval'
              }
              icon={UserPlus}
              iconWrapperClass="bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400"
              valueClass="text-orange-600 dark:text-orange-400"
              hasNotification={
                pendingPharmacistRequests.length >
                0
              }
              onClick={() =>
                setSelectedView(
                  'pharmacistRequests'
                )
              }
            />

          </div>

        </section>

        {/* INVENTORY */}

        <section>

          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Inventory Overview
            </h2>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              Click any inventory card to see all related medicines.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">

            <StatCard
              title="Total Medicines"
              value={totalMedicines}
              description="All medicine records"
              icon={Pill}
              iconWrapperClass="bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
              onClick={() =>
                setSelectedView(
                  'medicines'
                )
              }
            />

            <StatCard
              title="Low Stock"
              value={
                lowStockMedicines.length
              }
              description="Need stock attention"
              icon={PackageSearch}
              iconWrapperClass="bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
              valueClass="text-amber-600 dark:text-amber-400"
              onClick={() =>
                setSelectedView(
                  'lowStock'
                )
              }
            />

            <StatCard
              title="Expired Medicines"
              value={
                expiredMedicines.length
              }
              description="Already expired"
              icon={AlertTriangle}
              iconWrapperClass="bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
              valueClass="text-red-600 dark:text-red-400"
              onClick={() =>
                setSelectedView(
                  'expired'
                )
              }
            />

            <StatCard
              title="Expiring Within 30 Days"
              value={
                expiringWithin30Days.length
              }
              description="Expiry needs attention"
              icon={Clock3}
              iconWrapperClass="bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400"
              valueClass="text-orange-600 dark:text-orange-400"
              onClick={() =>
                setSelectedView(
                  'expiring'
                )
              }
            />

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">

              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Inventory Value
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {getCurrency(
                  medicines.reduce(
                    (
                      total,
                      medicine
                    ) =>
                      total +
                      getMedicinePrice(
                        medicine
                      ) *
                        getMedicineStock(
                          medicine
                        ),
                    0
                  )
                )}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Current stock × medicine price
              </p>

              <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
                <Package size={15} />
                Inventory estimate
              </div>

            </div>

          </div>

        </section>

        {/* USER MANAGEMENT TABLE */}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">

          <div className="border-b border-slate-200 p-5 dark:border-slate-700">

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  User Management
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Update roles or remove accounts.
                </p>
              </div>

              <div className="relative w-full lg:max-w-sm">

                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(
                      event.target.value
                    )
                  }
                  placeholder="Search name, email, phone or role"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

              </div>

            </div>

          </div>

          <div className="overflow-x-auto">

            <table className="min-w-full">

              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    User
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Role
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Status
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Created
                  </th>

                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                    Actions
                  </th>

                </tr>
              </thead>

              <tbody>

                {filteredUsersForTable.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsersForTable.map(
                    (item) => {
                      const itemId =
                        item?._id ||
                        item?.id;

                      const isCurrentUser =
                        String(
                          itemId
                        ) ===
                        String(
                          user?._id ||
                            user?.id
                        );

                      return (
                        <tr
                          key={itemId}
                          className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                        >

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">

                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                <UserRound
                                  size={18}
                                />
                              </div>

                              <div>
                                <p className="font-semibold text-slate-900 dark:text-white">
                                  {item?.name ||
                                    'Unknown'}
                                </p>

                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {item?.email ||
                                    'No email'}
                                </p>
                              </div>

                            </div>
                          </td>

                          <td className="px-5 py-4">

                            <select
                              value={
                                item?.role ||
                                'customer'
                              }
                              disabled={
                                isCurrentUser ||
                                updateRoleMutation.isPending
                              }
                              onChange={(
                                event
                              ) =>
                                updateRoleMutation.mutate(
                                  {
                                    userId:
                                      itemId,
                                    role:
                                      event
                                        .target
                                        .value,
                                  }
                                )
                              }
                              className={`rounded-lg border px-3 py-2 text-sm font-medium dark:text-white ${
                                item?.role === 'customer'
                                  ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-300'
                                  : item?.role === 'pharmacist'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-300'
                                    : 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/30 dark:bg-violet-500/15 dark:text-violet-300'
                              }`}
                            >

                              <option value="customer">
                                Customer
                              </option>

                              <option value="pharmacist">
                                Pharmacist
                              </option>

                              <option value="superadmin">
                                Superadmin
                              </option>

                            </select>

                          </td>

                          <td className="px-5 py-4">

                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                item?.accountStatus ===
                                'approved'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                  : item?.accountStatus ===
                                    'rejected'
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                              }`}
                            >
                              {item?.accountStatus ||
                                'active'}
                            </span>

                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                            {formatDate(
                              item?.createdAt
                            )}
                          </td>

                          <td className="px-5 py-4 text-right">

                            <button
                              type="button"
                              disabled={
                                isCurrentUser ||
                                deleteUserMutation.isPending
                              }
                              onClick={() => {
                                if (!itemId) {
                                  return;
                                }

                                const confirmed =
                                  window.confirm(
                                    `Delete ${
                                      item?.name ||
                                      'this user'
                                    }?`
                                  );

                                if (!confirmed) {
                                  return;
                                }

                                deleteUserMutation.mutate(
                                  itemId
                                );
                              }}
                              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 size={15} />
                              Delete
                            </button>

                          </td>

                        </tr>
                      );
                    }
                  )
                )}

              </tbody>

            </table>

          </div>

        </section>

        {/* EXPIRY TABLE */}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">

          <div className="border-b border-slate-200 p-5 dark:border-slate-700">

            <div className="flex items-center justify-between gap-4">

              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Medicines Nearest to Expiry
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Up to 100 medicines with nearest expiry dates.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedView(
                    'expiring'
                  )
                }
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                <Eye size={15} />
                View All
              </button>

            </div>

          </div>

          <div className="overflow-x-auto">

            <table className="min-w-full">

              <thead>

                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Medicine
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Stock
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Price
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Expiry
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Remaining
                  </th>

                </tr>

              </thead>

              <tbody>

                {medicines
                  .filter((medicine) =>
                    getExpiryDate(
                      medicine
                    )
                  )
                  .sort((a, b) => {
                    const aDays =
                      getDaysUntilExpiry(
                        a
                      ) ??
                      999999;

                    const bDays =
                      getDaysUntilExpiry(
                        b
                      ) ??
                      999999;

                    return (
                      aDays -
                      bDays
                    );
                  })
                  .slice(0, 100)
                  .map((medicine) => {
                    const daysLeft =
                      getDaysUntilExpiry(
                        medicine
                      );

                    return (
                      <tr
                        key={
                          medicine?._id ||
                          medicine?.id ||
                          medicine?.name
                        }
                        className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                      >

                        <td className="px-5 py-4">

                          <div className="flex items-center gap-3">

                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              <Pill size={17} />
                            </div>

                            <div>

                              <p className="font-semibold text-slate-900 dark:text-white">
                                {medicine?.name ||
                                  medicine?.medicineName ||
                                  'Unknown Medicine'}
                              </p>

                              <p className="text-xs text-slate-500">
                                {medicine?.brand ||
                                  medicine?.genericName ||
                                  medicine?.category ||
                                  'Medicine'}
                              </p>

                            </div>

                          </div>

                        </td>

                        <td className="px-5 py-4 text-sm">
                          {getMedicineStock(
                            medicine
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm font-semibold">
                          {getCurrency(
                            getMedicinePrice(
                              medicine
                            )
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm">
                          {formatDate(
                            getExpiryDate(
                              medicine
                            )
                          )}
                        </td>

                        <td className="px-5 py-4">

                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              daysLeft ===
                              null
                                ? 'bg-slate-100 text-slate-600'
                                : daysLeft <
                                  0
                                ? 'bg-red-100 text-red-700'
                                : daysLeft <=
                                  30
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {daysLeft ===
                            null
                              ? 'Unknown'
                              : daysLeft <
                                0
                              ? 'Expired'
                              : daysLeft ===
                                0
                              ? 'Expires today'
                              : `${daysLeft} days left`}
                          </span>

                        </td>

                      </tr>
                    );
                  })}

              </tbody>

            </table>

          </div>

        </section>

      </div>

      {/* =====================================================
          DETAILS MODAL
      ===================================================== */}

      {selectedView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">

          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">

            {/* MODAL HEADER */}

            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">

              <div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-white">

                  {selectedView ===
                    'todaySales' &&
                    'Today Sales Details'}

                  {selectedView ===
                    'monthlySales' &&
                    'Monthly Sales Details'}

                  {selectedView ===
                    'users' &&
                    'All Users'}

                  {selectedView ===
                    'superadmins' &&
                    'All Superadmins'}

                  {selectedView ===
                    'pharmacists' &&
                    'All Pharmacists'}

                  {selectedView ===
                    'customers' &&
                    'All Customers'}

                  {selectedView ===
                    'pharmacistRequests' &&
                    'Pharmacist Registration Requests'}

                  {selectedView ===
                    'medicines' &&
                    'All Medicines'}

                  {selectedView ===
                    'lowStock' &&
                    'Low Stock Medicines'}

                  {selectedView ===
                    'expired' &&
                    'Expired Medicines'}

                  {selectedView ===
                    'expiring' &&
                    'Medicines Expiring Within 30 Days'}

                </h3>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">

                  {selectedView ===
                    'todaySales' &&
                    `Today: ${formatDate(
                      new Date()
                    )}`}

                  {selectedView ===
                    'monthlySales' &&
                    new Date().toLocaleDateString(
                      'en-PK',
                      {
                        month:
                          'long',
                        year:
                          'numeric',
                      }
                    )}

                  {![
                    'todaySales',
                    'monthlySales',
                  ].includes(
                    selectedView
                  ) &&
                    `${selectedViewData.length} record${
                      selectedViewData.length ===
                      1
                        ? ''
                        : 's'
                    }`}

                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedView(
                    null
                  )
                }
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>

            </div>

            {/* MODAL CONTENT */}

            <div className="overflow-y-auto p-5">

              {/* =============================================
                  PHARMACIST REQUESTS
              ============================================= */}

              {selectedView ===
                'pharmacistRequests' && (
                <div className="space-y-4">

                  {pendingPharmacistRequests.length ===
                  0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">

                      <CheckCircle
                        size={42}
                        className="mx-auto text-emerald-500"
                      />

                      <h4 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
                        No pending requests
                      </h4>

                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        All pharmacist registration requests have been processed.
                      </p>

                    </div>
                  ) : (
                    pendingPharmacistRequests.map(
                      (pharmacist) => {
                        const pharmacistId =
                          pharmacist?._id ||
                          pharmacist?.id;

                        const approvingId =
                          approvePharmacistMutation.variables;

                        const isThisRequestApproving =
                          approvePharmacistMutation.isPending &&
                          String(
                            approvingId
                          ) ===
                            String(
                              pharmacistId
                            );

                        return (
                          <div
                            key={
                              pharmacistId
                            }
                            className="rounded-2xl border border-orange-200 bg-orange-50/50 p-5 dark:border-orange-900/40 dark:bg-orange-950/10"
                          >

                            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                              <div className="flex items-start gap-4">

                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
                                  <Stethoscope
                                    size={23}
                                  />
                                </div>

                                <div>

                                  <div className="flex flex-wrap items-center gap-2">

                                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                                      {pharmacist?.name ||
                                        'Unknown Pharmacist'}
                                    </h4>

                                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                                      Pending Approval
                                    </span>

                                  </div>

                                  <div className="mt-3 grid gap-x-8 gap-y-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">

                                    <p>
                                      <span className="font-semibold">
                                        Email:
                                      </span>{' '}
                                      {pharmacist?.email ||
                                        'N/A'}
                                    </p>

                                    <p>
                                      <span className="font-semibold">
                                        Phone:
                                      </span>{' '}
                                      {pharmacist?.phone ||
                                        'N/A'}
                                    </p>

                                    <p>
                                      <span className="font-semibold">
                                        Pharmacy:
                                      </span>{' '}
                                      {pharmacist?.shopName ||
                                        pharmacist?.pharmacyName ||
                                        pharmacist?.shop ||
                                        pharmacist?.shop_name ||
                                        'N/A'}
                                    </p>

                                    <p>
                                      <span className="font-semibold">
                                        Request Date:
                                      </span>{' '}
                                      {formatDateTime(
                                        pharmacist?.createdAt
                                      )}
                                    </p>

                                    <p>
                                      <span className="font-semibold">
                                        Account Status:
                                      </span>{' '}
                                      {pharmacist?.accountStatus ||
                                        'pending'}
                                    </p>

                                  </div>

                                </div>

                              </div>

                              <button
                                type="button"
                                disabled={
                                  approvePharmacistMutation.isPending ||
                                  !pharmacistId
                                }
                                onClick={() => {
                                  approvePharmacistMutation.mutate(
                                    pharmacistId
                                  );
                                }}
                                className="inline-flex min-w-[190px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >

                                {isThisRequestApproving ? (
                                  <>
                                    <Loader2
                                      size={17}
                                      className="animate-spin"
                                    />
                                    Approving...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle
                                      size={17}
                                    />
                                    Approve Pharmacist
                                  </>
                                )}

                              </button>

                            </div>

                          </div>
                        );
                      }
                    )
                  )}

                </div>
              )}

              {/* =============================================
                  TODAY SALES
              ============================================= */}

              {selectedView ===
                'todaySales' && (
                <div className="space-y-6">

                  <div className="grid gap-4 md:grid-cols-3">

                    <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950/20">
                      <p className="text-xs font-semibold uppercase text-blue-600">
                        Total Sales
                      </p>

                      <p className="mt-2 text-2xl font-bold text-blue-700 dark:text-blue-300">
                        {getCurrency(
                          todaySales
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        Bills
                      </p>

                      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                        {todayBillsList.length ||
                          todayBills}
                      </p>
                    </div>

                    <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/20">
                      <p className="text-xs font-semibold uppercase text-emerald-600">
                        Medicine Units Sold
                      </p>

                      <p className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                        {todaySoldMedicines.reduce(
                          (
                            total,
                            item
                          ) =>
                            total +
                            item.quantity,
                          0
                        )}
                      </p>
                    </div>

                  </div>

                  <div>

                    <h4 className="mb-3 font-bold text-slate-900 dark:text-white">
                      Medicines Sold Today
                    </h4>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">

                      <table className="min-w-full">

                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800">

                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                              Medicine
                            </th>

                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                              Quantity Sold
                            </th>

                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                              Orders
                            </th>

                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                              Sales
                            </th>

                          </tr>
                        </thead>

                        <tbody>

                          {todaySoldMedicines.length ===
                          0 ? (
                            <tr>
                              <td
                                colSpan="4"
                                className="px-4 py-10 text-center text-sm text-slate-500"
                              >
                                No medicine sales recorded today.
                              </td>
                            </tr>
                          ) : (
                            todaySoldMedicines.map(
                              (item) => (
                                <tr
                                  key={
                                    item.medicineName
                                  }
                                  className="border-t border-slate-100 dark:border-slate-800"
                                >

                                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                    {
                                      item.medicineName
                                    }
                                  </td>

                                  <td className="px-4 py-3 text-sm">
                                    {
                                      item.quantity
                                    }
                                  </td>

                                  <td className="px-4 py-3 text-sm">
                                    {
                                      item.orders
                                    }
                                  </td>

                                  <td className="px-4 py-3 text-sm font-semibold">
                                    {getCurrency(
                                      item.sales
                                    )}
                                  </td>

                                </tr>
                              )
                            )
                          )}

                        </tbody>

                      </table>

                    </div>

                  </div>

                  <div>

                    <h4 className="mb-3 font-bold text-slate-900 dark:text-white">
                      Today's Bills
                    </h4>

                    <div className="space-y-3">

                      {todayBillsList.length ===
                      0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center text-sm text-slate-500 dark:border-slate-700">
                          No bills found for today.
                        </div>
                      ) : (
                        todayBillsList.map(
                          (
                            bill,
                            index
                          ) => (
                            <div
                              key={
                                bill?._id ||
                                bill?.id ||
                                `today-${index}`
                              }
                              className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                            >

                              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

                                <div>
                                  <p className="font-semibold text-slate-900 dark:text-white">
                                    Bill #
                                    {bill?.billNumber ||
                                      bill?.invoiceNumber ||
                                      bill?._id ||
                                      index +
                                        1}
                                  </p>

                                  <p className="mt-1 text-xs text-slate-500">
                                    {formatDateTime(
                                      getBillDate(
                                        bill
                                      )
                                    )}
                                  </p>

                                  <p className="mt-1 text-xs text-slate-500">
                                    Customer:{' '}
                                    {getCustomerName(
                                      bill
                                    )}
                                  </p>

                                </div>

                                <p className="text-lg font-bold text-emerald-600">
                                  {getCurrency(
                                    getBillTotal(
                                      bill
                                    )
                                  )}
                                </p>

                              </div>

                              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">

                                {getBillItems(
                                  bill
                                ).map(
                                  (
                                    item,
                                    itemIndex
                                  ) => (
                                    <div
                                      key={`${itemIndex}-${getItemName(
                                        item
                                      )}`}
                                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800"
                                    >

                                      <div>
                                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                                          {getItemName(
                                            item
                                          )}
                                        </p>

                                        <p className="text-xs text-slate-500">
                                          Qty:{' '}
                                          {getItemQuantity(
                                            item
                                          )}
                                        </p>
                                      </div>

                                      <p className="text-sm font-semibold">
                                        {getCurrency(
                                          getItemTotal(
                                            item
                                          )
                                        )}
                                      </p>

                                    </div>
                                  )
                                )}

                              </div>

                            </div>
                          )
                        )
                      )}

                    </div>

                  </div>

                </div>
              )}

              {/* =============================================
                  MONTHLY SALES
              ============================================= */}

              {selectedView ===
                'monthlySales' && (
                <div className="space-y-6">

                  <div className="grid gap-4 md:grid-cols-3">

                    <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/20">
                      <p className="text-xs font-semibold uppercase text-emerald-600">
                        Monthly Sales
                      </p>

                      <p className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                        {getCurrency(
                          monthlySales
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        Bills
                      </p>

                      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                        {monthlyBillsList.length ||
                          monthlyBills}
                      </p>
                    </div>

                    <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950/20">
                      <p className="text-xs font-semibold uppercase text-blue-600">
                        Medicine Units Sold
                      </p>

                      <p className="mt-2 text-2xl font-bold text-blue-700 dark:text-blue-300">
                        {monthlySoldMedicines.reduce(
                          (
                            total,
                            item
                          ) =>
                            total +
                            item.quantity,
                          0
                        )}
                      </p>
                    </div>

                  </div>

                  <div>

                    <h4 className="mb-3 font-bold text-slate-900 dark:text-white">
                      Medicines Sold This Month
                    </h4>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">

                      <table className="min-w-full">

                        <thead>

                          <tr className="bg-slate-50 dark:bg-slate-800">

                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                              Medicine
                            </th>

                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                              Quantity Sold
                            </th>

                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                              Orders
                            </th>

                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                              Sales
                            </th>

                          </tr>

                        </thead>

                        <tbody>

                          {monthlySoldMedicines.length ===
                          0 ? (
                            <tr>
                              <td
                                colSpan="4"
                                className="px-4 py-10 text-center text-sm text-slate-500"
                              >
                                No medicine sales recorded this month.
                              </td>
                            </tr>
                          ) : (
                            monthlySoldMedicines.map(
                              (item) => (
                                <tr
                                  key={
                                    item.medicineName
                                  }
                                  className="border-t border-slate-100 dark:border-slate-800"
                                >

                                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                    {
                                      item.medicineName
                                    }
                                  </td>

                                  <td className="px-4 py-3 text-sm">
                                    {
                                      item.quantity
                                    }
                                  </td>

                                  <td className="px-4 py-3 text-sm">
                                    {
                                      item.orders
                                    }
                                  </td>

                                  <td className="px-4 py-3 text-sm font-semibold">
                                    {getCurrency(
                                      item.sales
                                    )}
                                  </td>

                                </tr>
                              )
                            )
                          )}

                        </tbody>

                      </table>

                    </div>

                  </div>

                  <div>

                    <h4 className="mb-3 font-bold text-slate-900 dark:text-white">
                      Monthly Bills
                    </h4>

                    <div className="space-y-3">

                      {monthlyBillsList.length ===
                      0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center text-sm text-slate-500 dark:border-slate-700">
                          No bills found for this month.
                        </div>
                      ) : (
                        monthlyBillsList.map(
                          (
                            bill,
                            index
                          ) => (
                            <div
                              key={
                                bill?._id ||
                                bill?.id ||
                                `month-${index}`
                              }
                              className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                            >

                              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

                                <div>

                                  <p className="font-semibold text-slate-900 dark:text-white">
                                    Bill #
                                    {bill?.billNumber ||
                                      bill?.invoiceNumber ||
                                      bill?._id ||
                                      index +
                                        1}
                                  </p>

                                  <p className="mt-1 text-xs text-slate-500">
                                    {formatDateTime(
                                      getBillDate(
                                        bill
                                      )
                                    )}
                                  </p>

                                  <p className="mt-1 text-xs text-slate-500">
                                    Customer:{' '}
                                    {getCustomerName(
                                      bill
                                    )}
                                  </p>

                                  <p className="mt-1 text-xs text-slate-500">
                                    Pharmacist:{' '}
                                    {getPharmacistName(
                                      bill
                                    )}
                                  </p>

                                </div>

                                <p className="text-lg font-bold text-emerald-600">
                                  {getCurrency(
                                    getBillTotal(
                                      bill
                                    )
                                  )}
                                </p>

                              </div>

                              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">

                                {getBillItems(
                                  bill
                                ).map(
                                  (
                                    item,
                                    itemIndex
                                  ) => (
                                    <div
                                      key={`${itemIndex}-${getItemName(
                                        item
                                      )}`}
                                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800"
                                    >

                                      <div>

                                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                                          {getItemName(
                                            item
                                          )}
                                        </p>

                                        <p className="text-xs text-slate-500">
                                          Qty:{' '}
                                          {getItemQuantity(
                                            item
                                          )}
                                        </p>

                                      </div>

                                      <p className="text-sm font-semibold">
                                        {getCurrency(
                                          getItemTotal(
                                            item
                                          )
                                        )}
                                      </p>

                                    </div>
                                  )
                                )}

                              </div>

                            </div>
                          )
                        )
                      )}

                    </div>

                  </div>

                </div>
              )}

              {/* =============================================
                  USER DETAILS
              ============================================= */}

              {[
                'users',
                'superadmins',
                'pharmacists',
                'customers',
              ].includes(
                selectedView
              ) && (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">

                  <table className="min-w-full">

                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800">

                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Name
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Email
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Phone
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Role
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Status
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Created
                        </th>

                      </tr>
                    </thead>

                    <tbody>

                      {selectedViewData.length ===
                      0 ? (
                        <tr>
                          <td
                            colSpan="6"
                            className="px-4 py-12 text-center text-sm text-slate-500"
                          >
                            No users found.
                          </td>
                        </tr>
                      ) : (
                        selectedViewData.map(
                          (item) => (
                            <tr
                              key={
                                item?._id ||
                                item?.id ||
                                item?.email
                              }
                              className="border-t border-slate-100 dark:border-slate-800"
                            >

                              <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                {item?.name ||
                                  'Unknown'}
                              </td>

                              <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                {item?.email ||
                                  'N/A'}
                              </td>

                              <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                {item?.phone ||
                                  'N/A'}
                              </td>

                              <td className="px-4 py-3">

                                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                                  {item?.role ||
                                    'N/A'}
                                </span>

                              </td>

                              <td className="px-4 py-3">

                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                  {item?.accountStatus ||
                                    'active'}
                                </span>

                              </td>

                              <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                {formatDate(
                                  item?.createdAt
                                )}
                              </td>

                            </tr>
                          )
                        )
                      )}

                    </tbody>

                  </table>

                </div>
              )}

              {/* =============================================
                  MEDICINE DETAILS
              ============================================= */}

              {[
                'medicines',
                'lowStock',
                'expired',
                'expiring',
              ].includes(
                selectedView
              ) && (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">

                  <table className="min-w-full">

                    <thead>

                      <tr className="bg-slate-50 dark:bg-slate-800">

                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Medicine
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Brand
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Stock
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Price
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Expiry
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Status
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {selectedViewData.length ===
                      0 ? (
                        <tr>
                          <td
                            colSpan="6"
                            className="px-4 py-12 text-center text-sm text-slate-500"
                          >
                            No medicines found.
                          </td>
                        </tr>
                      ) : (
                        selectedViewData.map(
                          (medicine) => {
                            const daysLeft =
                              getDaysUntilExpiry(
                                medicine
                              );

                            const stock =
                              getMedicineStock(
                                medicine
                              );

                            const lowLimit =
                              getLowStockLimit(
                                medicine
                              );

                            return (
                              <tr
                                key={
                                  medicine?._id ||
                                  medicine?.id ||
                                  medicine?.name
                                }
                                className="border-t border-slate-100 dark:border-slate-800"
                              >

                                <td className="px-4 py-3">

                                  <div className="flex items-center gap-3">

                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800">
                                      <Pill
                                        size={17}
                                      />
                                    </div>

                                    <div>

                                      <p className="font-medium text-slate-900 dark:text-white">
                                        {medicine?.name ||
                                          medicine?.medicineName ||
                                          'Unknown'}
                                      </p>

                                      <p className="text-xs text-slate-500">
                                        {medicine?.category ||
                                          medicine?.genericName ||
                                          'Medicine'}
                                      </p>

                                    </div>

                                  </div>

                                </td>

                                <td className="px-4 py-3 text-sm">
                                  {medicine?.brand ||
                                    'N/A'}
                                </td>

                                <td className="px-4 py-3 text-sm font-semibold">
                                  {stock}
                                </td>

                                <td className="px-4 py-3 text-sm font-semibold">
                                  {getCurrency(
                                    getMedicinePrice(
                                      medicine
                                    )
                                  )}
                                </td>

                                <td className="px-4 py-3 text-sm">
                                  {formatDate(
                                    getExpiryDate(
                                      medicine
                                    )
                                  )}
                                </td>

                                <td className="px-4 py-3">

                                  {daysLeft !==
                                    null &&
                                  daysLeft <
                                    0 ? (
                                    <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                                      Expired
                                    </span>
                                  ) : daysLeft !==
                                      null &&
                                    daysLeft <=
                                      30 ? (
                                    <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">
                                      {daysLeft ===
                                      0
                                        ? 'Today'
                                        : `${daysLeft} days left`}
                                    </span>
                                  ) : stock <=
                                    lowLimit ? (
                                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                      Low Stock
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                      Normal
                                    </span>
                                  )}

                                </td>

                              </tr>
                            );
                          }
                        )
                      )}

                    </tbody>

                  </table>

                </div>
              )}

            </div>

            {/* MODAL FOOTER */}

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-800/50">

              <p className="text-xs text-slate-500 dark:text-slate-400">
                All amounts are displayed in PKR.
              </p>

              <button
                type="button"
                onClick={() =>
                  setSelectedView(
                    null
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
              >
                Close
              </button>

            </div>

          </div>

        </div>
      )}
    </div>
  );
}
