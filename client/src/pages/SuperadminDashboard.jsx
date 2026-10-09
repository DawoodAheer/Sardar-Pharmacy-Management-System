import { useMemo, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import api from '../utils/api';
import { downloadMedicineInventory } from '../utils/medicineExport';
import { useAuth } from '../context/AuthContext';
import ProfitDetailsModal from '../components/ProfitDetailsModal';
import MedicineImportIssues from '../components/MedicineImportIssues';
import BackupRestorePanel from '../components/BackupRestorePanel';
import MedicineExpiryAlerts from '../components/MedicineExpiryAlerts';
import MedicineAuditHistory from '../components/MedicineAuditHistory';
import PurchaseOrdersPanel from '../components/PurchaseOrdersPanel';
import DailyClosingReport from '../components/DailyClosingReport';
import StockAdjustmentModal from '../components/StockAdjustmentModal';
import SalesReturnModal from '../components/SalesReturnModal';

import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle,
  ChevronRight,
  Clock3,
  Download,
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
    bill?.netTotal ??
    bill?.totalAmount ??
      bill?.total ??
      bill?.grandTotal ??
      bill?.amount ??
      bill?.netTotal ??
      0
  );
};

const getBillItems = (bill) => {
  if (Array.isArray(bill?.netItems)) {
    return bill.netItems;
  }
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
    item?.netQuantity ??
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
    item?.netSales ??
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

const getMedicinePrice = (medicine) => {
  return Number(
    medicine?.price ??
      medicine?.sellingPrice ??
      medicine?.unitPrice ??
      medicine?.salePrice ??
      0
  );
};

const getMedicinePurchasePrice = (medicine) =>
  (Number(medicine?.purchasePrice ?? 0) / Math.max(1, Number(medicine?.unitsPerPack) || 1));

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
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const [selectedView, setSelectedView] =
    useState(null);

  const [searchTerm, setSearchTerm] =
    useState('');

  const [message, setMessage] =
    useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'pharmacist' });

  const [isProfitModalOpen, setIsProfitModalOpen] =
    useState(false);
  const [profitDateRange, setProfitDateRange] = useState({ startDate: '', endDate: '' });
  const [stockAdjMedicine, setStockAdjMedicine] =
    useState(null);
  const [returnModalBill, setReturnModalBill] =
    useState(null);

  const { data: deletionRequestsResponse, refetch: refetchDeletionRequests } = useQuery({
    queryKey: ['adminDeletionRequests'],
    queryFn: async () => (await api.get('/deletion-requests')).data,
    refetchInterval: 10000,
  });
  const deletionRequests = deletionRequestsResponse?.requests || [];
  const { data: returnActivityResponse, refetch: refetchReturnActivity } = useQuery({
    queryKey: ['adminReturnActivity'],
    queryFn: async () => (await api.get('/bills/return-activity')).data,
    refetchInterval: 15000,
  });
  const returnActivity = returnActivityResponse?.returns || [];
  const { data: udharPaymentActivityResponse, refetch: refetchUdharPaymentActivity } = useQuery({
    queryKey: ['adminUdharPaymentActivity'],
    queryFn: async () => (await api.get('/udhar/payment-activity')).data,
    refetchInterval: 15000,
  });
  const udharPaymentActivity = udharPaymentActivityResponse?.payments || [];
  const { data: archivedMedicinesResponse, refetch: refetchArchivedMedicines } = useQuery({
    queryKey: ['superadminDeletedMedicines'],
    queryFn: async () => (await api.get('/medicines/deleted')).data,
    refetchInterval: 15000,
  });
  const archivedMedicines = Array.isArray(archivedMedicinesResponse) ? archivedMedicinesResponse : [];
  const reviewDeletionMutation = useMutation({
    mutationFn: async ({ requestId, decision }) => (await api.patch(`/deletion-requests/${requestId}/review`, { decision })).data,
    onSuccess: async (result) => {
      setMessage(result.message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['adminDeletionRequests'] }),
        queryClient.invalidateQueries({ queryKey: ['superadminMedicines'] }),
        queryClient.invalidateQueries({ queryKey: ['superadminDeletedMedicines'] }),
        queryClient.invalidateQueries({ queryKey: ['superadminBills'] }),
        queryClient.invalidateQueries({ queryKey: ['superadminSalesSummary'] }),
        queryClient.invalidateQueries({ queryKey: ['superadminProfitSummary'] }),
        queryClient.invalidateQueries({ queryKey: ['medicines'] }),
        queryClient.invalidateQueries({ queryKey: ['bills'] }),
      ]);
    },
    onError: (error) => setMessage(error?.response?.data?.message || 'Unable to review deletion request.'),
  });
  const adminDeleteMedicineMutation = useMutation({
    mutationFn: async (medicineId) => (await api.delete(`/medicines/${medicineId}`)).data,
    onSuccess: async (result) => {
      setMessage(result.message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['superadminMedicines'] }),
        queryClient.invalidateQueries({ queryKey: ['superadminDeletedMedicines'] }),
        queryClient.invalidateQueries({ queryKey: ['medicines'] }),
      ]);
    },
    onError: (error) => setMessage(error?.response?.data?.message || 'Unable to delete medicine.'),
  });
  const restoreMedicineMutation = useMutation({
    mutationFn: async (medicineId) => (await api.patch(`/medicines/${medicineId}/restore`)).data,
    onSuccess: async (result) => {
      setMessage(result.message);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['superadminMedicines'] }),
        queryClient.invalidateQueries({ queryKey: ['superadminDeletedMedicines'] }),
        queryClient.invalidateQueries({ queryKey: ['medicines'] }),
      ]);
    },
    onError: (error) => setMessage(error?.response?.data?.message || 'Unable to restore medicine.'),
  });

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

  const {
    data: profitSummary,
    isLoading: isProfitLoading,
    refetch: refetchProfitSummary,
  } = useQuery({
    queryKey: ['profitSummary'],
    queryFn: async () => {
      const response = await api.get('/bills/profit-summary');
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

          return stock < 5;
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

  const expiringWithinSixMonths =
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
            daysLeft <= 180
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

  const yearlySales = Number(salesSummary?.year?.totalSales || 0);
  const yearlyBills = Number(salesSummary?.year?.totalBills || 0);

  const openProfitDetails = (period) => {
    const now = new Date();
    const start = period === 'daily'
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : period === 'monthly'
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const asInputDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    setProfitDateRange({ startDate: asInputDate(start), endDate: asInputDate(end) });
    setIsProfitModalOpen(true);
  };

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

  const yearlyBillsList = useMemo(() => {
    const year = new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    return bills.filter((bill) => {
      const date = new Date(getBillDate(bill) || '');
      return Number.isFinite(date.getTime()) && date >= start && date < end &&
        !['PENDING', 'REJECTED'].includes(bill?.orderStatus) && getBillTotal(bill) > 0;
    }).sort((a, b) => new Date(getBillDate(b) || 0) - new Date(getBillDate(a) || 0));
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

  const yearlySoldMedicines = useMemo(
    () => aggregateSoldMedicines(yearlyBillsList),
    [yearlyBillsList]
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

  const createStaffMutation = useMutation({
    mutationFn: async () => (await api.post('/users/staff', newStaff)).data,
    onSuccess: () => {
      setNewStaff({ name: '', email: '', password: '', role: 'pharmacist' });
      setMessage('Staff account created successfully.');
      queryClient.invalidateQueries({ queryKey: ['superadminUsers'] });
    },
    onError: (error) => setMessage(error?.response?.data?.message || 'Unable to create staff account.'),
  });

  const setActiveMutation = useMutation({
    mutationFn: async ({ userId, isActive }) => (await api.patch(`/users/${userId}/active`, { isActive })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['superadminUsers'] }),
    onError: (error) => setMessage(error?.response?.data?.message || 'Unable to update account status.'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }) => (await api.put(`/users/${userId}/password`, { password })).data,
    onSuccess: async (_, variables) => {
      setMessage('Password reset successfully.');
      if (String(variables.userId) === String(user?._id || user?.id)) await logout();
    },
    onError: (error) => setMessage(error?.response?.data?.message || 'Unable to reset password.'),
  });

  const editUserMutation = useMutation({
    mutationFn: async ({ userId, name, email }) => (await api.patch(`/users/${userId}`, { name, email })).data,
    onSuccess: () => {
      setMessage('User details updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['superadminUsers'] });
    },
    onError: (error) => setMessage(error?.response?.data?.message || 'Unable to edit user.'),
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
    setIsRefreshing(true);
    try {
      const results = await Promise.allSettled([
        refetchUsers({ throwOnError: true }), refetchMedicines({ throwOnError: true }),
        refetchBills({ throwOnError: true }), refetchSales({ throwOnError: true }),
        refetchProfitSummary({ throwOnError: true }), refetchDeletionRequests({ throwOnError: true }),
        refetchReturnActivity({ throwOnError: true }), refetchUdharPaymentActivity({ throwOnError: true }),
        refetchArchivedMedicines({ throwOnError: true }),
      ]);
      setMessage(results.some((result) => result.status === 'rejected')
        ? 'Some dashboard data could not be refreshed. Check the connection and try again.'
        : 'All Admin dashboard data refreshed.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const exportMedicinesToExcel = () => {
    try {
      downloadMedicineInventory(medicines);
    } catch (exportError) {
      setMessage(`Unable to export medicines: ${exportError.message}`);
    }
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

        case 'deletionRequests':
          return deletionRequests;

        case 'deletedMedicines':
          return archivedMedicines;

        case 'refundActivity':
          return returnActivity;

        case 'udharPaymentActivity':
          return udharPaymentActivity;

        case 'yearlySales':
          return yearlyBillsList;

        case 'medicines':
          return medicines;

        case 'lowStock':
          return lowStockMedicines;

        case 'expired':
          return expiredMedicines;

        case 'expiring':
          return expiringWithinSixMonths;

        default:
          return [];
      }
    }, [
      selectedView,
      users,
      pendingPharmacistRequests,
      deletionRequests,
      archivedMedicines,
      returnActivity,
      udharPaymentActivity,
      yearlyBillsList,
      medicines,
      lowStockMedicines,
      expiredMedicines,
      expiringWithinSixMonths,
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
                  Admin Dashboard
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

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportMedicinesToExcel}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Download size={18} />
              Export Medicines
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

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

        <MedicineImportIssues />
        <BackupRestorePanel />
        <DailyClosingReport compact />
        <MedicineExpiryAlerts compact />
        <PurchaseOrdersPanel compact />
        <MedicineAuditHistory compact />

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

              <div className="mb-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard
                  title="Deletion Requests"
                  value={deletionRequests.filter((request) => request.status === 'pending').length}
                  description="Review medicine and bill deletion requests"
                  icon={Trash2}
                  iconWrapperClass="bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                  valueClass="text-rose-600 dark:text-rose-400"
                  hasNotification={deletionRequests.some((request) => request.status === 'pending')}
                  onClick={() => setSelectedView('deletionRequests')}
                />
                <StatCard
                  title="Refund Activity"
                  value={returnActivity.length}
                  description={`Latest refunds: ${getCurrency(returnActivity.reduce((sum, item) => sum + Number(item.refund_amount || 0), 0))}`}
                  icon={RefreshCw}
                  iconWrapperClass="bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                  valueClass="text-amber-600 dark:text-amber-400"
                  onClick={() => setSelectedView('refundActivity')}
                />
                <StatCard
                  title="Udhar Payments"
                  value={udharPaymentActivity.length}
                  description={`Latest payments: ${getCurrency(udharPaymentActivity.reduce((sum, item) => sum + Number(item.amount || 0), 0))}`}
                  icon={BarChart3}
                  iconWrapperClass="bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
                  valueClass="text-sky-600 dark:text-sky-400"
                  onClick={() => setSelectedView('udharPaymentActivity')}
                />
                <StatCard
                  title="Archived Medicines"
                  value={archivedMedicines.length}
                  description="Review and restore removed stock records"
                  icon={Package}
                  iconWrapperClass="bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
                  valueClass="text-violet-600 dark:text-violet-400"
                  onClick={() => setSelectedView('deletedMedicines')}
                />
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

            <button type="button" onClick={() => setSelectedView('yearlySales')} className="group rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-violet-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Yearly Sales · {new Date().getFullYear()}</p>
                  <p className="mt-2 text-3xl font-bold text-violet-600 dark:text-violet-400">{getCurrency(yearlySales)}</p>
                  <p className="mt-2 text-sm text-slate-500">{yearlyBills} net sales bills</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"><CalendarDays size={22} /></div>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-500 group-hover:text-violet-600">Open this year’s sales</span>
                <ChevronRight size={16} className="text-slate-400" />
              </div>
            </button>

          </div>

        </section>

        {/* PROFIT SUMMARY */}
        <section>
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Profit & Analytics Summary
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Net profit calculated from sales revenue minus purchase cost.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setProfitDateRange({ startDate: '', endDate: '' }); setIsProfitModalOpen(true); }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
            >
              <BarChart3 size={18} />
              View Profit Details Breakdown
            </button>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <button type="button" onClick={() => openProfitDetails('daily')} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Today's Profit
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {isProfitLoading ? '...' : getCurrency(profitSummary?.dailyProfit || 0)}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">View today’s profit details <ChevronRight size={14} /></span>
            </button>

            <button type="button" onClick={() => openProfitDetails('monthly')} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                This Month's Profit
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {isProfitLoading ? '...' : getCurrency(profitSummary?.monthlyProfit || 0)}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">View this month’s profit details <ChevronRight size={14} /></span>
            </button>

            <button type="button" onClick={() => openProfitDetails('yearly')} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                This Year's Profit
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {isProfitLoading ? '...' : getCurrency(profitSummary?.yearlyProfit || 0)}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">View this year’s profit details <ChevronRight size={14} /></span>
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
              Admin and Pharmacist accounts, customer access, and pharmacist registration requests.
            </p>
          </div>

          <form
            className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 dark:border-slate-700 dark:bg-slate-800/50"
            onSubmit={(event) => { event.preventDefault(); createStaffMutation.mutate(); }}
          >
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 sm:col-span-2">Create staff account</h3>
            <input required value={newStaff.name} onChange={(event) => setNewStaff({ ...newStaff, name: event.target.value })} placeholder="Full name" className="rounded-lg border px-3 py-2 text-sm dark:bg-slate-900" />
            <input required type="email" value={newStaff.email} onChange={(event) => setNewStaff({ ...newStaff, email: event.target.value })} placeholder="Email" className="rounded-lg border px-3 py-2 text-sm dark:bg-slate-900" />
            <input required minLength={6} type="password" value={newStaff.password} onChange={(event) => setNewStaff({ ...newStaff, password: event.target.value })} placeholder="Temporary password (6+ characters)" className="rounded-lg border px-3 py-2 text-sm dark:bg-slate-900" />
            <div className="flex gap-3">
              <select value={newStaff.role} onChange={(event) => setNewStaff({ ...newStaff, role: event.target.value })} className="flex-1 rounded-lg border px-3 py-2 text-sm dark:bg-slate-900">
                <option value="pharmacist">Pharmacist</option>
                <option value="superadmin">Admin</option>
              </select>
              <button disabled={createStaffMutation.isPending} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Create</button>
            </div>
          </form>

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
              title="Admins"
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

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Inventory Overview
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">Click any inventory card to see all related medicines.</p>
              <button type="button" onClick={() => setSelectedView('medicines')} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700">Manage / Delete Medicines</button>
            </div>
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
              title="Expiring Within 6 Months"
              value={
                expiringWithinSixMonths.length
              }
              description="Expiry within 180 days"
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
                      getMedicinePurchasePrice(medicine) *
                        getMedicineStock(
                          medicine
                        ),
                    0
                  )
                )}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Current tablet/unit stock × purchase cost per tablet/unit
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
                                Admin
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
                              {item?.isActive === false ? 'Inactive' : (item?.accountStatus || 'Active')}
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
                              onClick={() => {
                                const name = window.prompt('User name:', item?.name || '');
                                if (name === null) return;
                                const email = window.prompt('User email:', item?.email || '');
                                if (email === null) return;
                                editUserMutation.mutate({ userId: itemId, name, email });
                              }}
                              disabled={editUserMutation.isPending}
                              className="mr-2 inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                            >Edit</button>

                            <button
                              type="button"
                              disabled={isCurrentUser || setActiveMutation.isPending}
                              onClick={() => setActiveMutation.mutate({ userId: itemId, isActive: item?.isActive === false })}
                              className="mr-2 inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 disabled:opacity-50"
                            >
                              {item?.isActive === false ? 'Activate' : 'Deactivate'}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const password = window.prompt('Enter a temporary password (at least 6 characters):');
                                if (password) resetPasswordMutation.mutate({ userId: itemId, password });
                              }}
                              disabled={resetPasswordMutation.isPending}
                              className="mr-2 inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-50"
                            >Reset password</button>

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
                    Sale / Cost per unit
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
                          <div className="font-semibold">
                            Sale: {getCurrency(getMedicinePrice(medicine))}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            Unit cost: {getCurrency(getMedicinePurchasePrice(medicine))}
                          </div>
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

                  {selectedView === 'yearlySales' && `${new Date().getFullYear()} Yearly Sales Details`}

                  {selectedView ===
                    'users' &&
                    'All Users'}

                  {selectedView ===
                    'superadmins' &&
                    'All Admins'}

                  {selectedView ===
                    'pharmacists' &&
                    'All Pharmacists'}

                  {selectedView ===
                    'customers' &&
                    'All Customers'}

                  {selectedView ===
                    'pharmacistRequests' &&
                    'Pharmacist Registration Requests'}

                  {selectedView === 'deletionRequests' && 'Medicine & Bill Deletion Requests'}
                  {selectedView === 'deletedMedicines' && 'Archived Medicines'}

                  {selectedView === 'refundActivity' && 'Refund & Return Activity'}

                  {selectedView === 'udharPaymentActivity' && 'Udhar Payment Activity'}

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
                    'Medicines Expiring Within 6 Months'}

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

                  {selectedView === 'yearlySales' && `Net sales and bills from ${new Date().getFullYear()}.`}

                  {!['todaySales', 'monthlySales', 'yearlySales'].includes(
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

              {selectedView === 'deletionRequests' && (
                <div className="space-y-3">
                  {reviewDeletionMutation.isError && (
                    <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                      {reviewDeletionMutation.error?.response?.data?.message || 'Request could not be processed. Please try again.'}
                    </div>
                  )}
                  {deletionRequests.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center text-slate-500 dark:border-slate-700">
                      No deletion requests have been submitted.
                    </div>
                  ) : deletionRequests.map((request) => (
                    <article key={request._id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{request.targetType === 'medicine' ? 'Medicine' : 'Bill'}: {request.targetLabel}</p>
                          <p className="mt-1 text-sm text-slate-500">Requested by {request.requestedBy?.name || 'Unknown'} ({request.requestedBy?.email || 'no email'}) · {formatDateTime(request.createdAt)}</p>
                          {request.requestReason && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Reason: {request.requestReason}</p>}
                          {request.reviewNote && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Admin note: {request.reviewNote}</p>}
                        </div>
                        <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold uppercase ${request.status === 'pending' ? 'bg-amber-100 text-amber-800' : request.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{request.status}</span>
                      </div>
                      {request.status === 'pending' && (
                        <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                          <button type="button" disabled={reviewDeletionMutation.isPending} onClick={() => reviewDeletionMutation.mutate({ requestId: request._id, decision: 'reject' })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200">Reject</button>
                          <button type="button" disabled={reviewDeletionMutation.isPending} onClick={() => reviewDeletionMutation.mutate({ requestId: request._id, decision: 'approve' })} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-50">
                            {reviewDeletionMutation.isPending && reviewDeletionMutation.variables?.requestId === request._id ? 'Approving…' : 'Approve & Delete'}
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}

              {selectedView === 'medicines' && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200">
                  <span>Admin can remove a medicine from active inventory immediately. Its bill and return history stays archived.</span>
                  <button type="button" onClick={() => setSelectedView('deletedMedicines')} className="rounded-lg border border-violet-300 px-3 py-2 text-xs font-bold hover:bg-violet-100 dark:border-violet-700 dark:hover:bg-violet-900/50">View archived ({archivedMedicines.length})</button>
                </div>
              )}

              {selectedView === 'refundActivity' && (
                <div className="space-y-3">
                  {returnActivity.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center text-slate-500 dark:border-slate-700">No refunds or returns recorded yet.</div>
                  ) : returnActivity.map((item) => (
                    <article key={item._id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">Bill {item.bill_number || item.sale_id?.billNumber || 'Record unavailable'} · {item.item_name || item.item_id?.name || 'Medicine'}</p>
                          <p className="mt-1 text-sm text-slate-500">Qty returned: {item.qty_returned} · Processed by: {item.processed_by?.name || 'Unknown'} · {formatDateTime(item.date)}</p>
                          {item.reason && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Reason: {item.reason}</p>}
                        </div>
                        <p className="font-bold text-amber-700 dark:text-amber-300">Refund {getCurrency(item.refund_amount)}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {selectedView === 'udharPaymentActivity' && (
                <div className="space-y-3">
                  {udharPaymentActivity.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center text-slate-500 dark:border-slate-700">No Udhar payments have been recorded yet.</div>
                  ) : udharPaymentActivity.map((payment) => (
                    <article key={payment._id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{payment.customerName || 'Customer'} {payment.customerPhone ? `· ${payment.customerPhone}` : ''}</p>
                          <p className="mt-1 text-sm text-slate-500">Received by: {payment.paidBy?.name || payment.recordedBy?.name || 'Unknown'} · {formatDateTime(payment.paidAt)}</p>
                          {payment.note && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Note: {payment.note}</p>}
                        </div>
                        <p className="font-bold text-emerald-700 dark:text-emerald-300">Paid {getCurrency(payment.amount)}</p>
                      </div>
                    </article>
                  ))}
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

              {selectedView === 'yearlySales' && (
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl bg-violet-50 p-4 dark:bg-violet-950/30">
                      <p className="text-xs font-semibold uppercase text-violet-700">Net Sales · {new Date().getFullYear()}</p>
                      <p className="mt-2 text-2xl font-bold text-violet-800 dark:text-violet-200">{getCurrency(yearlySales)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                      <p className="text-xs font-semibold uppercase text-slate-500">Bills</p>
                      <p className="mt-2 text-2xl font-bold">{yearlyBills}</p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/30">
                      <p className="text-xs font-semibold uppercase text-emerald-700">Units Sold</p>
                      <p className="mt-2 text-2xl font-bold text-emerald-800 dark:text-emerald-200">{yearlySoldMedicines.reduce((sum, item) => sum + item.quantity, 0)}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-3 font-bold text-slate-900 dark:text-white">Medicine sales for the year</h4>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                      <table className="min-w-full">
                        <thead><tr className="bg-slate-50 text-left dark:bg-slate-800"><th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Medicine</th><th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Units</th><th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Bills</th><th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Net Sales</th></tr></thead>
                        <tbody>
                          {yearlySoldMedicines.length ? yearlySoldMedicines.map((item) => (
                            <tr key={item.medicineName} className="border-t border-slate-100 dark:border-slate-800"><td className="px-4 py-3 font-medium">{item.medicineName}</td><td className="px-4 py-3">{item.quantity}</td><td className="px-4 py-3">{item.orders}</td><td className="px-4 py-3 font-semibold">{getCurrency(item.sales)}</td></tr>
                          )) : <tr><td colSpan="4" className="px-4 py-10 text-center text-sm text-slate-500">No medicine sales recorded this year.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-900 dark:text-white">Bills during {new Date().getFullYear()}</h4>
                    {yearlyBillsList.length ? yearlyBillsList.map((bill, index) => (
                      <article key={bill._id || index} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                        <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">Bill #{bill.billNumber || bill._id}</p><p className="text-xs text-slate-500">{formatDateTime(getBillDate(bill))} · {getCustomerName(bill)}</p></div><p className="font-bold text-emerald-700">{getCurrency(getBillTotal(bill))}</p></div>
                        <div className="mt-3 space-y-1 border-t pt-3 dark:border-slate-700">{getBillItems(bill).map((item, indexItem) => <p key={`${bill._id}-${indexItem}`} className="flex justify-between gap-3 text-sm"><span>{getItemName(item)} × {getItemQuantity(item)}</span><span>{getCurrency(getItemTotal(item))}</span></p>)}</div>
                      </article>
                    )) : <div className="rounded-xl border border-dashed p-10 text-center text-sm text-slate-500">No net sales bills recorded this year.</div>}
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
                'deletedMedicines',
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
                          Sale / Cost per unit
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Expiry
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                          Status
                        </th>

                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                          Admin Action
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {selectedViewData.length ===
                      0 ? (
                        <tr>
                          <td
                            colSpan="7"
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
                                  <div className="font-semibold">
                                    Sale: {getCurrency(getMedicinePrice(medicine))}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    Unit cost: {getCurrency(getMedicinePurchasePrice(medicine))}
                                  </div>
                                </td>

                                <td className="px-4 py-3 text-sm">
                                  {formatDate(
                                    getExpiryDate(
                                      medicine
                                    )
                                  )}
                                </td>

                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap gap-1.5">
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                      stock <= 0
                                        ? 'bg-red-100 text-red-700'
                                        : stock < 5
                                          ? 'bg-amber-100 text-amber-700'
                                          : stock > 20
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-emerald-100 text-emerald-700'
                                    }`}>
                                      {stock <= 0 ? 'End Stock' : stock < 5 ? 'Low Stock' : stock > 20 ? 'High Stock' : 'Stock Available'}
                                    </span>
                                    {daysLeft !== null && daysLeft < 0 ? (
                                      <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">Expired</span>
                                    ) : daysLeft !== null && daysLeft <= 180 ? (
                                      <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">
                                        Expires in {daysLeft} days
                                      </span>
                                    ) : null}
                                  </div>
                                </td>

                                <td className="px-4 py-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (selectedView === 'deletedMedicines') {
                                        restoreMedicineMutation.mutate(medicine._id || medicine.id);
                                      } else if (window.confirm(`Remove ${medicine.name || 'this medicine'} from active inventory now as Admin? The record stays archived so bill and return history remain intact.`)) {
                                        adminDeleteMedicineMutation.mutate(medicine._id || medicine.id);
                                      }
                                    }}
                                    disabled={adminDeleteMedicineMutation.isPending || restoreMedicineMutation.isPending}
                                    className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${selectedView === 'deletedMedicines' ? 'border-violet-200 text-violet-700 hover:bg-violet-50' : 'border-rose-200 text-rose-700 hover:bg-rose-50'}`}
                                  >
                                    {selectedView === 'deletedMedicines' ? <><RefreshCw size={14} /> Restore</> : <><Trash2 size={14} /> Delete</>}
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

      <ProfitDetailsModal
        key={`${profitDateRange.startDate}-${profitDateRange.endDate}`}
        isOpen={isProfitModalOpen}
        onClose={() => setIsProfitModalOpen(false)}
        initialStartDate={profitDateRange.startDate}
        initialEndDate={profitDateRange.endDate}
      />

      <StockAdjustmentModal
        isOpen={Boolean(stockAdjMedicine)}
        onClose={() => setStockAdjMedicine(null)}
        medicine={stockAdjMedicine}
      />

      <SalesReturnModal
        key={returnModalBill?._id || 'no-return-bill'}
        isOpen={Boolean(returnModalBill)}
        onClose={() => setReturnModalBill(null)}
        bill={returnModalBill}
      />
    </div>
  );
}
