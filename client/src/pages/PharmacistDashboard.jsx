import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import api from '../utils/api';
import { createMedicineInventoryWorkbook, downloadMedicineInventory } from '../utils/medicineExport';
import { getPurchaseCostPerUnit } from '../utils/medicinePricing';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ProfitDetailsModal from '../components/ProfitDetailsModal';
import MedicineImportIssues from '../components/MedicineImportIssues';
import MedicineExpiryAlerts from '../components/MedicineExpiryAlerts';
import MedicineAuditHistory from '../components/MedicineAuditHistory';
import PurchaseOrdersPanel from '../components/PurchaseOrdersPanel';
import DailyClosingReport from '../components/DailyClosingReport';
import StockAdjustmentModal from '../components/StockAdjustmentModal';
import SalesReturnModal from '../components/SalesReturnModal';
import UdharManagement from './UdharManagement';
import * as XLSX from 'xlsx';
import { QRCodeSVG } from 'qrcode.react';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import {
  LayoutDashboard,
  Pill,
  Plus,
  Edit2,
  Trash2,
  Search,
  AlertTriangle,
  CheckCircle,
  X,
  Calendar,
  RefreshCw,
  Barcode,
  Database,
  Upload,
  Eye,
  EyeOff,
  Bell,
  Settings,
  Receipt,
  Users,
  LogOut,
  Lock,
  User,
  Menu,
  FileText,
  Download,
  Play,
  Wallet,
  TrendingUp,
  Package,
  Clock,
  Building2,
  Tag,
  Layers,
  ClipboardList,
  ShoppingCart,
  ArrowRight,
  Camera,
  Smartphone,
} from 'lucide-react';

// ============================================================================
// HELPERS
// ============================================================================

const getDaysLeft = (expiryDate) => {
  if (!expiryDate) {
    return null;
  }

  const expiry = new Date(expiryDate);

  if (Number.isNaN(expiry.getTime())) {
    return null;
  }

  const diffTime = expiry.getTime() - Date.now();

  return Math.ceil(
    diffTime / (1000 * 60 * 60 * 24)
  );
};

const getStockStatus = (quantity) => {
  const stock = Number(quantity) || 0;
  if (stock <= 0) return 'End Stock';
  if (stock < 5) return 'Low Stock';
  if (stock > 20) return 'High Stock';
  return 'Stock Available';
};

const getStockBadgeClass = (status) => {
  if (status === 'End Stock' || status === 'Low Stock') {
    return 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-500/30';
  }
  if (status === 'High Stock') {
    return 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-500/30';
  }
  return 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-500/30';
};

const getCurrency = (amount = 0) => {
  return `PKR ${Number(amount || 0).toFixed(2)}`;
};

const getDot = () => '·';

const formatDate = (value) => {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleDateString();
};

const formatDateTime = (value) => {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleString();
};

const safeText = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
};

// ============================================================================
// EXPIRY BADGE
// ============================================================================

const getExpiryBadgeClass = (status) => {
  const classes = {
    EXPIRED:
      'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-500/30',

    CRITICAL:
      'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-500/30',

    WARNING:
      'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-500/30',

    CAUTION:
      'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-500/30',

    SAFE:
      'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-500/30',
  };

  return (
    classes[status] ||
    'bg-slate-50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600'
  );
};

const ExpiryBadge = ({ status }) => {
  return (
    <span
      className={`text-[10px] font-bold uppercase px-2 py-1 rounded whitespace-nowrap ${getExpiryBadgeClass(
        status
      )}`}
    >
      {status || 'N/A'}
    </span>
  );
};

// ============================================================================
// CATEGORY BADGE
// ============================================================================

const CategoryBadge = ({ category }) => {
  const classes = {
    'Pain Relief':
      'bg-amber-50 text-amber-800',

    Analgesic:
      'bg-amber-50 text-amber-800',

    Antibiotic:
      'bg-blue-50 text-blue-800',

    Antihistamine:
      'bg-cyan-50 text-cyan-800',

    Antiviral:
      'bg-indigo-50 text-indigo-800',

    Cardiovascular:
      'bg-red-50 text-red-800',

    Diabetes:
      'bg-purple-50 text-purple-800',

    'Vitamins/Supplements':
      'bg-green-50 text-green-800',

    Vitamin:
      'bg-green-50 text-green-800',

    Other:
      'bg-slate-100 text-slate-700 dark:text-slate-200',
  };

  return (
    <span
      className={`text-[10px] font-semibold px-2 py-1 rounded whitespace-nowrap ${
        classes[category] ||
        'bg-slate-100 text-slate-700 dark:text-slate-200'
      }`}
    >
      {category || 'Other'}
    </span>
  );
};

// ============================================================================
// DASHBOARD
// ============================================================================

const PharmacistDashboard = () => {
  const {
    user: currentUser,
    logout,
    updateProfile,
  } = useAuth();

  const { resolvedTheme, toggle } = useTheme();

  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const fileInputRef = useRef(null);
  const billScanInputRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const cameraTargetRef = useRef('medicine');

  const [activeTab, setActiveTab] = useState(
    location.state?.activeTab || 'dashboard'
  );

  const [isSidebarMobileOpen, setIsSidebarMobileOpen] =
    useState(false);

  // ==========================================================================
  // SEARCH / FILTER
  // ==========================================================================

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] =
    useState('');
  const [expiryStatusFilter, setExpiryStatusFilter] =
    useState('');
  const [reorderFilter, setReorderFilter] =
    useState(false);
  const [medicineViewFilter, setMedicineViewFilter] =
    useState('ALL');

  // ==========================================================================
  // DETAILS
  // ==========================================================================

  const [selectedMedicine, setSelectedMedicine] =
    useState(null);

  const [selectedBill, setSelectedBill] =
    useState(null);

  const [salesDetailsType, setSalesDetailsType] =
    useState(null);

  // ==========================================================================
  // MEDICINE MODAL
  // ==========================================================================

  const [medModalOpen, setMedModalOpen] =
    useState(false);

  const [bulkModalOpen, setBulkModalOpen] =
    useState(false);

  const [editingMedicine, setEditingMedicine] =
    useState(null);

  const [ocrLoading, setOcrLoading] =
    useState(false);

  const [ocrPreview, setOcrPreview] =
    useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraTarget, setCameraTarget] = useState('medicine');

  const [mobileScannerSession, setMobileScannerSession] = useState(null);
  const [mobileScannerUrl, setMobileScannerUrl] = useState('');
  const [mobileScannerActive, setMobileScannerActive] = useState(false);
  const [mobileConnected, setMobileConnected] = useState(false);
  const mobilePollIntervalRef = useRef(null); // kept for cleanup
  const mobileScannerWsRef = useRef(null);
  const mobileScannerReconnectRef = useRef(null);
  const mobileScannerActiveRef = useRef(false);

  const [error, setError] =
    useState('');

  // ==========================================================================
  // MEDICINE FORM
  // ==========================================================================

  const [name, setName] = useState('');
  const [genericName, setGenericName] =
    useState('');
  const [manufacturer, setManufacturer] =
    useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [expiryDate, setExpiryDate] =
    useState('');
  const [quantity, setQuantity] =
    useState('');
  const [reorderLevel, setReorderLevel] =
    useState('10');
  const [price, setPrice] =
    useState('');
  const [purchasePrice, setPurchasePrice] =
    useState('');
  const [unitsPerPack, setUnitsPerPack] = useState('1');
  const [isProfitModalOpen, setIsProfitModalOpen] =
    useState(false);
  const [profitDateRange, setProfitDateRange] = useState({ startDate: '', endDate: '' });
  const [stockAdjMedicine, setStockAdjMedicine] =
    useState(null);
  const [returnModalBill, setReturnModalBill] =
    useState(null);
  const [category, setCategory] =
    useState('Antibiotic');
  const [barcode, setBarcode] =
    useState('');
  const [rackLocation, setRackLocation] =
    useState('');
  const [labelImageUrl, setLabelImageUrl] =
    useState('');

  // ==========================================================================
  // ONLINE ORDER ACTIONS
  // ==========================================================================

  const updateOnlineOrderMutation =
    useMutation({
      mutationFn: async ({
        orderId,
        action,
        rejectionReason,
      }) => {
        const response = await api.put(
          `/bills/online-orders/${orderId}/${action}`,
          rejectionReason
            ? { rejectionReason }
            : {}
        );

        return response.data;
      },

      onSuccess: async () => {
        await refetchOnlineOrders();
        await refetchMeds();
        await refetchBills();
        await refetchSalesSummary();

        queryClient.invalidateQueries({
          queryKey: ['onlineOrders'],
        });
        queryClient.invalidateQueries({
          queryKey: ['medicines'],
        });
        queryClient.invalidateQueries({
          queryKey: ['bills'],
        });
        queryClient.invalidateQueries({
          queryKey: ['salesSummary'],
        });
      },

      onError: (err) => {
        alert(
          err.response?.data?.message ||
            'Unable to update order status'
        );
      },
    });

  const handleAcceptOnlineOrder = (orderId) => {
    if (!orderId) return;

    const confirmed = window.confirm(
      'Accept this customer order? Stock will be reserved/deducted and the customer will be notified.'
    );

    if (!confirmed) return;

    updateOnlineOrderMutation.mutate({
      orderId,
      action: 'accept',
    });
  };

  const handleRejectOnlineOrder = (orderId) => {
    if (!orderId) return;

    const rejectionReason = window.prompt(
      'Reason for rejecting this order (optional):'
    );

    if (rejectionReason === null) return;

    updateOnlineOrderMutation.mutate({
      orderId,
      action: 'reject',
      rejectionReason: rejectionReason.trim(),
    });
  };

  // ==========================================================================
  // BULK IMPORT
  // ==========================================================================

  const [importMode, setImportMode] = useState('excel'); // 'excel' or 'json'
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkData, setBulkData] = useState([]);
  const [bulkPreviewResult, setBulkPreviewResult] = useState(null);
  const [bulkJson, setBulkJson] = useState('');

  const [bulkError, setBulkError] =
    useState('');

  const [bulkSuccess, setBulkSuccess] =
    useState('');
  const [isExportingMedicines, setIsExportingMedicines] =
    useState(false);
  const [isDashboardRefreshing, setIsDashboardRefreshing] =
    useState(false);
  const [dashboardRefreshMessage, setDashboardRefreshMessage] = useState('');

  // ==========================================================================
  // BILLING
  // ==========================================================================

  const [billSearch, setBillSearch] =
    useState('');

  const [billCategory, setBillCategory] =
    useState('');

  const [selectedCustomerId, setSelectedCustomerId] =
    useState('');

  const [customerName, setCustomerName] =
    useState('');

  const [guestPhone, setGuestPhone] =
    useState('');

  const [billItems, setBillItems] =
    useState([]);

  const [discount, setDiscount] =
    useState('');

  const [billError, setBillError] =
    useState('');

  const [isBillingPending, setIsBillingPending] =
    useState(false);

  const [confirmedBill, setConfirmedBill] =
    useState(null);

  // ==========================================================================
  // NOTIFICATIONS
  // ==========================================================================

  const [triggerLoading, setTriggerLoading] =
    useState(null);

  // ==========================================================================
  // PROFILE
  // ==========================================================================

  const [profileName, setProfileName] =
    useState(currentUser?.name || '');

  const [profileSuccess, setProfileSuccess] =
    useState('');

  const [profileError, setProfileError] =
    useState('');

  const [currentPassword, setCurrentPassword] =
    useState('');

  const [newPassword, setNewPassword] =
    useState('');

  const [passwordSuccess, setPasswordSuccess] =
    useState('');

  const [passwordError, setPasswordError] =
    useState('');

  const [showCurrentPassword, setShowCurrentPassword] =
    useState(false);

  const [showNewPassword, setShowNewPassword] =
    useState(false);

  // ==========================================================================
  // CATEGORIES
  // ==========================================================================

  const standardCategories = [
    'Antibiotic',
    'Analgesic',
    'Antihistamine',
    'Antiviral',
    'Cardiovascular',
    'Diabetes',
    'Vitamins/Supplements',
    'Other',
  ];

  // ==========================================================================
  // MEDICINES QUERY
  // ==========================================================================

  const {
    data: medicines = [],
    isLoading: isMedsLoading,
    isFetching: isMedsFetching,
    refetch: refetchMeds,
  } = useQuery({
    queryKey: [
      'medicines',
      search,
      categoryFilter,
      expiryStatusFilter,
      reorderFilter,
    ],

    queryFn: async () => {
      const params = {};

      if (search) {
        params.search = search;
      }

      if (categoryFilter) {
        params.category = categoryFilter;
      }

      if (expiryStatusFilter) {
        params.status = expiryStatusFilter;
      }

      if (reorderFilter) {
        params.reorder = 'true';
      }

      const response = await api.get(
        '/medicines',
        {
          params,
        }
      );

      return Array.isArray(response.data)
        ? response.data
        : [];
    },
  });

  // ==========================================================================
  // BILLS QUERY
  // ==========================================================================

  const {
    data: bills = [],
    isLoading: isBillsLoading,
    isFetching: isBillsFetching,
    refetch: refetchBills,
  } = useQuery({
    queryKey: ['bills'],

    queryFn: async () => {
      const response =
        await api.get('/bills');

      return Array.isArray(response.data)
        ? response.data
        : [];
    },
  });

  // ==========================================================================
  // ONLINE ORDERS
  // ==========================================================================

  const {
    data: onlineOrders = [],
    isLoading: isOrdersLoading,
    isFetching: isOrdersFetching,
    refetch: refetchOnlineOrders,
  } = useQuery({
    queryKey: ['onlineOrders'],

    queryFn: async () => {
      const response = await api.get(
        '/bills/online-orders'
      );

      return Array.isArray(response.data)
        ? response.data
        : [];
    },

    refetchInterval: 15000,
  });

  const pendingOnlineOrders = onlineOrders.filter(
    (order) => order?.orderStatus === 'PENDING'
  );

  // ==========================================================================
  // SALES SUMMARY
  // ==========================================================================

  const {
    data: salesSummary,
    isLoading: isSalesSummaryLoading,
    refetch: refetchSalesSummary,
  } = useQuery({
    queryKey: ['salesSummary'],

    queryFn: async () => {
      const response =
        await api.get(
          '/bills/sales-summary'
        );

      return response.data || {};
    },
  });

  const refreshDashboardData = async () => {
    if (isDashboardRefreshing) return;
    setIsDashboardRefreshing(true);
    setDashboardRefreshMessage('');
    try {
      const results = await Promise.allSettled([
        refetchMeds({ throwOnError: true }),
        refetchBills({ throwOnError: true }),
        refetchSalesSummary({ throwOnError: true }),
        refetchOnlineOrders({ throwOnError: true }),
        refetchProfitSummary({ throwOnError: true }),
      ]);
      if (results.some((result) => result.status === 'rejected')) {
        setDashboardRefreshMessage('Some dashboard data could not be refreshed. Check the connection and retry.');
      } else setDashboardRefreshMessage('Dashboard data updated.');
    } catch {
      setDashboardRefreshMessage('Dashboard refresh failed. Check the connection and retry.');
    } finally {
      setIsDashboardRefreshing(false);
    }
  };

  // ==========================================================================
  // PROFIT SUMMARY
  // ==========================================================================

  const {
    data: profitSummary,
    isLoading: isProfitLoading,
    refetch: refetchProfitSummary,
  } = useQuery({
    queryKey: ['profitSummary'],
    queryFn: async () => {
      const response = await api.get('/bills/profit-summary');
      return response.data || {};
    },
  });

  // ==========================================================================
  // CUSTOMERS
  // ==========================================================================

  const {
    data: customers = [],
    isLoading: isCustomersLoading,
  } = useQuery({
    queryKey: ['customers'],

    queryFn: async () => {
      const response =
        await api.get(
          '/users/customers'
        );

      return Array.isArray(response.data)
        ? response.data
        : [];
    },
  });

  const {
    data: pendingCustomers = [],
    isLoading: isPendingCustomersLoading,
  } = useQuery({
    queryKey: ['pendingCustomers'],
    enabled: currentUser?.role === 'superadmin',
    queryFn: async () => {
      const response = await api.get(
        '/users/pending-customers'
      );

      return Array.isArray(response.data)
        ? response.data
        : [];
    },
  });

  const updateCustomerStatusMutation = useMutation({
    mutationFn: async ({ customerId, action }) => {
      const response = await api.put(
        `/users/${customerId}/${action}-customer`
      );

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['pendingCustomers'],
      });
      queryClient.invalidateQueries({
        queryKey: ['customers'],
      });
    },
    onError: (err) => {
      setBillError(
        err.response?.data?.message ||
          'Unable to update customer approval'
      );
    },
  });

  // ==========================================================================
  // SALES VALUES
  // ==========================================================================

  const todaySales = Number(
    salesSummary?.today?.totalSales || 0
  );

  const todayBills = Number(
    salesSummary?.today?.totalBills || 0
  );

  const yearlySales = Number(salesSummary?.year?.totalSales || 0);
  const yearlyBills = Number(salesSummary?.year?.totalBills || 0);

  const monthlySales = Number(
    salesSummary?.month?.totalSales || 0
  );

  const monthlyBills = Number(
    salesSummary?.month?.totalBills || 0
  );

  // ==========================================================================
  // CREATE MEDICINE
  // ==========================================================================

  const createMedMutation =
    useMutation({
      mutationFn: async (medicineData) => {
        const response =
          await api.post(
            '/medicines',
            medicineData
          );

        return response.data;
      },

      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['medicines'],
        });

        closeMedModal();
      },

      onError: (err) => {
        setError(
          err.response?.data?.message ||
            'Failed to add medicine'
        );
      },
    });

  // ==========================================================================
  // UPDATE MEDICINE
  // ==========================================================================

  const updateMedMutation =
    useMutation({
      mutationFn: async ({
        id,
        updatedData,
      }) => {
        const response =
          await api.put(
            `/medicines/${id}`,
            updatedData
          );

        return response.data;
      },

      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['medicines'],
        });

        closeMedModal();
      },

      onError: (err) => {
        setError(
          err.response?.data?.message ||
            'Failed to update medicine'
        );
      },
    });

  // ==========================================================================
  // DELETE MEDICINE
  // ==========================================================================

  const deleteMedMutation =
    useMutation({
      mutationFn: async (id) => {
        const response =
          await api.post(
            `/deletion-requests/medicine/${id}`
          );

        return response.data;
      },

      onSuccess: () => {
        alert('Deletion request sent to Admin. The medicine will remain until approval.');
        queryClient.invalidateQueries({
          queryKey: ['medicines'],
        });

      },

      onError: (err) => {
        alert(
          err.response?.data?.message ||
            'Failed to request medicine deletion'
        );
      },
    });

  const requestBillDeletionMutation = useMutation({
    mutationFn: async (billId) => (await api.delete(`/bills/${billId}`)).data,
    onSuccess: () => alert('Deletion request sent to Admin. The bill remains active until approval.'),
    onError: (err) => alert(err.response?.data?.message || 'Failed to request bill deletion.'),
  });

  // ==========================================================================
  // BULK IMPORT
  // ==========================================================================

  const bulkImportMutation =
    useMutation({
      mutationFn: async ({ data, dryRun }) => {
        const response =
          await api.post(
            '/medicines/bulk',
            { medicines: data, sourceFile: bulkFile?.name || 'JSON bulk import', dryRun }
          );

        return response.data;
      },

      onSuccess: (data, variables) => {
        if (variables.dryRun) {
          setBulkPreviewResult(data);
          setBulkError('');
          return;
        }
        queryClient.invalidateQueries({
          queryKey: ['medicines'],
        });
        queryClient.invalidateQueries({ queryKey: ['medicineImportIssues'] });

        setBulkSuccess(
          `Imported ${
            data?.insertedCount || 0
          } medicines. Skipped ${
            data?.skippedCount || 0
        }. Invalid rows are saved for Admin and Pharmacist review.`
        );

        setBulkFile(null);
        setBulkData([]);
        setBulkJson('');
        setBulkPreviewResult(null);
      },

      onError: (err) => {
        setBulkError(
          err.response?.data?.message ||
            'Bulk import failed'
        );
      },
    });

  // ==========================================================================
  // MEDICINE MODAL
  // ==========================================================================

  const openAddModal = () => {
    setEditingMedicine(null);

    setName('');
    setGenericName('');
    setManufacturer('');
    setSupplierName('');
    setSupplierPhone('');
    setExpiryDate('');
    setQuantity('');
    setReorderLevel('10');
    setPrice('');
    setPurchasePrice('');
    setUnitsPerPack('1');
    setCategory('Antibiotic');
    setBarcode('');
    setRackLocation('');
    setLabelImageUrl('');
    setOcrPreview(null);
    setError('');

    setMedModalOpen(true);
  };

  const openEditModal = (medicine) => {
    setEditingMedicine(medicine);

    setName(medicine?.name || '');

    setGenericName(
      medicine?.genericName || ''
    );

    setManufacturer(
      medicine?.manufacturer || ''
    );
    setSupplierName(medicine?.supplierName || '');
    setSupplierPhone(medicine?.supplierPhone || '');


    setExpiryDate(
      medicine?.expiryDate
        ? new Date(
            medicine.expiryDate
          )
            .toISOString()
            .split('T')[0]
        : ''
    );


    setQuantity(
      medicine?.quantity ?? ''
    );

    setReorderLevel(
      medicine?.reorderLevel ?? 10
    );

    setPrice(
      medicine?.price ?? ''
    );

    setPurchasePrice(
      medicine?.purchasePrice ?? ''
    );
    setUnitsPerPack(String(medicine?.unitsPerPack ?? 1));

    setCategory(
      medicine?.category || 'Other'
    );

    setBarcode(
      medicine?.barcode || ''
    );

    setRackLocation(
      medicine?.rackLocation || ''
    );

    setLabelImageUrl(
      medicine?.labelImageUrl || ''
    );

    setError('');
    setMedModalOpen(true);
  };

  const closeMedModal = () => {
    setMedModalOpen(false);
    setEditingMedicine(null);
    setError('');
  };

  // ==========================================================================
  // DETAILS
  // ==========================================================================

  const openMedicineDetails = (medicine) => {
    setSelectedMedicine(medicine);
  };

  const closeMedicineDetails = () => {
    setSelectedMedicine(null);
  };

  const openBillDetails = (bill) => {
    setSelectedBill(bill);
  };

  const closeBillDetails = () => {
    setSelectedBill(null);
  };

  const openSalesDetails = (type) => {
    setSalesDetailsType(type);
  };

  const openProfitDetails = (period) => {
    const now = new Date();
    const start = period === 'daily'
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : period === 'monthly'
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : new Date(now.getFullYear(), 0, 1);
    const end = period === 'daily'
      ? start
      : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const asInputDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    setProfitDateRange({ startDate: asInputDate(start), endDate: asInputDate(end) });
    setIsProfitModalOpen(true);
  };

  const closeSalesDetails = () => {
    setSalesDetailsType(null);
  };

  // ==========================================================================
  // SALES DETAIL CALCULATIONS
  // ==========================================================================

  const getSalesBills = (type) => {
    const currentDate = new Date();

    return bills.filter(
      (bill) => {
        if (
          !bill?.createdAt ||
          bill?.orderStatus === 'PENDING' ||
          bill?.orderStatus === 'REJECTED'
        ) {
          return false;
        }

        const billDate =
          new Date(
            bill.createdAt
          );

        if (
          Number.isNaN(
            billDate.getTime()
          )
        ) {
          return false;
        }

        if (
          type === 'yearly' &&
          Number(bill.netTotal ?? Math.max(0, Number(bill.total || 0) - Number(bill.totalRefunded || 0))) <= 0
        ) {
          return false;
        }

        if (
          type === 'daily'
        ) {
          return (
            billDate.toDateString() ===
            currentDate.toDateString()
          );
        }

        if (
          type === 'monthly'
        ) {
          return (
            billDate.getMonth() ===
              currentDate.getMonth() &&
            billDate.getFullYear() ===
              currentDate.getFullYear()
          );
        }

        if (type === 'yearly') {
          return billDate.getFullYear() === currentDate.getFullYear();
        }

        return false;
      }
    );
  };

  const selectedSalesBills =
    salesDetailsType
      ? getSalesBills(
          salesDetailsType
        )
      : [];

  const selectedSalesTotal =
    selectedSalesBills.reduce(
      (sum, bill) =>
        sum +
        (bill?.netTotal ??
          Math.max(
            0,
            Number(bill?.total || 0) -
              Number(bill?.totalRefunded || 0)
          )),
      0
    );

  const selectedSalesBillCount =
    selectedSalesBills.length;

  const selectedSalesAverage =
    selectedSalesBillCount >
    0
      ? selectedSalesTotal /
        selectedSalesBillCount
      : 0;

  // ==========================================================================
  // DASHBOARD NAVIGATION
  // ==========================================================================

  const showAllMedicines = () => {
    setSearch('');
    setCategoryFilter('');
    setExpiryStatusFilter('');
    setReorderFilter(false);
    setMedicineViewFilter('ALL');
    setActiveTab('medicines');
  };

  const showExpiredMedicines = () => {
    setSearch('');
    setCategoryFilter('');
    setExpiryStatusFilter('EXPIRED');
    setReorderFilter(false);
    setMedicineViewFilter('ALL');
    setActiveTab('medicines');
  };

  const showExpiringSixMonths = () => {
    setSearch('');
    setCategoryFilter('');
    setExpiryStatusFilter('EXPIRING');
    setReorderFilter(false);
    setMedicineViewFilter('ALL');
    setActiveTab('medicines');
  };

  const showLowStockMedicines = () => {
    setSearch('');
    setCategoryFilter('');
    setExpiryStatusFilter('');
    setReorderFilter(false);
    setMedicineViewFilter(
      'LOW_STOCK'
    );
    setActiveTab('medicines');
  };

  // ==========================================================================
  // MEDICINE SUBMIT
  // ==========================================================================

  const handleMedSubmit = (event) => {
    event.preventDefault();

    setError('');

    if (
      !name.trim() ||
      !manufacturer.trim() ||
      !expiryDate ||
      purchasePrice === '' ||
      price === '' ||
      quantity === ''
    ) {
      setError(
        'Please fill all required medicine fields'
      );

      return;
    }

    const purchaseValue = Number(purchasePrice) || 0;
    const saleValue = Number(price);
    const packSize = Number(unitsPerPack);

    if (!Number.isInteger(packSize) || packSize < 1) {
      setError('Units per pack must be a positive whole number.');
      return;
    }

    if (!Number.isFinite(purchaseValue) || purchaseValue <= 0 || !Number.isFinite(saleValue) || saleValue <= 0) {
      setError('Pack purchase price and unit sale price must both be greater than zero.');
      return;
    }

    const medicineData = {
      name: name.trim(),
      genericName:
        genericName.trim(),
      manufacturer:
        manufacturer.trim(),
      supplierName: supplierName.trim(),
      supplierPhone: supplierPhone.trim(),
      expiryDate,
      quantity:
        Number(quantity),
      reorderLevel:
        Number(
          reorderLevel || 10
        ),
      price: Number(price),
      purchasePrice: Number(purchasePrice) || 0,
      unitsPerPack: packSize,
      category,
      barcode:
        barcode.trim(),
      rackLocation:
        rackLocation.trim(),
      labelImageUrl:
        labelImageUrl.trim(),
    };

    if (editingMedicine) {
      updateMedMutation.mutate({
        id: editingMedicine._id,
        updatedData:
          medicineData,
      });
    } else {
      createMedMutation.mutate(
        medicineData
      );
    }
  };

  // ==========================================================================
  // OCR
  // ==========================================================================

  const handleOcrFileChange =
    async (event) => {
      const file =
        event.target.files?.[0];

      if (!file) {
        return;
      }

      await processScannedLabel(file, 'medicine');

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

  const processScannedLabel = async (file, target) => {
      const formData =
        new FormData();

      formData.append(
        'labelImage',
        file
      );

      setOcrLoading(true);
      setError('');

      try {
        const response =
          await api.post(
            '/medicines/scan-label',
            formData,
            {
              headers: {
                'Content-Type':
                  'multipart/form-data',
              },
            }
          );

        const data =
          response.data || {};

        setOcrPreview({
          medicineName: data.medicineName || '',
          genericName: data.genericName || '',
          expiryDate: data.expiryDate || '',
          scannedPrices: data.scannedPrices || {},
          confidence: data.confidence || 'low',
        });

        if (data.medicineName) {
          setName(
            data.medicineName
          );
        }

        if (data.genericName) {
          setGenericName(
            data.genericName
          );
        }

        if (data.manufacturer) {
          setManufacturer(
            data.manufacturer
          );
        }

        if (data.expiryDate) {
          setExpiryDate(
            data.expiryDate
          );
        }

        if (data.barcode) {
          setBarcode(
            data.barcode
          );
        }

        if (data.rackLocation) {
          setRackLocation(
            data.rackLocation
          );
        }

        if (data.labelImageUrl) {
          setLabelImageUrl(
            data.labelImageUrl
          );
        }

        if (target === 'bill') {
          const scannedName = String(data.medicineName || '').trim().toLowerCase();
          const scannedGeneric = String(data.genericName || '').trim().toLowerCase();
          const usableName = scannedName && scannedName !== 'unknown';
          const usableGeneric = scannedGeneric && scannedGeneric !== 'unknown';
          const match = medicines.find((medicine) => {
            const medicineName = String(medicine.name || '').toLowerCase();
            const genericNameValue = String(medicine.genericName || '').toLowerCase();
            return (
              (usableName && (medicineName.includes(scannedName) || scannedName.includes(medicineName))) ||
              (usableGeneric && (genericNameValue.includes(scannedGeneric) || scannedGeneric.includes(genericNameValue)))
            );
          });
          if (!match) {
            setBillError(`Could not match "${data.medicineName || data.genericName || 'scanned medicine'}" to inventory. Search by name or barcode instead.`);
          } else if (match.expiryStatus === 'EXPIRED' || Number(match.quantity) <= 0) {
            setBillError(`${match.name} is expired or out of stock and cannot be added to a bill.`);
          } else {
            setBillError('');
            handleAddToBill(match);
          }
        }
      } catch (err) {
        const message = err.response?.data?.message || 'OCR scan failed';
        if (target === 'bill') setBillError(message);
        else setError(message);
      } finally {
        setOcrLoading(false);
      }
    };

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraActive(false);
  };

  const startCamera = async (target) => {
    cameraTargetRef.current = target;
    setCameraTarget(target);
    setError('');
    setBillError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      const message = 'Live camera access is unavailable. It requires localhost or HTTPS; you can still choose an image. To use a phone camera, open the pharmacy app on the phone itself.';
      if (target === 'bill') setBillError(message);
      else setError(message);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
      cameraStreamRef.current = stream;
      setCameraActive(true);
    } catch (cameraError) {
      const message = cameraError.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access in your browser settings and try again.'
        : `Unable to open the camera: ${cameraError.message}`;
      if (target === 'bill') setBillError(message);
      else setError(message);
    }
  };

  useEffect(() => {
    if (cameraActive && cameraVideoRef.current && cameraStreamRef.current) {
      cameraVideoRef.current.srcObject = cameraStreamRef.current;
      cameraVideoRef.current.play().catch((playError) => {
        console.error('Unable to start camera preview:', playError);
      });
    }
  }, [cameraActive]);

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const captureCameraImage = async () => {
    const video = cameraVideoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      const message = 'Camera is not ready yet. Wait for the preview and try again.';
      if (cameraTargetRef.current === 'bill') setBillError(message);
      else setError(message);
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) {
      const message = 'Could not capture the camera image. Please try again.';
      if (cameraTargetRef.current === 'bill') setBillError(message);
      else setError(message);
      return;
    }

    const target = cameraTargetRef.current;
    stopCamera();
    await processScannedLabel(new File([blob], 'medicine-camera-capture.jpg', { type: 'image/jpeg' }), target);
  };

  // ── Mobile Scanner: WebSocket-based real-time ─────────────────────────────
  const processScanResult = (text, target) => {
    if (!text) return;
    const scannedNorm = String(text).trim().toLowerCase();

    if (target === 'bill') {
      const match = medicines?.find(m =>
        String(m.barcode || '').trim().toLowerCase() === scannedNorm ||
        String(m.name || '').trim().toLowerCase().includes(scannedNorm) ||
        scannedNorm.includes(String(m.name || '').trim().toLowerCase())
      );
      if (match) {
        if (match.expiryStatus === 'EXPIRED' || Number(match.quantity) <= 0) {
          setBillError(`${match.name} is expired or out of stock.`);
        } else {
          setBillError('');
          handleAddToBill(match);
        }
      } else {
        setBillError('Scanned barcode not found in inventory: ' + text);
      }
    } else {
      // Medicine form: barcode is safe to apply directly. If it belongs to an
      // existing inventory item, use that saved record to prefill the form.
      setBarcode(text);
      const match = medicines?.find(medicine => String(medicine.barcode || '').trim().toLowerCase() === scannedNorm);
      if (match) {
        setName(match.name || '');
        setGenericName(match.genericName || '');
        setManufacturer(match.manufacturer || '');
        setExpiryDate(match.expiryDate ? new Date(match.expiryDate).toISOString().slice(0, 10) : '');
        setPurchasePrice(match.purchasePrice ?? '');
        setUnitsPerPack(String(match.unitsPerPack ?? 1));
        setPrice(match.price ?? '');
        setQuantity(match.quantity ?? '');
        setCategory(match.category || 'Other');
        setOcrPreview({ medicineName: match.name || '', genericName: match.genericName || '', expiryDate: '', scannedPrices: {}, confidence: 'matched to inventory' });
      }
    }
  };

  const connectMobileScannerWs = (sessionId, target) => {
    const wsHost = window.location.hostname;
    const wsPort = window.location.port || '5173';
    // On the laptop browser window.location.hostname is localhost, but the WS proxy handles it
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/ws/scanner?sessionId=${encodeURIComponent(sessionId)}&role=laptop`;
    const ws = new WebSocket(wsUrl);
    mobileScannerWsRef.current = ws;

    ws.onopen = () => {
      setMobileConnected(false); // phone not yet connected
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'mobile_connected') {
          setMobileConnected(true);
        }
        if (msg.type === 'mobile_disconnected') {
          setMobileConnected(false);
        }
        if (msg.type === 'scan_result') {
          processScanResult(msg.data?.barcode, target);
        }
        if (msg.type === 'ocr_result' && target === 'medicine') {
          setOcrPreview({
            medicineName: '',
            genericName: '',
            expiryDate: '',
            scannedPrices: {},
            confidence: Number(msg.data?.confidence || 0) >= 55 ? 'review text' : 'low',
            rawText: msg.data?.rawText || '',
          });
        }
      } catch {}
    };
    ws.onclose = () => {
      setMobileConnected(false);
      if (mobileScannerActiveRef.current) {
        clearTimeout(mobileScannerReconnectRef.current);
        mobileScannerReconnectRef.current = setTimeout(() => {
          if (mobileScannerActiveRef.current) connectMobileScannerWs(sessionId, target);
        }, 2500);
      }
    };
  };

  const startMobileScanner = async (target) => {
    try {
      mobileScannerActiveRef.current = false;
      if (mobileScannerReconnectRef.current) clearTimeout(mobileScannerReconnectRef.current);
      if (mobilePollIntervalRef.current) clearInterval(mobilePollIntervalRef.current);
      mobileScannerWsRef.current?.close();
      const response = await api.get('/mobile-scanner/url', {
        params: { frontendPort: window.location.port || '5174' },
      });
      const { scannerUrl, sessionId } = response.data;
      mobileScannerActiveRef.current = true;
      setMobileScannerUrl(scannerUrl);
      setMobileScannerSession(sessionId);
      setMobileScannerActive(true);
      setMobileConnected(false);
      cameraTargetRef.current = target;
      connectMobileScannerWs(sessionId, target);
      if (mobilePollIntervalRef.current) clearInterval(mobilePollIntervalRef.current);
      mobilePollIntervalRef.current = setInterval(async () => {
        try {
          const status = await api.get(`/mobile-scanner/status/${sessionId}`);
          if (status.data.scannerUrl) setMobileScannerUrl(status.data.scannerUrl);
          setMobileConnected(Boolean(status.data.mobileConnected));
          const pending = await api.get(`/mobile-scanner/results/${sessionId}`);
          if (pending.data.result?.type === 'scan_result') {
            processScanResult(pending.data.result.data?.barcode, target);
          } else if (pending.data.result?.type === 'ocr_result' && target === 'medicine') {
            setOcrPreview({
              medicineName: '', genericName: '', expiryDate: '', scannedPrices: {},
              confidence: Number(pending.data.result.data?.confidence || 0) >= 55 ? 'review text' : 'low',
              rawText: pending.data.result.data?.rawText || '',
            });
          }
        } catch {
          // A brief LAN interruption is reflected by the WebSocket status and retried next poll.
        }
      }, 5000);
      if (target === 'bill') setBillError('');
      else setError('');
    } catch (err) {
      const msg = 'Could not start mobile scanner: ' + (err.response?.data?.message || err.message);
      if (target === 'bill') setBillError(msg);
      else setError(msg);
    }
  };

  const stopMobileScanner = () => {
    mobileScannerActiveRef.current = false;
    setMobileScannerActive(false);
    setMobileScannerSession(null);
    setMobileConnected(false);
    if (mobileScannerWsRef.current) {
      if (mobileScannerReconnectRef.current) clearTimeout(mobileScannerReconnectRef.current);
      mobileScannerWsRef.current.close();
      mobileScannerWsRef.current = null;
    }
    if (mobilePollIntervalRef.current) clearInterval(mobilePollIntervalRef.current);
  };

  useEffect(() => {
    return () => {
      mobileScannerActiveRef.current = false;
      if (mobilePollIntervalRef.current) clearInterval(mobilePollIntervalRef.current);
      if (mobileScannerReconnectRef.current) clearTimeout(mobileScannerReconnectRef.current);
      if (mobileScannerWsRef.current) mobileScannerWsRef.current.close();
    };
  }, []);

  // ==========================================================================
  // BULK
  // ==========================================================================

  const downloadExcelTemplate = () => {
    XLSX.writeFile(createMedicineInventoryWorkbook([]), 'Medicine_Bulk_Import_Template.xlsx');
  };

  const exportAllMedicines = async () => {
    setIsExportingMedicines(true);
    try {
      const { data } = await api.get('/medicines');
      if (!Array.isArray(data)) {
        throw new Error('The server returned an invalid medicine list.');
      }
      downloadMedicineInventory(data);
    } catch (exportError) {
      setError(
        exportError.response?.data?.message ||
          exportError.message ||
          'Unable to export medicines.'
      );
    } finally {
      setIsExportingMedicines(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBulkPreviewResult(null);
    setBulkFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: 'dd/mm/yy' });
        setBulkData(data);
        setBulkError('');
      } catch {
        setBulkError('Error parsing Excel file. Ensure it matches the template.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleBulkSubmit = (
    event
  ) => {
    event.preventDefault();

    setBulkError('');
    setBulkSuccess('');

    if (importMode === 'excel') {
      if (!bulkData || bulkData.length === 0) {
        setBulkError(
          'Please upload a valid Excel file with medicines'
        );
        return;
      }
      bulkImportMutation.mutate({ data: bulkData, dryRun: !bulkPreviewResult });
    } else {
      if (!bulkJson.trim()) {
        setBulkError('Please enter JSON data');
        return;
      }
      try {
        const parsed = JSON.parse(bulkJson);
        if (!Array.isArray(parsed)) {
          setBulkError('Please provide a JSON array');
          return;
        }
        bulkImportMutation.mutate({ data: parsed, dryRun: !bulkPreviewResult });
      } catch {
        setBulkError('Invalid JSON format');
      }
    }
  };

  // ==========================================================================
  // DELETE
  // ==========================================================================

  const handleDelete = (id) => {
    const confirmed =
      window.confirm(
        'Send this medicine deletion request to Admin for approval? The medicine will stay until Admin approves.'
      );

    if (confirmed) {
      deleteMedMutation.mutate(
        id
      );
    }
  };

  // ==========================================================================
  // BILLING
  // ==========================================================================

  const handleAddToBill = (
    medicine
  ) => {
    setBillItems(
      (previous) => {
        const existing =
          previous.find(
            (item) =>
              item._id ===
              medicine._id
          );

        const availableQuantity =
          Number(
            medicine.quantity ||
              0
          );

        if (existing) {
          if (
            existing.billQuantity >=
            availableQuantity
          ) {
            alert(
              `Only ${availableQuantity} units available`
            );

            return previous;
          }

          return previous.map(
            (item) =>
              item._id ===
              medicine._id
                ? {
                    ...item,
                    billQuantity:
                      item.billQuantity +
                      1,
                  }
                : item
          );
        }

        return [
          ...previous,
          {
            ...medicine,
            salePrice: Number(medicine.price) || 0,
            billQuantity: 1,
          },
        ];
      }
    );
  };

  const incrementQty = (id) => {
    setBillItems(
      (previous) =>
        previous.map(
          (item) => {
            if (
              item._id !== id
            ) {
              return item;
            }

            if (
              item.billQuantity >=
              Number(
                item.quantity ||
                  0
              )
            ) {
              alert(
                `Only ${
                  item.quantity ||
                  0
                } units available`
              );

              return item;
            }

            return {
              ...item,
              billQuantity:
                item.billQuantity +
                1,
            };
          }
        )
    );
  };

  const decrementQty = (id) => {
    setBillItems(
      (previous) =>
        previous
          .map(
            (item) =>
              item._id === id
                ? {
                    ...item,
                    billQuantity:
                      item.billQuantity -
                      1,
                  }
                : item
          )
          .filter(
            (item) =>
              item.billQuantity >
              0
          )
    );
  };

  const removeFromBill = (id) => {
    setBillItems(
      (previous) =>
        previous.filter(
          (item) =>
            item._id !== id
        )
    );
  };

  const subtotal = billItems.reduce(
    (sum, item) =>
      sum +
      Number(
        item.salePrice ?? item.price ?? 0
      ) *
        Number(
          item.billQuantity ||
            0
        ),
    0
  );

  const total = Math.max(
    0,
    subtotal -
      (Number(discount) ||
        0)
  );

  // ==========================================================================
  // CREATE BILL
  // ==========================================================================

  const handleConfirmBill =
    async (event) => {
      event.preventDefault();

      setBillError('');

      if (
        billItems.length ===
        0
      ) {
        setBillError(
          'Please add a medicine to the bill'
        );

        return;
      }

      const expired =
        billItems.some(
          (item) =>
            item.expiryStatus ===
            'EXPIRED'
        );

      if (expired) {
        setBillError(
          'Expired medicine cannot be billed'
        );

        return;
      }

      if ((Number(discount) || 0) > subtotal) {
        setBillError('Discount cannot exceed the invoice subtotal');
        return;
      }

      setIsBillingPending(true);

      try {
        const customer =
          customers.find(
            (item) =>
              item._id ===
              selectedCustomerId
          );

        const response =
          await api.post(
            '/bills/instore',
            {
              customerId:
                selectedCustomerId ||
                null,

              customerName:
                customerName.trim() ||
                customer?.name ||
                '',

              customerPhone:
                guestPhone.trim() ||
                customer?.phone ||
                '',

              paymentMethod: 'Cash',

              discount:
                Number(discount) ||
                0,

              items:
                billItems.map(
                  (item) => ({
                    medicineId:
                      item._id,

                    name:
                      item.name,

                    quantity:
                      item.billQuantity,

                    unitPrice:
                      item.salePrice ?? item.price,

                    salePrice:
                      item.salePrice ?? item.price,

                    expiryStatus:
                      item.expiryStatus,
                  })
                ),
            }
          );

        setConfirmedBill(
          response.data?.bill ||
            null
        );

        setBillItems([]);
        setDiscount('');
        setSelectedCustomerId('');
        setCustomerName('');
        setGuestPhone('');

        await refetchMeds();
        await refetchBills();
        await refetchSalesSummary();

        queryClient.invalidateQueries({
          queryKey: ['medicines'],
        });

        queryClient.invalidateQueries({
          queryKey: ['bills'],
        });

        queryClient.invalidateQueries({
          queryKey: ['salesSummary'],
        });
      } catch (err) {
        setBillError(
          err.response?.data?.message ||
            'Bill creation failed'
        );
      } finally {
        setIsBillingPending(false);
      }
    };

  // ==========================================================================
  // CRON
  // ==========================================================================

  const handleTriggerCron =
    async (cronNumber) => {
      setTriggerLoading(
        cronNumber
      );

      try {
        await api.post(
          `/notifications/trigger/${cronNumber}`
        );

        alert(
          'Task completed successfully'
        );
      } catch (err) {
        alert(
          err.response?.data?.message ||
            'Task failed'
        );
      } finally {
        setTriggerLoading(
          null
        );
      }
    };

  // ==========================================================================
  // PROFILE
  // ==========================================================================

  const handleProfileUpdate =
    async (event) => {
      event.preventDefault();

      setProfileError('');
      setProfileSuccess('');

      if (
        !profileName.trim()
      ) {
        setProfileError(
          'Name cannot be empty'
        );

        return;
      }

      try {
        await updateProfile(
          profileName.trim()
        );

        setProfileSuccess(
          'Profile updated successfully'
        );
      } catch (err) {
        setProfileError(
          err?.message ||
            'Profile update failed'
        );
      }
    };

  const handlePasswordReset =
    async (event) => {
      event.preventDefault();

      setPasswordError('');
      setPasswordSuccess('');

      if (
        !currentPassword ||
        !newPassword
      ) {
        setPasswordError(
          'Please enter both passwords'
        );

        return;
      }

      try {
        await updateProfile(
          profileName,
          currentPassword,
          newPassword
        );

        setPasswordSuccess(
          'Password updated successfully'
        );

        setCurrentPassword('');
        setNewPassword('');
      } catch (err) {
        setPasswordError(
          err?.message ||
            'Password update failed'
        );
      }
    };

  // ==========================================================================
  // DASHBOARD DATA
  // ==========================================================================

  const now =
    new Date();

  const todayString =
    now.toDateString();

  const totalMedicines =
    medicines.length;

  const expiredCount =
    medicines.filter(
      (medicine) =>
        medicine?.expiryStatus ===
        'EXPIRED'
    ).length;

  const expiringWithinSixMonths = medicines.filter((medicine) => {
    const days = getDaysLeft(medicine?.expiryDate);
    return days !== null && days >= 0 && days <= 180;
  }).length;

  const billsToday =
    bills.filter(
      (bill) =>
        bill?.createdAt &&
        bill?.orderStatus !== 'PENDING' &&
        bill?.orderStatus !== 'REJECTED' &&
        new Date(
          bill.createdAt
        ).toDateString() ===
          todayString
    ).length;

  const lowStockCount =
    medicines.filter(
      (medicine) =>
        Number(
          medicine?.quantity ||
            0
        ) < 5
    ).length;

  // ==========================================================================
  // DISPLAYED MEDICINES
  // ==========================================================================

  const displayedMedicines =
    medicines.filter(
      (medicine) => {
        if (
          medicineViewFilter ===
          'LOW_STOCK'
        ) {
          return (
            Number(
              medicine?.quantity ||
                0
            ) < 5
          );
        }

        return true;
      }
    );

  // ==========================================================================
  // TOP 100 EXPIRY MEDICINES
  // ==========================================================================

  const expiringMedicines =
    [...medicines]
      .filter(
        (medicine) => {
          const days = getDaysLeft(medicine?.expiryDate);
          return (
            medicine?.expiryDate &&
            days !== null &&
            days >= 0 &&
            days <= 180
          );
        }
      )
      .sort(
        (a, b) => {
          const aDate =
            new Date(
              a.expiryDate
            ).getTime();

          const bDate =
            new Date(
              b.expiryDate
            ).getTime();

          return aDate - bDate;
        }
      );

  // ==========================================================================
  // 7 DAY REVENUE
  // ==========================================================================

  const chartData = [];

  for (
    let index = 6;
    index >= 0;
    index -= 1
  ) {
    const date =
      new Date();

    date.setHours(
      0,
      0,
      0,
      0
    );

    date.setDate(
      date.getDate() -
        index
    );

    const dayBills =
      bills.filter(
        (bill) =>
          bill?.createdAt &&
          bill?.orderStatus !== 'PENDING' &&
          bill?.orderStatus !== 'REJECTED' &&
          new Date(
            bill.createdAt
          ).toDateString() ===
            date.toDateString()
      );

    const revenue =
      dayBills.reduce(
        (sum, bill) =>
          sum +
          Number(
            bill?.total || 0
          ),
        0
      );

    chartData.push({
      name:
        date.toLocaleDateString(
          undefined,
          {
            weekday:
              'short',
          }
        ),

      Revenue:
        Number(
          revenue.toFixed(
            2
          )
        ),

      Bills:
        dayBills.length,
    });
  }

  // ==========================================================================
  // RECENT BILLS
  // ==========================================================================

  const recentBills =
    [...bills]
      .filter(
        (bill) =>
          bill?.orderStatus !== 'PENDING' &&
          bill?.orderStatus !== 'REJECTED'
      )
      .sort(
        (a, b) =>
          new Date(
            b?.createdAt ||
              0
          ) -
          new Date(
            a?.createdAt ||
              0
          )
      )
      .slice(0, 10);

  // ==========================================================================
  // BILL SEARCH
  // ==========================================================================

  const filteredBillMedicines =
    medicines.filter(
      (medicine) => {
        const query =
          billSearch
            .trim()
            .toLowerCase();

        const medicineName =
          safeText(
            medicine?.name
          ).toLowerCase();

        const generic =
          safeText(
            medicine?.genericName
          ).toLowerCase();

        const rack =
          safeText(
            medicine?.rackLocation
          ).toLowerCase();
        const barcodeValue =
          safeText(medicine?.barcode).toLowerCase();

        const matchesSearch =
          !query ||
          medicineName.includes(
            query
          ) ||
          generic.includes(
            query
          ) ||
          rack.includes(query) ||
          barcodeValue.includes(query);

        const matchesCategory =
          billCategory
            ? medicine?.category ===
              billCategory
            : true;

        return (
          matchesSearch &&
          matchesCategory
        );
      }
    );

  // ==========================================================================
  // NAV ITEMS
  // ==========================================================================

  const navItems = [


    {
      name: 'Home',
      tab: 'dashboard',
      icon: LayoutDashboard,
    },

    {
      name: 'Medicines',
      tab: 'medicines',
      icon: Database,
    },

    {
      name: 'New Bill',
      tab: 'new-bill',
      icon: Receipt,
    },

    {
      name: 'Udhar Khata',
      tab: 'udhar',
      icon: Wallet,
    },

    {
      name: 'Orders',
      tab: 'orders',
      icon: ClipboardList,
    },

    {
      name: 'Alerts',
      tab: 'notifications',
      icon: Bell,
    },

    {
      name: 'Settings',
      tab: 'settings',
      icon: Settings,
    },
  ];

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return (
    <div className="pharmacist-dashboard min-h-screen bg-[var(--page-bg)] text-[var(--text-body)]">

      {/* MOBILE OVERLAY */}

      {isSidebarMobileOpen && (
        <div
          onClick={() =>
            setIsSidebarMobileOpen(
              false
            )
          }
          className="fixed inset-0 z-20 bg-slate-950/70 backdrop-blur-sm md:hidden"
        />
      )}

      {/* SIDEBAR */}

      <aside
        className={`fixed inset-y-0 left-0 z-30 w-[210px] border-r border-slate-200 bg-white/95 shadow-sm transition-transform dark:border-slate-700 dark:bg-slate-900/95 ${
          isSidebarMobileOpen
            ? 'translate-x-0'
            : '-translate-x-full'
        } md:translate-x-0`}
      >

        <div className="flex items-center gap-3 border-b border-slate-200 bg-gradient-to-r from-teal-50 to-emerald-50 p-4 dark:border-slate-700 dark:from-slate-900 dark:to-slate-900">

          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-emerald-500 text-lg font-bold text-white shadow-sm shadow-teal-500/20">
            Rx
          </div>

          <div>

            <div className="text-lg font-bold text-slate-900 dark:text-slate-50">
              Sardar Medical Store
            </div>

            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">
              Pharmacist Portal
            </div>

          </div>

        </div>

        <nav className="space-y-1 p-3">

          {navItems.map(
            (item) => {
              const Icon =
                item.icon;

              const active =
                activeTab ===
                item.tab;

              return (
                <button
                  key={
                    item.tab
                  }
                  onClick={() => {
                    setActiveTab(
                      item.tab
                    );

                    setIsSidebarMobileOpen(
                      false
                    );
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-all ${
                    active
                      ? 'bg-gradient-to-r from-teal-600 to-emerald-500 text-white font-bold shadow-sm shadow-teal-500/20'
                      : 'text-slate-600 hover:bg-teal-50 hover:text-teal-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {
                    item.name
                  }
                </button>
              );
            }
          )}

        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t flex items-center justify-between">

          <div className="flex items-center gap-2 min-w-0">

            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
              {currentUser?.name
                ?.charAt(0)
                .toUpperCase() ||
                'P'}
            </div>

            <div className="min-w-0">

              <div className="text-xs font-semibold truncate">
                {currentUser?.name ||
                  'Pharmacist'}
              </div>

              <div className="text-[10px] text-slate-600 dark:text-slate-400">
                Pharmacist
              </div>

            </div>

          </div>

          <button
            onClick={
              logout
            }
            className="p-2 text-slate-600 dark:text-slate-400 hover:text-red-600"
          >
            <LogOut className="w-4 h-4" />
          </button>

        </div>

      </aside>

      {/* MAIN */}

      <main className="md:ml-[210px] min-h-screen">

        {/* HEADER */}

        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-emerald-900/20 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 px-6 py-3.5 shadow-md backdrop-blur-md dark:border-teal-500/20 dark:from-slate-950 dark:via-teal-950 dark:to-slate-950">

          <div className="flex items-center gap-3">

            <button
              onClick={() =>
                setIsSidebarMobileOpen(
                  true
                )
              }
              className="md:hidden p-2 rounded-lg hover:bg-slate-100"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div>

              <div className="text-[11px] uppercase tracking-[0.2em] font-semibold text-emerald-300">
                Sardar Medical Store Operations
              </div>

              <div className="text-base font-bold capitalize text-white drop-shadow-sm">
                {activeTab.replace(
                  '-',
                  ' '
                )}
              </div>

            </div>

          </div>

          <div className="flex items-center gap-3.5 text-xs text-teal-100">

            <button
              onClick={
                toggle
              }
              className="rounded-lg border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20 hover:scale-105 active:scale-95"
              title="Toggle theme"
            >
              {resolvedTheme ===
              'dark'
                ? '☀'
                : '◐'}
            </button>

            <div className="flex items-center gap-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 text-xs text-emerald-200 shadow-inner">
              Server:{' '}
              <strong className="text-emerald-300 font-semibold">
                Online
              </strong>
            </div>

            <span className="hidden sm:inline font-medium text-teal-100/90 bg-white/10 px-3 py-1 rounded-full border border-white/10">
              {new Date().toLocaleDateString(
                undefined,
                {
                  weekday:
                    'short',
                  year:
                    'numeric',
                  month:
                    'short',
                  day:
                    'numeric',
                }
              )}
            </span>

          </div>

        </header>

        <div className="p-5 max-w-7xl mx-auto">

          {/* ================================================================= */}
          {/* DASHBOARD */}
          {/* ================================================================= */}

          {activeTab === 'dashboard' && (
            <div className="space-y-5">
              {/* SECTION BANNER */}
              <div className="section-banner bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-600 p-6 rounded-2xl shadow-sm border border-teal-600/30 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/30 text-emerald-100 text-[10px] font-bold uppercase tracking-wider border border-emerald-400/30">Pharmacy Operations</span>
                    <span className="text-emerald-200 text-xs font-semibold">Live Workspace</span>
                  </div>
                  <h1 className="text-2xl font-extrabold text-white tracking-tight">Pharmacist Command Center</h1>
                  <p className="text-xs sm:text-sm text-emerald-100/90 font-medium mt-0.5">Real-time inventory metrics, billing terminal, customer orders, and automated compliance alerts.</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={refreshDashboardData} disabled={isDashboardRefreshing} aria-label="Refresh dashboard data" className="bg-white/20 hover:bg-white/30 text-white font-bold px-4 py-2.5 rounded-xl border border-emerald-400/30 flex items-center gap-2 text-xs transition-all cursor-pointer disabled:cursor-wait disabled:opacity-60">
                    <RefreshCw className={`w-4 h-4 text-emerald-200 ${isDashboardRefreshing ? 'animate-spin' : ''}`} />
                    {isDashboardRefreshing ? 'Refreshing…' : 'Refresh'}
                  </button>
                  <button onClick={() => setActiveTab('new-bill')} className="bg-white text-emerald-950 hover:bg-emerald-50 font-bold px-4 py-2.5 rounded-xl shadow-sm border border-emerald-100 flex items-center gap-2 text-xs transition-all cursor-pointer">
                    <Receipt className="w-4 h-4 text-emerald-700" />
                    New Bill POS
                  </button>
                  <button onClick={openAddModal} className="bg-emerald-500/20 hover:bg-emerald-500/30 text-white font-bold px-4 py-2.5 rounded-xl border border-emerald-400/30 flex items-center gap-2 text-xs transition-all cursor-pointer">
                    <Plus className="w-4 h-4 text-emerald-200" />
                    Add Medicine
                  </button>
                </div>
              </div>

              {dashboardRefreshMessage && (
                <p role="status" className={`-mt-2 text-xs font-semibold ${dashboardRefreshMessage.includes('failed') || dashboardRefreshMessage.includes('Some') ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {dashboardRefreshMessage}
                </p>
              )}

              <MedicineImportIssues compact />
              <DailyClosingReport compact />
              <MedicineExpiryAlerts compact />
              <PurchaseOrdersPanel compact />
              <MedicineAuditHistory compact />

              {/* STAT CARDS */}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">

                {/* TOTAL MEDICINES */}

                <button
                  onClick={
                    showAllMedicines
                  }
                  className="text-left bg-white dark:bg-gray-900 p-4 rounded-2xl border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-50 shadow-sm hover:shadow-md hover:border-blue-300 transition"
                >

                  <div className="flex justify-between">

                    <div>

                      <div className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">
                        Total Medicines
                      </div>

                      <div className="text-2xl font-bold mt-2">
                        {isMedsLoading
                          ? '...'
                          : totalMedicines}
                      </div>

                      <div className="text-[9px] text-blue-600 mt-2 font-bold">
                        Click to view
                      </div>

                    </div>

                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Pill className="w-4 h-4" />
                    </div>

                  </div>

                </button>

                {/* EXPIRED */}

                <button
                  onClick={
                    showExpiredMedicines
                  }
                  className="text-left bg-white p-4 rounded-2xl border border-red-100 shadow-sm hover:shadow-md transition"
                >

                  <div className="flex justify-between">

                    <div>

                      <div className="text-[10px] uppercase font-bold text-red-500">
                        Expired Medicines
                      </div>

                      <div className="text-2xl font-bold text-red-600 mt-2">
                        {
                          expiredCount
                        }
                      </div>

                      <div className="text-[9px] text-red-500 mt-2 font-bold">
                        Click to view
                      </div>

                    </div>

                    <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4" />
                    </div>

                  </div>

                </button>

                {/* EXPIRING WITHIN SIX MONTHS */}

                <button
                  onClick={showExpiringSixMonths}
                  className="text-left bg-white p-4 rounded-2xl border border-orange-100 shadow-sm hover:shadow-md transition"
                >

                  <div className="flex justify-between">

                    <div>

                      <div className="text-[10px] uppercase font-bold text-orange-500">
                        Expiring Within 6 Months
                      </div>

                      <div className="text-2xl font-bold text-orange-600 mt-2">
                        {
                          expiringWithinSixMonths
                        }
                      </div>

                      <div className="text-[9px] text-orange-500 mt-2 font-bold">
                        Click to view
                      </div>

                    </div>

                    <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                      <Calendar className="w-4 h-4" />
                    </div>

                  </div>

                </button>

                {/* BILLS TODAY */}

                <button
                  onClick={() =>
                    openSalesDetails(
                      'daily'
                    )
                  }
                  className="text-left bg-white p-4 rounded-2xl border border-violet-100 shadow-sm hover:shadow-md transition"
                >

                  <div className="flex justify-between">

                    <div>

                      <div className="text-[10px] uppercase font-bold text-violet-500">
                        Bills Today
                      </div>

                      <div className="text-2xl font-bold text-violet-600 mt-2">
                        {isBillsLoading
                          ? '...'
                          : billsToday}
                      </div>

                      <div className="text-[9px] text-violet-500 mt-2 font-bold">
                        Click to view
                      </div>

                    </div>

                    <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                      <Receipt className="w-4 h-4" />
                    </div>

                  </div>

                </button>

                {/* TODAY'S SALES */}

                <button
                  onClick={() =>
                    openSalesDetails(
                      'daily'
                    )
                  }
                  className="text-left bg-white dark:bg-gray-900 p-4 rounded-2xl border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-50 shadow-sm hover:shadow-md hover:border-emerald-300 transition"
                >

                  <div className="text-[10px] uppercase font-bold text-emerald-600">
                    Today's Sales
                  </div>

                  <div className="flex justify-between items-end mt-2">

                    <div>

                      <div className="text-lg font-bold text-emerald-700">
                        {isSalesSummaryLoading
                          ? '...'
                          : getCurrency(
                              todaySales
                            )}
                      </div>

                      <div className="text-[9px] text-slate-600 dark:text-slate-400 mt-1">
                        {
                          todayBills
                        }{' '}
                        bill(s)
                      </div>

                    </div>

                    <Wallet className="w-5 h-5" />

                  </div>

                  <div className="text-[9px] text-emerald-600 mt-2 font-bold">
                    Click to view sales
                  </div>

                </button>

                {/* MONTHLY SALES */}

                <button
                  onClick={() =>
                    openSalesDetails(
                      'monthly'
                    )
                  }
                  className="text-left bg-white dark:bg-gray-900 p-4 rounded-2xl border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-50 shadow-sm hover:shadow-md hover:border-blue-300 transition"
                >

                  <div className="text-[10px] uppercase font-bold text-blue-600">
                    Monthly Sales
                  </div>

                  <div className="flex justify-between items-end mt-2">

                    <div>

                      <div className="text-lg font-bold text-blue-700">
                        {isSalesSummaryLoading
                          ? '...'
                          : getCurrency(
                              monthlySales
                            )}
                      </div>

                      <div className="text-[9px] text-slate-600 dark:text-slate-400 mt-1">
                        {
                          monthlyBills
                        }{' '}
                        bill(s)
                      </div>

                    </div>

                    <TrendingUp className="w-5 h-5" />

                  </div>

                  <div className="text-[9px] text-blue-600 mt-2 font-bold">
                    Click to view sales
                  </div>

                </button>

                <button type="button" onClick={() => openSalesDetails('yearly')} className="text-left bg-white dark:bg-gray-900 p-4 rounded-2xl border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-50 shadow-sm hover:shadow-md hover:border-violet-300 transition">
                  <div className="text-[10px] uppercase font-bold text-violet-600">Yearly Sales · {new Date().getFullYear()}</div>
                  <div className="flex justify-between items-end mt-2">
                    <div>
                      <div className="text-lg font-bold text-violet-700">{isSalesSummaryLoading ? '...' : getCurrency(yearlySales)}</div>
                      <div className="text-[9px] text-slate-600 dark:text-slate-400 mt-1">{yearlyBills} bill(s) this year</div>
                    </div>
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="text-[9px] text-violet-600 mt-2 font-bold">Click to view this year’s sales</div>
                </button>

              </div>

              {/* PROFIT ANALYTICS SUMMARY CARD */}
              <div className="mt-4 p-5 bg-gradient-to-r from-emerald-900 to-teal-900 rounded-2xl text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    Profit & Analytics Summary
                  </h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <button type="button" onClick={() => openProfitDetails('daily')} className="rounded-lg bg-white/10 px-3 py-2 text-left text-xs hover:bg-white/20">Today's profit · <strong className="text-emerald-300">{isProfitLoading ? '...' : getCurrency(profitSummary?.dailyProfit || 0)}</strong><span className="block text-[10px] text-emerald-200">View details</span></button>
                    <button type="button" onClick={() => openProfitDetails('monthly')} className="rounded-lg bg-white/10 px-3 py-2 text-left text-xs hover:bg-white/20">This month's profit · <strong className="text-emerald-300">{isProfitLoading ? '...' : getCurrency(profitSummary?.monthlyProfit || 0)}</strong><span className="block text-[10px] text-emerald-200">View details</span></button>
                    <button type="button" onClick={() => openProfitDetails('yearly')} className="rounded-lg bg-white/10 px-3 py-2 text-left text-xs hover:bg-white/20">This year's profit · <strong className="text-emerald-300">{isProfitLoading ? '...' : getCurrency(profitSummary?.yearlyProfit || 0)}</strong><span className="block text-[10px] text-emerald-200">View details</span></button>
                  </div>
                </div>
                <button
                  onClick={() => { setProfitDateRange({ startDate: '', endDate: '' }); setIsProfitModalOpen(true); }}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition flex items-center gap-2 shrink-0 shadow"
                >
                  <BarChart className="w-4 h-4" />
                  View Medicine Profit Details
                </button>
              </div>

              {/* QUICK ACTIONS */}

              <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-50 shadow-sm">

                <div className="mb-3">

                  <h3 className="font-bold text-sm">
                    Quick Actions
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Frequently used pharmacist actions
                  </p>

                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">

                  <button
                    onClick={
                      openAddModal
                    }
                    className="px-3 py-3 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Medicine
                  </button>

                  <button
                    onClick={() =>
                      setActiveTab(
                        'new-bill'
                      )
                    }
                    className="px-3 py-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <Receipt className="w-4 h-4" />
                    New Bill
                  </button>

                  <button
                    onClick={
                      showLowStockMedicines
                    }
                    className="px-3 py-3 bg-orange-50 text-orange-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <Package className="w-4 h-4" />
                    Low Stock ({lowStockCount})
                  </button>

                  <button
                    onClick={() =>
                      setActiveTab(
                        'notifications'
                      )
                    }
                    className="px-3 py-3 bg-violet-50 text-violet-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <Bell className="w-4 h-4" />
                    Alerts
                  </button>

                  <button
                    onClick={() =>
                      setActiveTab(
                        'orders'
                      )
                    }
                    className="px-3 py-3 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <ClipboardList className="w-4 h-4" />
                    Orders ({pendingOnlineOrders.length})
                  </button>

                </div>

              </div>

              {/* CHART */}

              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-50 shadow-sm">

                <div className="flex justify-between mb-5">

                  <div>

                    <h3 className="font-bold text-sm">
                      Sales Revenue History
                    </h3>

                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Last 7 days revenue
                    </p>

                  </div>

                  <span className="text-[10px] bg-emerald-50 text-emerald-600 rounded-lg px-2 py-1 font-bold">
                    LIVE
                  </span>

                </div>

                <div className="h-[280px]">

                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >

                    <BarChart
                      data={
                        chartData
                      }
                    >

                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                      />

                      <YAxis
                        tickLine={false}
                        axisLine={false}
                      />

                      <Tooltip
                        formatter={(
                          value
                        ) =>
                          getCurrency(
                            value
                          )
                        }
                      />

                      <Bar
                        dataKey="Revenue"
                        fill="#059669"
                        radius={[
                          5,
                          5,
                          0,
                          0,
                        ]}
                      />

                    </BarChart>

                  </ResponsiveContainer>

                </div>

              </div>

              {/* TOP 100 EXPIRY */}

              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-50 shadow-sm overflow-hidden">

                <div className="p-5 border-b flex items-center justify-between gap-3">

                  <div>

                    <h3 className="font-bold text-sm">
                      Medicines Expiring Within 6 Months
                    </h3>

                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      All medicines with an expiry date in the next 180 days.
                    </p>

                  </div>

                  <button
                    onClick={() =>
                      setActiveTab(
                        'medicines'
                      )
                    }
                    className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold whitespace-nowrap"
                  >
                    View Inventory
                  </button>

                </div>

                <div className="overflow-x-auto">

                  <table className="w-full">

                    <thead>

                      <tr className="bg-slate-100 dark:bg-gray-800 text-left text-[10px] uppercase font-bold text-slate-700 dark:text-gray-200 border-b border-slate-200 dark:border-gray-700">

                        <th className="p-3">
                          #
                        </th>

                        <th className="p-3">
                          Medicine
                        </th>

                        <th className="p-3">
                          Expiry
                        </th>

                        <th className="p-3">
                          Days Left
                        </th>

                        <th className="p-3">
                          Stock
                        </th>

                        <th className="p-3">
                          Status
                        </th>

                        <th className="p-3 text-right">
                          Action
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {expiringMedicines.length ===
                      0 ? (

                        <tr>

                          <td
                            colSpan={7}
                            className="p-8 text-center text-xs text-slate-600 dark:text-slate-400"
                          >
                            No expiry medicines found.
                          </td>

                        </tr>

                      ) : (

                        expiringMedicines.map(
                          (
                            medicine,
                            index
                          ) => {

                            const days =
                              getDaysLeft(
                                medicine.expiryDate
                              );

                            return (
                              <tr
                                key={
                                  medicine._id
                                }
                                className="border-b border-slate-200/80 dark:border-gray-800/80 hover:bg-teal-50/40 dark:hover:bg-gray-800/50 transition-colors"
                              >

                                <td className="p-3 text-xs text-slate-600 dark:text-slate-400">
                                  {
                                    index +
                                    1
                                  }
                                </td>

                                <td className="p-3">

                                  <div className="text-xs font-bold">
                                    {
                                      medicine.name ||
                                      'N/A'
                                    }
                                  </div>

                                  <div className="text-[10px] text-slate-600 dark:text-slate-400">
                                    {
                                      medicine.genericName ||
                                      'N/A'
                                    }
                                  </div>

                                </td>

                                <td className="p-3 text-xs">
                                  {formatDate(
                                    medicine.expiryDate
                                  )}
                                </td>

                                <td className="p-3 text-xs font-bold">

                                  {days ===
                                  null
                                    ? 'N/A'
                                    : days <=
                                      0
                                    ? 'Expired'
                                    : `${days} days`}

                                </td>

                                <td className="p-3 text-xs">
                                  {
                                    medicine.quantity ??
                                    0
                                  }
                                </td>

                                <td className="p-3">

                                  <ExpiryBadge
                                    status={
                                      medicine.expiryStatus
                                    }
                                  />

                                </td>

                                <td className="p-3">

                                  <div className="flex justify-end">

                                    <button
                                      onClick={() =>
                                        openMedicineDetails(
                                          medicine
                                        )
                                      }
                                      className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-bold flex items-center gap-1"
                                    >
                                      <Eye className="w-3 h-3" />
                                      View
                                    </button>

                                  </div>

                                </td>

                              </tr>
                            );
                          }
                        )

                      )}

                    </tbody>

                  </table>

                </div>

              </div>

              {/* RECENT BILLS */}

              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-50 shadow-sm overflow-hidden">

                <div className="p-5 border-b flex items-center justify-between">

                  <div>

                    <h3 className="font-bold text-sm">
                      Recent Bills
                    </h3>

                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Latest sales transactions.
                    </p>

                  </div>

                  <button
                    onClick={() =>
                      setActiveTab(
                        'new-bill'
                      )
                    }
                    className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold"
                  >
                    New Bill
                  </button>

                </div>

                <div className="overflow-x-auto">

                  <table className="w-full">

                    <thead>

                      <tr className="bg-slate-100 dark:bg-gray-800 text-left text-[10px] uppercase font-bold text-slate-700 dark:text-gray-200 border-b border-slate-200 dark:border-gray-700">

                        <th className="p-3">
                          Bill
                        </th>

                        <th className="p-3">
                          Customer
                        </th>

                        <th className="p-3">
                          Payment
                        </th>

                        <th className="p-3">
                          Total
                        </th>

                        <th className="p-3">
                          Date
                        </th>

                        <th className="p-3 text-right">
                          Action
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {recentBills.length ===
                      0 ? (

                        <tr>

                          <td
                            colSpan={6}
                            className="p-8 text-center text-xs text-slate-600 dark:text-slate-400"
                          >
                            No bills found.
                          </td>

                        </tr>

                      ) : (

                        recentBills.map(
                          (bill) => (
                            <tr
                              key={
                                bill._id
                              }
                              className="border-b border-slate-200/80 dark:border-gray-800/80 hover:bg-teal-50/40 dark:hover:bg-gray-800/50 transition-colors"
                            >

                              <td className="p-3 text-xs font-bold">
                                {
                                  bill.billNumber ||
                                  bill._id ||
                                  'N/A'
                                }
                              </td>

                              <td className="p-3 text-xs">
                                {
                                  bill.customerName ||
                                  bill.customer?.name ||
                                  'Walk-in Guest'
                                }
                              </td>

                              <td className="p-3 text-xs">
                                {
                                  bill.paymentMethod ||
                                  'N/A'
                                }
                              </td>

                              <td className="p-3 text-xs font-bold">
                                {getCurrency(
                                  Math.max(
                                    0,
                                    (bill.total || 0) - (bill.totalRefunded || 0)
                                  )
                                )}
                                {(bill.totalRefunded || 0) > 0 && (
                                  <span className="ml-1 text-[10px] font-medium text-amber-600">
                                    net
                                  </span>
                                )}
                              </td>

                              <td className="p-3 text-xs">
                                {formatDateTime(
                                  bill.createdAt
                                )}
                              </td>

                              <td className="p-3 text-right">

                                <button
                                  onClick={() =>
                                    openBillDetails(
                                      bill
                                    )
                                  }
                                  className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-bold"
                                >
                                  View Details
                                </button>

                                {currentUser?.role === 'pharmacist' && (
                                  <button
                                    onClick={() => {
                                      if (window.confirm(`Send bill ${bill.billNumber || ''} to Admin for deletion approval? It will remain until approval.`)) requestBillDeletionMutation.mutate(bill._id);
                                    }}
                                    className="ml-2 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg text-[10px] font-bold"
                                  >
                                    Request Deletion
                                  </button>
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

            </div>
          )}

          {/* ================================================================= */}
          {/* MEDICINES */}
          {/* ================================================================= */}

          {activeTab ===
            'orders' && (
            <div className="space-y-4">

              <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-50 shadow-sm dark:bg-slate-900 dark:border-slate-700">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="font-bold text-sm">
                      Customer Orders
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Review online pharmacy orders and accept or reject them.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => refetchOnlineOrders()}
                    disabled={isOrdersFetching}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <RefreshCw className={`inline w-3.5 h-3.5 mr-1 ${isOrdersFetching ? 'animate-spin' : ''}`} />
                    {isOrdersFetching ? 'Refreshing…' : 'Refresh Orders'}
                  </button>
                </div>
              </div>

              {isOrdersLoading ? (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-50 p-10 text-center shadow-sm dark:bg-slate-900 dark:border-slate-700">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-3">
                    Loading customer orders...
                  </p>
                </div>
              ) : onlineOrders.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-50 p-10 text-center shadow-sm dark:bg-slate-900 dark:border-slate-700">
                  <ClipboardList className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold mt-3">
                    No customer orders yet
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    New online orders will appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {onlineOrders.map((order) => {
                    const isPending =
                      order?.orderStatus === 'PENDING';

                    return (
                      <div
                        key={order?._id}
                        className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-50 shadow-sm p-4 dark:bg-slate-900 dark:border-slate-700"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-50 dark:text-white">
                                {order?.billNumber || order?._id || 'Order'}
                              </span>

                              <span
                                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                  order?.orderStatus === 'ACCEPTED'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : order?.orderStatus === 'REJECTED'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {order?.orderStatus || 'PENDING'}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                                <p className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Customer</p>
                                <p className="text-xs font-bold mt-1 text-slate-900 dark:text-slate-50 dark:text-white">
                                  {order?.customerId?.name || 'Customer'}
                                </p>
                                <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 dark:text-slate-600 dark:text-slate-400">
                                  {order?.customerId?.email || 'No email'}
                                </p>
                                <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 dark:text-slate-600 dark:text-slate-400">
                                  {order?.customerPhone || order?.customerId?.phone || 'No phone'}
                                </p>
                              </div>

                              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                                <p className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">Delivery Address</p>
                                <p className="text-xs font-semibold mt-1 leading-5 text-slate-700 dark:text-slate-200">
                                  {order?.shippingAddress || 'No delivery address provided'}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                              <p className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 mb-2">Medicines</p>
                              <div className="space-y-2">
                                {Array.isArray(order?.items) && order.items.map((item, index) => (
                                  <div
                                    key={`${order._id}-${item?.medicineId || index}`}
                                    className="flex items-center justify-between gap-3 text-xs"
                                  >
                                    <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">
                                      {item?.name || 'Medicine'} × {item?.quantity || 0}
                                    </span>
                                    <span className="shrink-0 font-bold text-slate-900 dark:text-slate-50 dark:text-white">
                                      {getCurrency((Number(item?.unitPrice) || 0) * (Number(item?.quantity) || 0))}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-600 dark:text-slate-400">
                              <span>Placed: {formatDateTime(order?.createdAt)}</span>
                              <span>Payment: {order?.paymentMethod || 'Cash'}</span>
                              {order?.rejectionReason && (
                                <span className="text-red-500">Reason: {order.rejectionReason}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex w-full flex-col gap-2 lg:w-36">
                            <div className="rounded-xl bg-blue-50 p-3 text-center dark:bg-blue-950/20">
                              <p className="text-[10px] uppercase font-bold text-blue-600">Total</p>
                              <p className="text-sm font-extrabold text-blue-700 mt-1 dark:text-blue-300">
                                {getCurrency(order?.total)}
                              </p>
                            </div>

                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  disabled={updateOnlineOrderMutation.isPending}
                                  onClick={() => handleAcceptOnlineOrder(order?._id)}
                                  className="px-3 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  <CheckCircle className="inline w-4 h-4 mr-1" />
                                  Accept Order
                                </button>

                                <button
                                  type="button"
                                  disabled={updateOnlineOrderMutation.isPending}
                                  onClick={() => handleRejectOnlineOrder(order?._id)}
                                  className="px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
                                >
                                  <X className="inline w-4 h-4 mr-1" />
                                  Reject Order
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab ===
            'medicines' && (
            <div className="space-y-4">

              <MedicineImportIssues />

              <div className="section-banner p-4 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">

                <div>

                  <h2 className="font-bold text-sm">
                    Medicine Inventory
                  </h2>

                  <p className="text-xs mt-1">
                    Manage medicines, expiry, stock and rack locations.
                  </p>

                </div>

                <div className="flex flex-wrap gap-2">

                  <button
                    onClick={exportAllMedicines}
                    disabled={isExportingMedicines}
                    className="inline-flex items-center gap-2 rounded-lg !bg-white px-3 py-2 text-xs font-bold !text-emerald-900 shadow-sm transition hover:!bg-emerald-50 disabled:opacity-60"
                    title="Download all medicines as an Excel backup"
                  >
                    <Download className="h-4 w-4 !text-emerald-700" />
                    {isExportingMedicines ? 'Exporting…' : 'Export Excel'}
                  </button>

                  <button
                    onClick={() => {
                      setMedicineViewFilter(
                        'ALL'
                      );

                      refetchMeds();
                    }}
                    className="flex items-center justify-center rounded-lg !bg-white px-3 py-2 !text-emerald-900 shadow-sm transition hover:!bg-emerald-50"
                    disabled={isMedsFetching}
                    title="Refresh"
                    aria-label="Refresh medicine inventory"
                  >
                    <RefreshCw className={`h-4 w-4 !text-emerald-700 ${isMedsFetching ? 'animate-spin' : ''}`} />
                  </button>

                  <button
                    onClick={() => {
                      setMedicineViewFilter(
                        'ALL'
                      );

                      setSearch('');
                      setCategoryFilter('');
                      setExpiryStatusFilter(
                        ''
                      );
                      setReorderFilter(
                        false
                      );
                    }}
                    className="rounded-lg !bg-white px-3 py-2 text-xs font-bold !text-emerald-900 shadow-sm transition hover:!bg-emerald-50"
                  >
                    All
                  </button>

                  <button
                    onClick={() => {
                      setExpiryStatusFilter(
                        'EXPIRED'
                      );
                      setMedicineViewFilter(
                        'ALL'
                      );
                    }}
                    className="rounded-lg !bg-white px-3 py-2 text-xs font-bold !text-rose-700 shadow-sm transition hover:!bg-rose-50"
                  >
                    Expired
                  </button>

                  <button
                    onClick={
                      showLowStockMedicines
                    }
                    className="rounded-lg !bg-white px-3 py-2 text-xs font-bold !text-amber-800 shadow-sm transition hover:!bg-amber-50"
                  >
                    Low Stock
                  </button>

                  <button
                    onClick={() =>
                      setBulkModalOpen(
                        true
                      )
                    }
                    className="flex items-center gap-1 rounded-lg !bg-white px-3 py-2 text-xs font-bold !text-emerald-900 shadow-sm transition hover:!bg-emerald-50"
                  >
                    <Upload className="h-3.5 w-3.5 !text-emerald-700" />
                    Bulk
                  </button>

                  <button
                    onClick={
                      openAddModal
                    }
                    className="flex items-center gap-1 rounded-lg !bg-white px-3 py-2 text-xs font-bold !text-emerald-900 shadow-sm transition hover:!bg-emerald-50"
                  >
                    <Plus className="h-3.5 w-3.5 !text-emerald-700" />
                    Add Medicine
                  </button>

                </div>

              </div>

              {(medicineViewFilter !== 'ALL' || expiryStatusFilter === 'EXPIRING') && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center justify-between">

                  <div className="text-xs text-blue-700 font-semibold">

                    {medicineViewFilter ===
                      'LOW_STOCK' &&
                      'Showing low-stock medicines.'}

                    {expiryStatusFilter === 'EXPIRING' &&
                      'Showing all medicines expiring within six months.'}

                  </div>

                  <button
                    onClick={() => {
                      setMedicineViewFilter(
                        'ALL'
                      );
                      if (expiryStatusFilter === 'EXPIRING') {
                        setExpiryStatusFilter('');
                      }
                    }}
                    className="text-[10px] bg-white border border-blue-200 px-2 py-1 rounded-lg text-blue-700 font-bold"
                  >
                    Clear View
                  </button>

                </div>
              )}

              {billItems.length > 0 && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-emerald-500/30 bg-emerald-50 p-4 dark:bg-emerald-950/40 shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow">
                      <ShoppingCart className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                        {billItems.reduce((sum, item) => sum + (item.billQuantity || 1), 0)} Item(s) Selected in Bill Cart
                      </p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        You can keep searching & adding medicines. Click button when ready to open bill.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('new-bill')}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition hover:bg-emerald-700 hover:scale-105"
                  >
                    <span>Open Bill Page ({billItems.length} Medicines)</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-3">

                <div className="relative md:col-span-2">

                  <Search className="w-5 h-5 absolute left-4 top-3.5 text-blue-600" />

                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(
                        event.target.value
                      );

                      setMedicineViewFilter(
                        'ALL'
                      );
                    }}
                    placeholder="Search medicine, generic name, manufacturer or rack..."
                    className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-600 dark:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100"
                  />

                </div>

                <select
                  value={
                    categoryFilter
                  }
                  onChange={(event) => {
                    setCategoryFilter(
                      event.target.value
                    );

                    setMedicineViewFilter(
                      'ALL'
                    );
                  }}
                  className="border rounded-lg px-3 text-xs"
                >

                  <option value="">
                    All Categories
                  </option>

                  {standardCategories.map(
                    (item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {
                          item
                        }
                      </option>
                    )
                  )}

                </select>

                <select
                  value={
                    expiryStatusFilter
                  }
                  onChange={(event) => {
                    setExpiryStatusFilter(
                      event.target.value
                    );

                    setMedicineViewFilter(
                      'ALL'
                    );
                  }}
                  className="border rounded-lg px-3 text-xs"
                >

                  <option value="">
                    All Status
                  </option>

                  <option value="EXPIRED">
                    EXPIRED
                  </option>

                  <option value="EXPIRING">
                    EXPIRING WITHIN 6 MONTHS
                  </option>

                  <option value="CRITICAL">
                    CRITICAL
                  </option>

                  <option value="WARNING">
                    WARNING
                  </option>

                  <option value="CAUTION">
                    CAUTION
                  </option>

                  <option value="SAFE">
                    SAFE
                  </option>

                </select>

                <label className="flex items-center gap-2 text-xs font-semibold">

                  <input
                    type="checkbox"
                    checked={
                      reorderFilter
                    }
                    onChange={(event) => {
                      setReorderFilter(
                        event.target.checked
                      );

                      setMedicineViewFilter(
                        event.target.checked
                          ? 'LOW_STOCK'
                          : 'ALL'
                      );
                    }}
                  />

                  Show Low Stock

                </label>

              </div>

              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-50 shadow-sm overflow-hidden">

                <div className="p-4 border-b flex items-center justify-between">

                  <div>

                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Showing
                    </div>

                    <div className="text-sm font-bold">
                      {
                        displayedMedicines.length
                      }{' '}
                      medicine(s)
                    </div>

                  </div>

                  <div className="text-[10px] text-slate-600 dark:text-slate-400">
                    View Details shows complete information.
                  </div>

                </div>

                <div className="overflow-x-auto">

                  <table className="w-full">

                    <thead>

                      <tr className="bg-slate-50 text-[10px] uppercase text-slate-600 dark:text-slate-400">

                        <th className="p-3 text-left">
                          Medicine
                        </th>

                        <th className="p-3 text-left">
                          Sale / Cost per unit
                        </th>

                        <th className="p-3 text-left">
                          Stock
                        </th>

                        <th className="p-3 text-left">
                          Rack
                        </th>

                        <th className="p-3 text-left">
                          Expiry
                        </th>

                        <th className="p-3 text-left">
                          Status
                        </th>

                        <th className="p-3 text-right">
                          Actions
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {isMedsLoading ? (

                        <tr>

                          <td
                            colSpan={7}
                            className="p-8 text-center text-xs text-slate-600 dark:text-slate-400"
                          >
                            Loading medicines...
                          </td>

                        </tr>

                      ) : displayedMedicines.length ===
                        0 ? (

                        <tr>

                          <td
                            colSpan={7}
                            className="p-8 text-center text-xs text-slate-600 dark:text-slate-400"
                          >
                            No medicines found.
                          </td>

                        </tr>

                      ) : (

                        displayedMedicines.map(
                          (medicine) => (

                            <tr
                              key={
                                medicine._id
                              }
                              className="border-b border-slate-200/80 dark:border-gray-800/80 hover:bg-teal-50/40 dark:hover:bg-gray-800/50 transition-colors"
                            >

                              <td className="p-3">

                                <div className="font-bold text-xs">
                                  {
                                    medicine.name ||
                                    'N/A'
                                  }
                                </div>

                                <div className="text-[10px] text-slate-600 dark:text-slate-400">
                                  {
                                    medicine.genericName ||
                                    'N/A'
                                  }
                                </div>

                                <div className="mt-1">
                                  <CategoryBadge
                                    category={
                                      medicine.category
                                    }
                                  />
                                </div>

                              </td>

                              <td className="p-3 text-xs">
                                <div className="font-bold">
                                  Sale: {getCurrency(medicine.price)}
                                </div>
                                <div className="mt-1 text-[10px] font-medium text-slate-500">
                                  Cost/tablet: {getCurrency(getPurchaseCostPerUnit(medicine))}
                                </div>
                              </td>

                              <td className="p-3 text-xs">

                                <span className={Number(medicine.quantity || 0) < 5 ? 'text-red-600 font-bold' : ''}>
                                  {
                                    medicine.quantity ??
                                    0
                                  }{' '}
                                  units
                                </span>

                              </td>

                              <td className="p-3 text-xs font-semibold text-blue-700">
                                {medicine.rackLocation || 'Not assigned'}
                              </td>

                              <td className="p-3 text-xs">

                                {formatDate(
                                  medicine.expiryDate
                                )}

                              </td>

                              <td className="p-3">

                                <div className="flex flex-col items-start gap-1">
                                  <span className={`rounded px-2 py-1 text-[10px] font-bold whitespace-nowrap ${getStockBadgeClass(getStockStatus(medicine.quantity))}`}>
                                    {getStockStatus(medicine.quantity)}
                                  </span>
                                  <ExpiryBadge status={medicine.expiryStatus} />
                                </div>

                              </td>

                              <td className="p-3">

                                <div className="flex justify-end gap-1">

                                  <button
                                    onClick={() =>
                                      openMedicineDetails(
                                        medicine
                                      )
                                    }
                                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-700 dark:text-slate-200"
                                    title="View Details"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => {
                                      handleAddToBill(medicine);
                                    }}
                                    className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600 transition hover:scale-110"
                                    title="Add to Bill (Items remain selected as you search)"
                                    disabled={medicine.quantity === 0 || medicine.expiryStatus === 'EXPIRED'}
                                  >
                                    <ShoppingCart className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() =>
                                      openEditModal(
                                        medicine
                                      )
                                    }
                                    className="p-2 rounded-lg hover:bg-blue-50 text-blue-600"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>

                                  {currentUser?.role === 'pharmacist' && (
                                    <button
                                      onClick={() => handleDelete(medicine._id)}
                                      className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                                      title="Request deletion from Admin"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                </div>

                              </td>

                            </tr>

                          )
                        )

                      )}

                    </tbody>

                  </table>

                </div>

              </div>

            </div>
          )}

          {/* ================================================================= */}
          {/* NEW BILL */}
          {/* ================================================================= */}

          {activeTab ===
            'new-bill' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[600px]">

              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col">

                <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-sm">Medicine Catalog</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {ocrLoading ? 'Scanning image...' : 'Search by name, rack, or barcode; scan a label to add it to this bill.'}
                    </p>
                  </div>
                  <button type="button" onClick={() => { refetchMeds(); refetchBills(); }} disabled={isMedsFetching || isBillsFetching} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800 ml-auto">
                    <RefreshCw className={`inline w-3.5 h-3.5 mr-1 ${isMedsFetching || isBillsFetching ? 'animate-spin' : ''}`} />
                    {isMedsFetching || isBillsFetching ? 'Refreshing…' : 'Refresh'}
                  </button>
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={billScanInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (file) await processScannedLabel(file, 'bill');
                        event.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => startCamera('bill')}
                      disabled={ocrLoading}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white"
                    >
                      <Camera className="h-4 w-4" />
                      Open Camera
                    </button>
                    <button
                      type="button"
                      onClick={() => startMobileScanner('bill')}
                      className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white hover:bg-teal-700 transition"
                    >
                      <Smartphone className="h-4 w-4" />
                      Mobile Scanner
                    </button>
                    <button
                      type="button"
                      onClick={() => billScanInputRef.current?.click()}
                      disabled={ocrLoading}
                      className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700"
                    >
                      <Barcode className="h-4 w-4" />
                      Scan Image
                    </button>
                  </div>
                </div>

                <div className="p-3 border-b flex gap-2">

                  <div className="relative flex-1">

                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-600 dark:text-slate-400" />

                    <input
                      value={
                        billSearch
                      }
                      onChange={(event) =>
                        setBillSearch(
                          event.target.value
                        )
                      }
                      placeholder="Search name, rack, or barcode..."
                      className="w-full pl-9 pr-3 py-2 border rounded-lg text-xs"
                    />

                  </div>

                  <select
                    value={
                      billCategory
                    }
                    onChange={(event) =>
                      setBillCategory(
                        event.target.value
                      )
                    }
                    className="border rounded-lg px-2 text-xs"
                  >

                    <option value="">
                      All
                    </option>

                    {standardCategories.map(
                      (item) => (
                        <option
                          key={item}
                          value={item}
                        >
                          {
                            item
                          }
                        </option>
                      )
                    )}

                  </select>

                </div>

                <div className="p-3 space-y-2 overflow-y-auto">

                  {filteredBillMedicines.map(
                    (medicine) => {

                      const disabled =
                        Number(
                          medicine.quantity ||
                            0
                        ) === 0 ||
                        medicine.expiryStatus ===
                          'EXPIRED';

                      return (
                        <div
                          key={
                            medicine._id
                          }
                          className="p-3 border rounded-xl flex items-center justify-between"
                        >

                          <div>

                            <div className="text-xs font-bold">
                              {
                                medicine.name ||
                                'N/A'
                              }
                            </div>

                            <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">
                              Stock: {medicine.quantity ?? 0} {getDot()} Rack: {medicine.rackLocation || 'Not assigned'}
                            </div>

                          </div>

                          <div className="flex items-center gap-2">

                            <span className="text-right text-[10px]">
                              <span className="block text-xs font-bold">
                                Sale: {getCurrency(medicine.price)}
                              </span>
                              <span className="mt-1 block text-slate-500">
                              Cost/tablet: {getCurrency(getPurchaseCostPerUnit(medicine))}
                              </span>
                            </span>

                            <button
                              disabled={
                                disabled
                              }
                              onClick={() =>
                                handleAddToBill(
                                  medicine
                                )
                              }
                              className="w-7 h-7 border rounded-lg hover:bg-blue-700 hover:text-white disabled:opacity-40 flex items-center justify-center"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>

                          </div>

                        </div>
                      );
                    }
                  )}

                  {filteredBillMedicines.length ===
                    0 && (
                    <div className="p-8 text-center text-xs text-slate-600 dark:text-slate-400">
                      No medicines found.
                    </div>
                  )}

                </div>

              </div>

              <div className="bg-white rounded-2xl border shadow-sm flex flex-col overflow-hidden lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">

                <div className="p-4 border-b">

                  <h3 className="font-bold text-sm">
                    Invoice
                  </h3>

                </div>

                <div className="p-4 border-b space-y-3">

                  <select
                    value={
                      selectedCustomerId
                    }
                    onChange={(event) => {
                      const nextId = event.target.value;
                      const customer = customers.find((item) => item._id === nextId);
                      setSelectedCustomerId(nextId);
                      setCustomerName(customer?.name || '');
                      setGuestPhone(customer?.phone || '');
                    }}
                    className="w-full border rounded-lg px-3 py-2 text-xs"
                  >

                    <option value="">
                      Walk-in Guest
                    </option>

                    {customers.map(
                      (customer) => (
                        <option
                          key={
                            customer._id
                          }
                          value={
                            customer._id
                          }
                        >
                          {
                            customer.name
                          }{' '}
                          —{' '}
                          {
                            customer.email
                          }
                        </option>
                      )
                    )}

                  </select>

                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Customer name (optional)"
                    className="w-full border rounded-lg px-3 py-2 text-xs"
                  />

                  <input
                    value={guestPhone}
                    onChange={(event) => setGuestPhone(event.target.value)}
                    placeholder="Customer phone"
                    className="w-full border rounded-lg px-3 py-2 text-xs"
                  />

                </div>

                <button
                  onClick={handleConfirmBill}
                  disabled={isBillingPending || billItems.length === 0}
                  className="mx-4 mt-4 w-[calc(100%-2rem)] py-2.5 bg-blue-700 text-white rounded-xl text-xs font-bold disabled:opacity-40"
                >
                  {isBillingPending ? 'Processing...' : 'Commit & Post Bill'}
                </button>

                <div className="min-h-0 flex-1 overflow-y-auto">

                  {billItems.length ===
                  0 ? (

                    <div className="h-full flex items-center justify-center">

                      <div className="text-center">

                        <FileText className="w-10 h-10 text-slate-200 mx-auto" />

                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                          Invoice is empty
                        </p>

                      </div>

                    </div>

                  ) : (

                    billItems.map(
                      (item) => (
                        <div
                          key={
                            item._id
                          }
                          className="p-3 border-b flex justify-between items-center"
                        >

                          <div>

                            <div className="text-xs font-bold">
                              {
                                item.name
                              }
                            </div>

                            <div className="text-[10px] text-slate-600 dark:text-slate-400">
                              {
                                item.billQuantity
                              }{' '}
                              ×{' '}
                              {getCurrency(item.salePrice ?? item.price)}
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                              <span>Cost/unit (fixed): {getCurrency(item.purchasePrice)}</span>
                              <label className="flex items-center gap-1">
                                Sale/unit:
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.salePrice ?? item.price}
                                  onChange={(event) => {
                                    const nextPrice = event.target.value;
                                    setBillItems((previous) =>
                                      previous.map((line) =>
                                        line._id === item._id
                                          ? { ...line, salePrice: Number(nextPrice) }
                                          : line
                                      )
                                    );
                                  }}
                                  className="w-20 rounded border px-1 py-0.5 text-[10px]"
                                />
                              </label>
                            </div>

                          </div>

                          <div className="flex items-center gap-1">

                            <button
                              onClick={() =>
                                decrementQty(
                                  item._id
                                )
                              }
                              className="w-6 h-6 border rounded"
                            >
                              -
                            </button>

                            <span className="w-6 text-center text-xs">
                              {
                                item.billQuantity
                              }
                            </span>

                            <button
                              onClick={() =>
                                incrementQty(
                                  item._id
                                )
                              }
                              className="w-6 h-6 border rounded"
                            >
                              +
                            </button>

                            <button
                              onClick={() =>
                                removeFromBill(
                                  item._id
                                )
                              }
                              className="w-6 h-6 text-red-500"
                            >
                              <Trash2 className="w-3.5 h-3.5 mx-auto" />
                            </button>

                          </div>

                        </div>
                      )
                    )

                  )}

                </div>

                <div className="p-4 border-t bg-slate-50 space-y-3">

                  <div className="grid grid-cols-2 gap-2">

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        discount
                      }
                      onChange={(event) =>
                        setDiscount(
                          event.target.value
                        )
                      }
                      placeholder="Discount"
                      className="border rounded-lg px-3 py-2 text-xs"
                    />

                    <div className="flex items-center rounded-lg border px-3 py-2 text-xs font-semibold">
                      Cash only
                    </div>

                  </div>

                  {billError && (
                    <div className="p-2 bg-red-50 text-red-700 rounded-lg text-xs">
                      {
                        billError
                      }
                    </div>
                  )}

                  <div className="flex justify-between">

                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      Subtotal
                    </span>

                    <span className="text-xs font-bold">
                      {getCurrency(
                        subtotal
                      )}
                    </span>

                  </div>

                  <div className="flex justify-between">

                    <span className="font-bold text-sm">
                      Total
                    </span>

                    <span className="font-bold text-blue-700">
                      {getCurrency(
                        total
                      )}
                    </span>

                  </div>

                </div>

              </div>

            </div>
          )}

          {/* ================================================================= */}
          {/* CUSTOMERS */}
          {/* ================================================================= */}

          {activeTab ===
            'customers' && (
            <div className="space-y-4">

              {currentUser?.role === 'superadmin' && pendingCustomers.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <h3 className="font-bold text-sm text-amber-900">
                        Customer Approval Requests ({pendingCustomers.length})
                      </h3>
                      <p className="text-xs text-amber-700 mt-1">
                        Approve accounts before they can access the customer portal.
                      </p>
                    </div>
                    {isPendingCustomersLoading && (
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-700" />
                    )}
                  </div>

                  <div className="space-y-2">
                    {pendingCustomers.map((customer) => (
                      <div
                        key={customer._id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl bg-white border border-amber-100 p-3"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-slate-50">
                            {customer.name}
                          </p>
                          <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">
                            {customer.email} {customer.phone && `| ${customer.phone}`}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={updateCustomerStatusMutation.isPending}
                            onClick={() => updateCustomerStatusMutation.mutate({ customerId: customer._id, action: 'approve' })}
                            className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-[10px] font-bold disabled:opacity-50"
                          >
                            <CheckCircle className="inline w-3.5 h-3.5 mr-1" />
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={updateCustomerStatusMutation.isPending}
                            onClick={() => updateCustomerStatusMutation.mutate({ customerId: customer._id, action: 'reject' })}
                            className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-[10px] font-bold disabled:opacity-50"
                          >
                            <X className="inline w-3.5 h-3.5 mr-1" />
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-50 shadow-sm overflow-hidden">

              <div className="p-5 border-b">

                <h3 className="font-bold text-sm">
                  Customer Accounts
                </h3>

                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Manage customer accounts and approval requests.
                </p>

              </div>

              <div className="overflow-x-auto">

                <table className="w-full">

                  <thead>

                    <tr className="bg-slate-50 text-[10px] uppercase text-slate-600 dark:text-slate-400">

                      <th className="p-3 text-left">
                        Name
                      </th>

                      <th className="p-3 text-left">
                        Email
                      </th>

                      <th className="p-3 text-left">
                        Role
                      </th>

                      <th className="p-3 text-right">
                        Action
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {isCustomersLoading ? (

                      <tr>

                        <td
                          colSpan={4}
                          className="p-8 text-center text-xs text-slate-600 dark:text-slate-400"
                        >
                          Loading customers...
                        </td>

                      </tr>

                    ) : customers.length ===
                      0 ? (

                      <tr>

                        <td
                          colSpan={4}
                          className="p-8 text-center text-xs text-slate-600 dark:text-slate-400"
                        >
                          No customers found.
                        </td>

                      </tr>

                    ) : (

                      customers.map(
                        (customer) => (
                          <tr
                            key={
                              customer._id
                            }
                            className="border-t"
                          >

                            <td className="p-3 text-xs font-bold">
                              {
                                customer.name
                              }
                            </td>

                            <td className="p-3 text-xs">
                              {
                                customer.email
                              }
                            </td>

                            <td className="p-3">

                              <span className="text-[10px] bg-slate-100 rounded px-2 py-1 uppercase">
                                {
                                  customer.role
                                }
                              </span>

                            </td>

                            <td className="p-3 text-right">

                              <button
                                onClick={() => {
                                  setSelectedCustomerId(
                                    customer._id
                                  );

                                  setActiveTab(
                                    'new-bill'
                                  );
                                }}
                                className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold"
                              >
                                Create Bill
                              </button>

                            </td>

                          </tr>
                        )
                      )

                    )}

                  </tbody>

                </table>

              </div>

              </div>

            </div>
          )}

          {/* ================================================================= */}
          {/* NOTIFICATIONS */}
          {/* ================================================================= */}

          {activeTab ===
            'notifications' && (
            <div className="space-y-3">

              {[
                {
                  number: '1',
                  title:
                    'Expired Medicines Check',
                  description:
                    'Check expired and soon-to-expire medicines.',
                },

                {
                  number: '2',
                  title:
                    'Low Stock Check',
                  description:
                    'Check medicines below reorder level.',
                },

                {
                  number: '3',
                  title:
                    'Customer Reminders',
                  description:
                    'Run customer medicine reminders.',
                },
              ].map(
                (item) => (
                  <div
                    key={
                      item.number
                    }
                    className="bg-white p-4 rounded-2xl border shadow-sm flex items-center justify-between"
                  >

                    <div className="flex items-center gap-3">

                      <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Bell className="w-4 h-4" />
                      </div>

                      <div>

                        <h4 className="text-xs font-bold">
                          {
                            item.title
                          }
                        </h4>

                        <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">
                          {
                            item.description
                          }
                        </p>

                      </div>

                    </div>

                    <button
                      onClick={() =>
                        handleTriggerCron(
                          item.number
                        )
                      }
                      disabled={
                        triggerLoading ===
                        item.number
                      }
                      className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-1"
                    >

                      <Play className="w-3 h-3" />

                      {triggerLoading ===
                      item.number
                        ? 'Running'
                        : 'Run'}

                    </button>

                  </div>
                )
              )}

            </div>
          )}

          {/* ================================================================= */}
          {/* UDHAR KHATA */}
          {/* ================================================================= */}
          {activeTab === 'udhar' && (
            <UdharManagement />
          )}

          {/* ================================================================= */}
          {/* SETTINGS */}
          {/* ================================================================= */}

          {activeTab ===
            'settings' && (
            <div className="max-w-xl mx-auto space-y-4">

              {currentUser?.role === 'superadmin' && (
                <button type="button" onClick={() => navigate('/superadmin')} className="w-full rounded-xl bg-teal-700 px-4 py-3 text-left text-sm font-bold text-white shadow-sm hover:bg-teal-800">
                  Admin Settings · Open User Control Panel
                </button>
              )}

              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-50 shadow-sm">

                <div className="flex items-center gap-3">

                  <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xl font-bold">
                    {currentUser?.name
                      ?.charAt(0)
                      .toUpperCase() ||
                      'P'}
                  </div>

                  <div>

                    <h3 className="font-bold text-sm">
                      {
                        currentUser?.name
                      }
                    </h3>

                    <p className="text-[10px] text-blue-600 uppercase font-bold">
                      {
                        currentUser?.role
                      }
                    </p>

                  </div>

                </div>

                <div className="mt-4 text-xs">

                  <span className="text-[9px] uppercase text-slate-600 dark:text-slate-400 font-bold">
                    Email
                  </span>

                  <p className="font-semibold mt-1">
                    {
                      currentUser?.email
                    }
                  </p>

                </div>

              </div>

              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-50 shadow-sm">

                <div className="flex items-center gap-2 mb-4">

                  <User className="w-4 h-4 text-blue-600" />

                  <h4 className="font-bold text-xs">
                    Update Profile
                  </h4>

                </div>

                {profileSuccess && (
                  <div className="mb-3 p-3 bg-emerald-50 text-emerald-700 rounded-lg text-xs">
                    {
                      profileSuccess
                    }
                  </div>
                )}

                {profileError && (
                  <div className="mb-3 p-3 bg-red-50 text-red-700 rounded-lg text-xs">
                    {
                      profileError
                    }
                  </div>
                )}

                <form
                  onSubmit={
                    handleProfileUpdate
                  }
                  className="space-y-3"
                >

                  <input
                    value={
                      profileName
                    }
                    onChange={(event) =>
                      setProfileName(
                        event.target.value
                      )
                    }
                    className="w-full border rounded-lg px-3 py-2 text-xs"
                  />

                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-700 text-white rounded-lg text-xs font-bold"
                  >
                    Save Changes
                  </button>

                </form>

              </div>

              <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-50 shadow-sm">

                <div className="flex items-center gap-2 mb-4">

                  <Lock className="w-4 h-4 text-blue-600" />

                  <h4 className="font-bold text-xs">
                    Change Password
                  </h4>

                </div>

                {passwordSuccess && (
                  <div className="mb-3 p-3 bg-emerald-50 text-emerald-700 rounded-lg text-xs">
                    {
                      passwordSuccess
                    }
                  </div>
                )}

                {passwordError && (
                  <div className="mb-3 p-3 bg-red-50 text-red-700 rounded-lg text-xs">
                    {
                      passwordError
                    }
                  </div>
                )}

                <form
                  onSubmit={
                    handlePasswordReset
                  }
                  className="space-y-3"
                >

                  <div className="relative">

                    <input
                      type={
                        showCurrentPassword
                          ? 'text'
                          : 'password'
                      }
                      value={
                        currentPassword
                      }
                      onChange={(event) =>
                        setCurrentPassword(
                          event.target.value
                        )
                      }
                      placeholder="Current Password"
                      className="w-full border rounded-lg px-3 py-2 pr-10 text-xs"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowCurrentPassword(
                          !showCurrentPassword
                        )
                      }
                      className="absolute right-3 top-2.5 text-slate-600 dark:text-slate-400"
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>

                  </div>

                  <div className="relative">

                    <input
                      type={
                        showNewPassword
                          ? 'text'
                          : 'password'
                      }
                      value={
                        newPassword
                      }
                      onChange={(event) =>
                        setNewPassword(
                          event.target.value
                        )
                      }
                      placeholder="New Password"
                      className="w-full border rounded-lg px-3 py-2 pr-10 text-xs"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowNewPassword(
                          !showNewPassword
                        )
                      }
                      className="absolute right-3 top-2.5 text-slate-600 dark:text-slate-400"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>

                  </div>

                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-700 text-white rounded-lg text-xs font-bold"
                  >
                    Update Password
                  </button>

                </form>

              </div>

            </div>
          )}

        </div>

      </main>

      {/* ===================================================================== */}
      {/* ===================================================================== */}
      {/* MEDICINE CREATE / EDIT MODAL */}
      {/* ===================================================================== */}

      {mobileScannerActive && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 text-center relative">
            <button type="button" onClick={stopMobileScanner} className="absolute right-4 top-4 rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="h-5 w-5" />
            </button>

            <Smartphone className="w-12 h-12 text-teal-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Mobile Scanner</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Connect both devices to the same Wi-Fi or laptop hotspot. The mobile page has access only to this temporary scanner session.
            </p>

            {mobileScannerUrl ? (
              <div className="bg-white p-3 rounded-2xl shadow-inner inline-block border-2 border-teal-100 mb-4">
                <QRCodeSVG value={mobileScannerUrl} size={170} />
              </div>
            ) : (
              <div className="h-[170px] w-[170px] bg-slate-100 animate-pulse rounded-2xl mx-auto mb-4 flex items-center justify-center">
                <RefreshCw className="h-8 w-8 text-slate-400 animate-spin" />
              </div>
            )}

            {mobileScannerUrl && (
              <>
                <p className="text-[10px] text-slate-400 mb-2 font-mono break-all">{mobileScannerUrl}</p>
                <p className="text-[10px] text-amber-700 dark:text-amber-300 mb-4">
                  Android Chrome requires a secure page for camera access. Plain HTTP over Wi-Fi may block the camera. For USB, run <code>{`adb reverse tcp:${window.location.port || '5173'} tcp:${window.location.port || '5173'}`}</code> and open the localhost version of this link on the phone.
                </p>
                <a href={mobileScannerUrl.replace(/:\/\/[^/:]+/, '://localhost')} target="_blank" rel="noreferrer" className="inline-block text-[10px] font-semibold text-teal-700 underline dark:text-teal-300">USB pairing link (requires ADB reverse)</a>
                <p className="mt-1 mb-4 break-all font-mono text-[9px] text-slate-500">{mobileScannerUrl.replace(/:\/\/[^/:]+/, '://localhost')}</p>
              </>
            )}

            {/* Live connection status */}
            {mobileConnected ? (
              <div className="flex items-center justify-center gap-2 text-sm text-emerald-700 font-bold bg-emerald-50 py-2.5 px-4 rounded-full border border-emerald-200">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                📱 Phone Connected — Scanning Active
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-sm text-amber-700 font-bold bg-amber-50 py-2.5 px-4 rounded-full border border-amber-200">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                Waiting for phone to connect...
              </div>
            )}
          </div>
        </div>
      )}

      {cameraActive && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Camera scan for {cameraTarget === 'bill' ? 'bill item' : 'medicine details'}
                </h3>
                <p className="mt-1 text-[10px] text-slate-500">
                  Position the medicine label in frame and capture a clear, well-lit image.
                </p>
              </div>
              <button type="button" onClick={stopCamera} aria-label="Close camera" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            <video
              ref={cameraVideoRef}
              autoPlay
              playsInline
              muted
              className="max-h-[60vh] w-full rounded-xl bg-black object-contain"
            />
            {(cameraTarget === 'bill' ? billError : error) && (
              <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
                {cameraTarget === 'bill' ? billError : error}
              </p>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={stopCamera} className="rounded-lg border px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                Cancel
              </button>
              <button type="button" onClick={captureCameraImage} disabled={ocrLoading} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                {ocrLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {ocrLoading ? 'Scanning...' : 'Capture & Scan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {medModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">

          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-5 max-h-[90vh] overflow-y-auto">

            <div className="flex justify-between items-center mb-4 pb-3 border-b">

              <h3 className="font-bold text-sm text-blue-700">
                {
                  editingMedicine
                    ? 'Edit Medicine'
                    : 'Add Medicine'
                }
              </h3>

              <button
                onClick={
                  closeMedModal
                }
                className="text-slate-600 dark:text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>

            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-xs">
                {error}
              </div>
            )}

            {!editingMedicine && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">

                <div className="flex items-center gap-2 text-blue-700 font-bold text-xs">

                  <Barcode className="w-4 h-4" />

                  OCR Smart Scanner

                </div>

                <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 mb-3">
                  Use the camera on this device, choose a label image, or use your phone camera as a remote scanner.
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <button type="button" onClick={() => startMobileScanner('medicine')} className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-1.5 text-[10px] font-bold text-white shadow hover:bg-teal-700 transition">
                    <Smartphone className="w-3.5 h-3.5" />
                    Connect Mobile Scanner
                  </button>
                </div>
                <p className="mb-3 text-[10px] text-amber-700 dark:text-amber-300">Android Chrome blocks live camera access on plain HTTP Wi-Fi links. Use the USB localhost link from the pairing dialog, or a trusted HTTPS address.</p>

                {ocrLoading && (
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-bold text-blue-700">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Scanning label, please wait...
                  </div>
                )}

                <input
                  ref={
                    fileInputRef
                  }
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={
                    ocrLoading
                  }
                  onChange={
                    handleOcrFileChange
                  }
                  className="text-xs"
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startCamera('medicine')}
                    disabled={ocrLoading}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    <Camera className="h-4 w-4" />
                    Open Camera
                  </button>
                  <span className="self-center text-[10px] text-slate-500">
                    Android camera access needs HTTPS or localhost. USB can provide a localhost connection with ADB; the phone browser still controls its own camera.
                  </span>
                </div>

              </div>
            )}

            {ocrPreview && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    Scanned medicine information
                  </p>
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {ocrPreview.confidence} confidence
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                  <div>
                    <span className="text-[10px] text-slate-600 dark:text-slate-400 dark:text-slate-600 dark:text-slate-400">Medicine</span>
                    <p className="font-bold text-slate-900 dark:text-slate-50 dark:text-white">{ocrPreview.medicineName || 'Not detected'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-600 dark:text-slate-400 dark:text-slate-600 dark:text-slate-400">Expiry</span>
                    <p className="font-bold text-slate-900 dark:text-slate-50 dark:text-white">{ocrPreview.expiryDate || 'Not detected'}</p>
                  </div>
                  {Object.entries(ocrPreview.scannedPrices || {}).some(([, value]) => value !== null) && (
                    <div className="sm:col-span-3">
                      <span className="text-[10px] text-slate-600 dark:text-slate-400">
                        Explicitly labeled prices (review before entry)
                      </span>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {Object.entries(ocrPreview.scannedPrices)
                          .filter(([, value]) => value !== null)
                          .map(([label, value]) => `${label}: PKR ${Number(value).toFixed(2)}`)
                          .join(' · ')}
                      </p>
                    </div>
                  )}
                </div>
                {ocrPreview.rawText && (
                  <div className="mt-3 text-left">
                    <label htmlFor="mobile-ocr-review" className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">Text read from the package — review and edit; no medicine name was guessed</label>
                    <textarea id="mobile-ocr-review" rows={3} value={ocrPreview.rawText} onChange={event => setOcrPreview(current => ({ ...current, rawText: event.target.value }))} className="mt-1 w-full rounded-lg border border-emerald-200 bg-white p-2 text-xs text-slate-800 dark:border-emerald-900 dark:bg-slate-900 dark:text-slate-100" />
                    <button type="button" onClick={() => setName(ocrPreview.rawText.trim())} className="mt-2 rounded-lg bg-emerald-700 px-3 py-1.5 text-[10px] font-bold text-white">Use reviewed text as medicine name</button>
                  </div>
                )}
                <p className="mt-2 text-[10px] text-emerald-800 dark:text-emerald-300">
                  OCR results are suggestions. Verify every value before saving; names are filled only when a known medicine term is recognized.
                </p>
              </div>
            )}

            <form
              onSubmit={
                handleMedSubmit
              }
              className="space-y-3"
            >

              <div className="grid grid-cols-1 gap-3">
                <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                  Medicine name
                <input
                  required
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value
                    )
                  }
                  placeholder="e.g. ALII"
                  className="w-full min-w-0 rounded-lg border px-3 py-2 text-xs font-normal"
                />
                </label>

              </div>

              <div className="grid grid-cols-1 gap-3">
                <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                  Manufacturer
                <input
                  required
                  value={
                    manufacturer
                  }
                  onChange={(event) =>
                    setManufacturer(
                      event.target.value
                    )
                  }
                  placeholder="Manufacturer"
                  className="w-full min-w-0 rounded-lg border px-3 py-2 text-xs font-normal"
                />
                </label>

              </div>

              <div className="grid grid-cols-1 gap-3">
                <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                  Expiry date
                <input
                  required
                  type="date"
                  value={
                    expiryDate
                  }
                  onChange={(event) =>
                    setExpiryDate(
                      event.target.value
                    )
                  }
                  className="w-full min-w-0 rounded-lg border px-3 py-2 text-xs font-normal"
                />
                </label>

              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                  Purchase cost per pack (PKR)
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={purchasePrice}
                    onChange={(event) => setPurchasePrice(event.target.value)}
                    placeholder="Full pack price"
                    className="w-full min-w-0 rounded-lg border px-3 py-2 text-xs font-normal"
                  />
                </label>

                <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                  Units per pack
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={unitsPerPack}
                    onChange={(event) => setUnitsPerPack(event.target.value)}
                    placeholder="e.g. 20 tablets"
                    className="w-full min-w-0 rounded-lg border px-3 py-2 text-xs font-normal"
                  />
                </label>

                <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                  Sale price per unit (PKR)
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    placeholder="One tablet price"
                    className="w-full min-w-0 rounded-lg border px-3 py-2 text-xs font-normal"
                  />
                </label>

                <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                  Stock quantity (units)
                  <input
                    required
                    type="number"
                    min="0"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    placeholder="Tablets in stock"
                    className="w-full min-w-0 rounded-lg border px-3 py-2 text-xs font-normal"
                  />
                </label>
              </div>
              <p className="-mt-2 text-[10px] text-slate-500">
                Sale and stock are per tablet/unit. Unit purchase cost is pack cost divided by units per pack; e.g. PKR 100 divided by 10 tablets = PKR 10 per tablet.
              </p>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/60">
                  <span className="text-slate-500">Cost per tablet/unit</span>
                  <strong className="ml-2 text-slate-800 dark:text-slate-100">{getCurrency(getPurchaseCostPerUnit(purchasePrice, unitsPerPack))}</strong>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/60">
                  <span className="text-slate-500">Profit per tablet/unit</span>
                  <strong className={`ml-2 ${Number(price) - getPurchaseCostPerUnit(purchasePrice, unitsPerPack) < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {getCurrency((Number(price) || 0) - getPurchaseCostPerUnit(purchasePrice, unitsPerPack))}
                  </strong>
                </div>
              </div>
              {Number(purchasePrice) > 0 && Number(unitsPerPack) > 0 && Number(price) > 0 && Number(price) < getPurchaseCostPerUnit(purchasePrice, unitsPerPack) && (
                <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Warning: this tablet/unit will be sold below its purchase cost.
                </p>
              )}

              <div className="grid grid-cols-1 gap-3">
                <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                  Rack / shelf location
                <input
                  value={
                    rackLocation
                  }
                  onChange={(event) =>
                    setRackLocation(
                      event.target.value
                    )
                  }
                  placeholder="e.g. R-02-B"
                  className="w-full min-w-0 rounded-lg border px-3 py-2 text-xs font-normal"
                />
                </label>

              </div>

              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Additional medicine details (optional)
                  </p>
                  <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                    Generic name
                    <input
                      value={genericName}
                      onChange={(event) => setGenericName(event.target.value)}
                      placeholder="Active ingredient"
                      className="w-full min-w-0 rounded-lg border px-3 py-2 text-xs font-normal"
                    />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                      Reorder level (units)
                      <input
                        type="number"
                        min="0"
                        value={reorderLevel}
                        onChange={(event) => setReorderLevel(event.target.value)}
                        className="w-full min-w-0 rounded-lg border px-3 py-2 text-xs font-normal"
                      />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                      Category
                      <select
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                        className="w-full min-w-0 rounded-lg border px-3 py-2 text-xs font-normal"
                      >
                        {standardCategories.map((item) => (
                          <option key={item} value={item}>{item}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                      Barcode
                      <input
                        value={barcode}
                        onChange={(event) => setBarcode(event.target.value)}
                        className="w-full min-w-0 rounded-lg border px-3 py-2 text-xs font-normal"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">Supplier name<input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} placeholder="Supplier / wholesaler" className="w-full min-w-0 rounded-lg border px-3 py-2 text-xs font-normal" /></label>
                    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">Supplier phone<input value={supplierPhone} onChange={(event) => setSupplierPhone(event.target.value)} placeholder="Contact number" className="w-full min-w-0 rounded-lg border px-3 py-2 text-xs font-normal" /></label>
                  </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">

                <button
                  type="button"
                  onClick={
                    closeMedModal
                  }
                  className="px-4 py-2 bg-slate-100 rounded-lg text-xs font-bold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    createMedMutation.isPending ||
                    updateMedMutation.isPending
                  }
                  className="px-4 py-2 bg-blue-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  {createMedMutation.isPending ||
                  updateMedMutation.isPending
                    ? 'Saving...'
                    : 'Save Medicine'}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* ===================================================================== */}
      {/* BULK MODAL */}
      {/* ===================================================================== */}

      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">

          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl p-5">

            <div className="flex justify-between mb-4">

              <h3 className="font-bold text-sm">
                Bulk Medicine Import
              </h3>

              <button
                onClick={() =>
                  setBulkModalOpen(
                    false
                  )
                }
              >
                <X className="w-4 h-4" />
              </button>

            </div>

            {bulkSuccess && (
              <div className="mb-3 p-3 bg-emerald-50 text-emerald-700 rounded-lg text-xs">
                {
                  bulkSuccess
                }
              </div>
            )}

            {bulkError && (
              <div className="mb-3 p-3 bg-red-50 text-red-700 rounded-lg text-xs">
                {
                  bulkError
                }
              </div>
            )}

            <MedicineImportIssues compact />

            <form
              onSubmit={
                handleBulkSubmit
              }
              className="space-y-3"
            >
              <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                <button
                  type="button"
                  onClick={() => { setImportMode('excel'); setBulkPreviewResult(null); }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${importMode === 'excel' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Excel File Upload
                </button>
                <button
                  type="button"
                  onClick={() => { setImportMode('json'); setBulkPreviewResult(null); }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${importMode === 'json' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  JSON Upload
                </button>
              </div>

              {importMode === 'excel' ? (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs text-slate-500">Upload Excel file (.xlsx) with medicine data.</p>
                    <button type="button" onClick={downloadExcelTemplate} className="text-blue-600 hover:text-blue-800 underline text-xs font-semibold transition">
                      Download Sample Excel
                    </button>
                  </div>
                  
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-slate-50 transition hover:bg-slate-100">
                    <Upload className="h-10 w-10 text-slate-400 mb-3" />
                    <label className="bg-white border border-slate-200 text-slate-700 shadow-sm px-4 py-2 rounded-lg text-sm font-bold cursor-pointer hover:bg-slate-50 hover:text-slate-900 transition">
                      Select Excel File
                      <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
                    </label>
                    {bulkFile && (
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg w-full text-center">
                        <p className="text-xs text-slate-600 font-semibold">{bulkFile.name}</p>
                        <p className="text-xs text-blue-700 font-bold mt-1">{bulkData.length} items found</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <textarea
                  rows={10}
                  value={bulkJson}
                  onChange={(event) => { setBulkJson(event.target.value); setBulkPreviewResult(null); }}
                  placeholder={`[\n  {\n    "name": "Panadol 500mg",\n    "genericName": "Paracetamol",\n    "manufacturer": "GSK",\n    "expiryDate": "2028-01-01",\n    "purchasePrice": 400,\n    "unitsPerPack": 20,\n    "price": 25,\n    "quantity": 500,\n    "reorderLevel": 50,\n    "category": "Analgesic",\n    "barcode": "",\n    "rackLocation": "R-02-B"\n  }\n]`}
                  className="w-full border rounded-lg p-3 font-mono text-xs"
                />
              )}

              {bulkPreviewResult && (
                <div className="max-h-72 overflow-auto rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <p className="text-xs font-bold text-blue-900">Preview: {bulkPreviewResult.validCount} valid · {bulkPreviewResult.invalidCount} need correction · {bulkPreviewResult.totalRows} total</p>
                  <p className="mt-1 text-[10px] text-blue-800">Valid rows will be imported after confirmation. Invalid rows are saved for Admin and Pharmacist review.</p>
                  <div className="mt-2 space-y-1">
                    {bulkPreviewResult.rows.slice(0, 80).map((row) => <div key={row.rowNumber} className={`rounded-lg border p-2 text-[10px] ${row.errors.length ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><strong>Row {row.rowNumber}: {row.medicine.name || 'Unnamed'}</strong><span className="ml-2">Purchase {Number.isFinite(row.medicine.purchasePrice) ? row.medicine.purchasePrice : '—'} · Units/pack {row.medicine.unitsPerPack || '—'} · Sale/unit {Number.isFinite(row.medicine.price) ? row.medicine.price : '—'} · Stock {Number.isFinite(row.medicine.quantity) ? row.medicine.quantity : '—'} · Expiry {row.medicine.expiryDate ? new Date(row.medicine.expiryDate).toLocaleDateString('en-PK') : '—'}</span>{row.errors.length > 0 && <ul className="mt-1 list-inside list-disc">{row.errors.map((error, index) => <li key={index}>{error}</li>)}</ul>}</div>)}
                    {bulkPreviewResult.rows.length > 80 && <p className="text-[10px] text-slate-600">Showing first 80 rows. {bulkPreviewResult.rows.length - 80} more rows are included in the preview validation.</p>}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={
                    bulkImportMutation.isPending || (importMode === 'excel' ? (!bulkFile || bulkData.length === 0) : !bulkJson.trim())
                }
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-bold shadow hover:brightness-110 disabled:opacity-50 transition"
              >
                {
                  bulkImportMutation.isPending
                    ? 'Processing...'
                    : bulkPreviewResult ? `Confirm & Import ${bulkPreviewResult.validCount} valid rows` : 'Validate & Preview'
                }
              </button>

            </form>

          </div>

        </div>
      )}

      {/* ===================================================================== */}
      {/* MEDICINE DETAILS MODAL */}
      {/* ===================================================================== */}

      {selectedMedicine && (
        <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">

          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl max-h-[90vh] overflow-hidden">

            <div className="p-5 border-b flex items-center justify-between">

              <div>

                <div className="flex items-center gap-2">

                  <Package className="w-5 h-5 text-blue-600" />

                  <h3 className="font-bold text-base">
                    Medicine Details
                  </h3>

                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Complete medicine, expiry and rack information
                </p>

              </div>

              <button
                onClick={
                  closeMedicineDetails
                }
                className="text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>

            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(90vh-80px)]">

              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-5">

                <div>

                  <h2 className="text-lg font-bold">
                    {
                      selectedMedicine.name ||
                      'N/A'
                    }
                  </h2>

                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    {
                      selectedMedicine.genericName ||
                      'N/A'
                    }
                  </p>

                  <div className="mt-2">
                    <CategoryBadge
                      category={
                        selectedMedicine.category
                      }
                    />
                  </div>

                </div>

                <ExpiryBadge
                  status={
                    selectedMedicine.expiryStatus
                  }
                />

              </div>

              {selectedMedicine.labelImageUrl && (
                <div className="mb-5">

                  <img
                    src={
                      selectedMedicine.labelImageUrl
                    }
                    alt={
                      selectedMedicine.name ||
                      'Medicine label'
                    }
                    className="w-full max-h-64 object-contain rounded-xl border bg-slate-50"
                  />

                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-2 text-[10px] uppercase text-slate-600 dark:text-slate-400 font-bold">
                    <Building2 className="w-3.5 h-3.5" />
                    Manufacturer
                  </div>
                  <div className="text-xs font-semibold mt-2">
                    {
                      selectedMedicine.manufacturer ||
                      'N/A'
                    }
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-2 text-[10px] uppercase text-slate-600 dark:text-slate-400 font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    Expiry Date
                  </div>
                  <div className="text-xs font-semibold mt-2">
                    {formatDate(
                      selectedMedicine.expiryDate
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-2 text-[10px] uppercase text-slate-600 dark:text-slate-400 font-bold">
                    <Package className="w-3.5 h-3.5" />
                    Current Stock
                  </div>
                  <div className="text-xs font-semibold mt-2">
                    {
                      selectedMedicine.quantity ??
                      0
                    }{' '}
                    units
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-2 text-[10px] uppercase text-slate-600 dark:text-slate-400 font-bold">
                    <Layers className="w-3.5 h-3.5" />
                    Reorder Level
                  </div>
                  <div className="text-xs font-semibold mt-2">
                    {
                      selectedMedicine.reorderLevel ??
                      0
                    }{' '}
                    units
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-2 text-[10px] uppercase text-slate-600 dark:text-slate-400 font-bold">
                    <Wallet className="w-3.5 h-3.5" />
                    Unit Price
                  </div>
                  <div className="text-xs font-semibold mt-2">
                    {getCurrency(
                      selectedMedicine.price
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-2 text-[10px] uppercase text-slate-600 dark:text-slate-400 font-bold">
                    <Barcode className="w-3.5 h-3.5" />
                    Barcode
                  </div>
                  <div className="text-xs font-semibold mt-2 font-mono break-all">
                    {
                      selectedMedicine.barcode ||
                      'Not available'
                    }
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-xl">
                  <div className="flex items-center gap-2 text-[10px] uppercase text-blue-600 font-bold">
                    <Layers className="w-3.5 h-3.5" />
                    Rack / Shelf Location
                  </div>
                  <div className="text-xs font-semibold mt-2 text-blue-800">
                    {selectedMedicine.rackLocation || 'Not assigned'}
                  </div>
                </div>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">

                <div className="p-3 border rounded-xl">

                  <div className="flex items-center gap-2 text-[10px] uppercase text-slate-600 dark:text-slate-400 font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    Days Left
                  </div>

                  <div className="text-sm font-bold mt-2">

                    {(() => {
                      const days =
                        getDaysLeft(
                          selectedMedicine.expiryDate
                        );

                      if (
                        days ===
                        null
                      ) {
                        return 'N/A';
                      }

                      if (
                        days <=
                        0
                      ) {
                        return 'Expired';
                      }

                      return `${days} days`;
                    })()}

                  </div>

                </div>

                <div className="p-3 border rounded-xl">

                  <div className="flex items-center gap-2 text-[10px] uppercase text-slate-600 dark:text-slate-400 font-bold">
                    <Tag className="w-3.5 h-3.5" />
                    Category
                  </div>

                  <div className="text-sm font-bold mt-2">
                    {
                      selectedMedicine.category ||
                      'Other'
                    }
                  </div>

                </div>

              </div>

              <div className="mt-5 p-4 border rounded-xl">

                <h4 className="text-xs font-bold mb-3">
                  Record Information
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">

                  <div>

                    <span className="text-slate-600 dark:text-slate-400">
                      Medicine ID
                    </span>

                    <div className="font-mono font-semibold mt-1 break-all">
                      {
                        selectedMedicine._id ||
                        'N/A'
                      }
                    </div>

                  </div>

                  <div>

                    <span className="text-slate-600 dark:text-slate-400">
                      Created At
                    </span>

                    <div className="font-semibold mt-1">
                      {formatDateTime(
                        selectedMedicine.createdAt
                      )}
                    </div>

                  </div>

                  <div>

                    <span className="text-slate-600 dark:text-slate-400">
                      Updated At
                    </span>

                    <div className="font-semibold mt-1">
                      {formatDateTime(
                        selectedMedicine.updatedAt
                      )}
                    </div>

                  </div>

                  <div>

                    <span className="text-slate-600 dark:text-slate-400">
                      Label Image URL
                    </span>

                    <div className="font-semibold mt-1 break-all">
                      {
                        selectedMedicine.labelImageUrl ||
                        'N/A'
                      }
                    </div>

                  </div>

                </div>

              </div>

              <div className="flex justify-end gap-2 mt-5">

                <button
                  onClick={() => {
                    setStockAdjMedicine(selectedMedicine);
                  }}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Adjust Stock
                </button>

                <button
                  onClick={() => {
                    openEditModal(
                      selectedMedicine
                    );
                    closeMedicineDetails();
                  }}
                  className="px-4 py-2 bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-2"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </button>

                  {currentUser?.role === 'pharmacist' && (
                  <button
                    onClick={() => { handleDelete(selectedMedicine._id); closeMedicineDetails(); }}
                    className="px-4 py-2 bg-red-50 text-red-700 rounded-lg text-xs font-bold flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Request Admin Deletion
                  </button>
                )}

                <button
                  onClick={
                    closeMedicineDetails
                  }
                  className="px-4 py-2 bg-slate-100 rounded-lg text-xs font-bold"
                >
                  Close
                </button>

              </div>

            </div>

          </div>

        </div>
      )}

      {/* ===================================================================== */}
      {/* SALES DETAILS MODAL */}
      {/* ===================================================================== */}

      {salesDetailsType && (
        <div className="fixed inset-0 z-[65] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">

          <div className="bg-white w-full max-w-5xl rounded-2xl shadow-xl max-h-[92vh] overflow-hidden">

            <div className="p-5 border-b flex items-center justify-between">

              <div>

                <div className="flex items-center gap-2">

                  {salesDetailsType ===
                  'daily' ? (
                    <Wallet className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                  )}

                  <h3 className="font-bold text-base">

                    {salesDetailsType === 'daily'
                      ? "Today's Sales Details"
                      : salesDetailsType === 'yearly'
                        ? `${new Date().getFullYear()} Yearly Sales Details`
                        : 'Monthly Sales Details'}

                  </h3>

                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">

                  {salesDetailsType === 'daily'
                    ? "Complete sales information for today's transactions."
                    : salesDetailsType === 'yearly'
                      ? `Complete net sales information for ${new Date().getFullYear()}.`
                      : 'Complete sales information for the current month.'}

                </p>

              </div>

              <button
                onClick={
                  closeSalesDetails
                }
                className="text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>

            </div>

            <div className="p-5 border-b">

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">

                  <div className="text-[10px] uppercase font-bold text-emerald-600">
                    Total Sales
                  </div>

                  <div className="text-xl font-bold text-emerald-700 mt-2">
                    {getCurrency(
                      selectedSalesTotal
                    )}
                  </div>

                </div>

                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">

                  <div className="text-[10px] uppercase font-bold text-blue-600">
                    Total Bills
                  </div>

                  <div className="text-xl font-bold text-blue-700 mt-2">
                    {
                      selectedSalesBillCount
                    }
                  </div>

                </div>

                <div className="p-4 rounded-xl bg-violet-50 border border-violet-100">

                  <div className="text-[10px] uppercase font-bold text-violet-600">
                    Average Bill
                  </div>

                  <div className="text-xl font-bold text-violet-700 mt-2">
                    {getCurrency(
                      selectedSalesAverage
                    )}
                  </div>

                </div>

              </div>

            </div>

            <div className="p-5 overflow-y-auto max-h-[55vh]">

              <div className="flex items-center justify-between mb-4">

                <div>

                  <h4 className="text-sm font-bold">
                    Sales Transactions
                  </h4>

                  <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">
                    {
                      selectedSalesBillCount
                    }{' '}
                    transaction(s) found
                  </p>

                </div>

                <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-lg text-slate-600 dark:text-slate-400 font-bold">

                  {salesDetailsType === 'daily'
                    ? 'TODAY'
                    : salesDetailsType === 'yearly'
                      ? String(new Date().getFullYear())
                      : 'THIS MONTH'}

                </span>

              </div>

              {selectedSalesBills.length ===
              0 ? (

                <div className="border rounded-xl p-10 text-center">

                  <Receipt className="w-10 h-10 text-slate-200 mx-auto" />

                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-3">
                    No sales found for this period.
                  </p>

                </div>

              ) : (

                <div className="overflow-x-auto border rounded-xl">

                  <table className="w-full">

                    <thead>

                      <tr className="bg-slate-50 text-[10px] uppercase text-slate-600 dark:text-slate-400">

                        <th className="p-3 text-left">
                          #
                        </th>

                        <th className="p-3 text-left">
                          Bill
                        </th>

                        <th className="p-3 text-left">
                          Customer
                        </th>

                        <th className="p-3 text-left">
                          Payment
                        </th>

                        <th className="p-3 text-left">
                          Items
                        </th>

                        <th className="p-3 text-left">
                          Date
                        </th>

                        <th className="p-3 text-left">
                          Total
                        </th>

                        <th className="p-3 text-right">
                          Action
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {selectedSalesBills.map(
                        (
                          bill,
                          index
                        ) => {

                          const itemsCount =
                            Array.isArray(
                              bill?.netItems || bill?.items
                            )
                              ? (bill.netItems || bill.items).reduce(
                                  (
                                    sum,
                                    item
                                  ) =>
                                    sum +
                                    Number(
                                      item?.netQuantity ??
                                        item?.quantity ??
                                        0
                                    ),
                                  0
                                )
                              : 0;

                          return (
                            <tr
                              key={
                                bill?._id ||
                                index
                              }
                              className="border-b border-slate-200/80 dark:border-gray-800/80 hover:bg-teal-50/40 dark:hover:bg-gray-800/50 transition-colors"
                            >

                              <td className="p-3 text-xs text-slate-600 dark:text-slate-400">
                                {
                                  index +
                                  1
                                }
                              </td>

                              <td className="p-3 text-xs font-bold">
                                {
                                  bill?.billNumber ||
                                  bill?._id ||
                                  'N/A'
                                }
                              </td>

                              <td className="p-3 text-xs">
                                {
                                  bill?.customerName ||
                                  bill?.customer?.name ||
                                  'Walk-in Guest'
                                }
                              </td>

                              <td className="p-3 text-xs">
                                {
                                  bill?.paymentMethod ||
                                  'N/A'
                                }
                              </td>

                              <td className="p-3 text-xs">
                                {
                                  itemsCount
                                }
                              </td>

                              <td className="p-3 text-xs">
                                {formatDateTime(
                                  bill?.createdAt
                                )}
                              </td>

                              <td className="p-3 text-xs font-bold text-emerald-700">
                                {getCurrency(
                                  bill?.netTotal ??
                                    Math.max(
                                      0,
                                      Number(bill?.total || 0) -
                                        Number(bill?.totalRefunded || 0)
                                    )
                                )}
                              </td>

                              <td className="p-3 text-right">

                                <button
                                  onClick={() =>
                                    openBillDetails(
                                      bill
                                    )
                                  }
                                  className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-bold"
                                >
                                  View Details
                                </button>

                              </td>

                            </tr>
                          );
                        }
                      )}

                    </tbody>

                    <tfoot>

                      <tr className="border-t bg-slate-50">

                        <td
                          colSpan={6}
                          className="p-3 text-right text-xs font-bold"
                        >
                          Period Total
                        </td>

                        <td className="p-3 text-xs font-bold text-emerald-700">
                          {getCurrency(
                            selectedSalesTotal
                          )}
                        </td>

                        <td />

                      </tr>

                    </tfoot>

                  </table>

                </div>

              )}

            </div>

            <div className="p-5 border-t flex justify-end">

              <button
                onClick={
                  closeSalesDetails
                }
                className="px-4 py-2 bg-blue-700 text-white rounded-lg text-xs font-bold"
              >
                Close
              </button>

            </div>

          </div>

        </div>
      )}

      {/* ===================================================================== */}
      {/* BILL DETAILS MODAL */}
      {/* ===================================================================== */}

      {selectedBill && (
        <div className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">

          <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl max-h-[90vh] overflow-hidden">

            <div className="p-5 border-b flex items-center justify-between">

              <div>

                <h3 className="font-bold text-base">
                  Bill Details
                </h3>

                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Complete transaction information
                </p>

              </div>

              <button
                onClick={
                  closeBillDetails
                }
                className="text-slate-600 dark:text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>

            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(90vh-80px)]">

              <div className="grid grid-cols-2 gap-3">

                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="text-[10px] uppercase text-slate-600 dark:text-slate-400 font-bold">
                    Bill Number
                  </div>

                  <div className="text-xs font-bold mt-2 break-all">
                    {
                      selectedBill.billNumber ||
                      selectedBill._id ||
                      'N/A'
                    }
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="text-[10px] uppercase text-slate-600 dark:text-slate-400 font-bold">
                    Payment
                  </div>

                  <div className="text-xs font-bold mt-2">
                    {
                      selectedBill.paymentMethod ||
                      'N/A'
                    }
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="text-[10px] uppercase text-slate-600 dark:text-slate-400 font-bold">
                    Customer
                  </div>

                  <div className="text-xs font-bold mt-2">
                    {
                      selectedBill.customerName ||
                      selectedBill.customer?.name ||
                      'Walk-in Guest'
                    }
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="text-[10px] uppercase text-slate-600 dark:text-slate-400 font-bold">
                    Customer Phone
                  </div>

                  <div className="text-xs font-bold mt-2">
                    {
                      selectedBill.customerPhone ||
                      selectedBill.customer?.phone ||
                      'N/A'
                    }
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="text-[10px] uppercase text-slate-600 dark:text-slate-400 font-bold">
                    Discount
                  </div>

                  <div className="text-xs font-bold mt-2">
                    {getCurrency(
                      selectedBill.discount
                    )}
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-xl">
                  <div className="text-[10px] uppercase text-blue-500 font-bold">
                    Original Bill Total
                  </div>

                  <div className="text-sm font-bold text-blue-700 mt-2">
                    {getCurrency(
                      selectedBill.total
                    )}
                  </div>
                </div>

              </div>

              {/* NET SALE AMOUNT AFTER REFUND */}
              {selectedBill.isReturned && (selectedBill.totalRefunded || 0) > 0 && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50 p-4">
                  <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Return & Refund Summary
                  </h4>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-amber-200 dark:border-amber-900/40">
                      <div className="text-[10px] uppercase text-slate-500 font-bold">Original Total</div>
                      <div className="font-bold text-slate-700 dark:text-slate-200 mt-1">{getCurrency(selectedBill.total)}</div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-red-200 dark:border-red-900/40">
                      <div className="text-[10px] uppercase text-red-500 font-bold">Total Refunded</div>
                      <div className="font-bold text-red-600 dark:text-red-400 mt-1">- {getCurrency(selectedBill.totalRefunded || 0)}</div>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3 border border-emerald-300 dark:border-emerald-900/50">
                      <div className="text-[10px] uppercase text-emerald-700 font-bold">Net Sale Amount</div>
                      <div className="font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                        {getCurrency(Math.max(0, (selectedBill.total || 0) - (selectedBill.totalRefunded || 0)))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-5 border rounded-xl overflow-hidden">

                <div className="p-3 bg-slate-50 dark:bg-slate-800 border-b flex items-center justify-between">
                  <h4 className="text-xs font-bold">Bill Items</h4>
                  {selectedBill.isReturned && (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-full">
                      Some items returned
                    </span>
                  )}
                </div>

                {Array.isArray(selectedBill.items) && selectedBill.items.length > 0 ? (
                  selectedBill.items.map((item, index) => {
                    // Calculate how many of this item were returned
                    const returnedQty = (selectedBill.returns || [])
                      .filter((r) => String(r.medicineId) === String(item.medicineId))
                      .reduce((sum, r) => sum + (r.quantityReturned || 0), 0);

                    const netQty = (item.quantity || 0) - returnedQty;
                    const unitPrice = item.salePrice ?? item.unitPrice ?? 0;
                    const originalLineTotal = unitPrice * (item.quantity || 0);
                    const netLineTotal = unitPrice * Math.max(0, netQty);
                    const isFullyReturned = returnedQty >= (item.quantity || 0);

                    return (
                      <div
                        key={item._id || `${item.medicineId}-${index}`}
                        className={`p-3 border-b last:border-0 flex items-center justify-between gap-3 ${
                          isFullyReturned ? 'bg-red-50/50 dark:bg-red-950/10 opacity-70' : ''
                        }`}
                      >
                        <div className="flex-1">
                          <div className={`text-xs font-bold ${isFullyReturned ? 'line-through text-slate-400' : ''}`}>
                            {item.name || 'Medicine'}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {isFullyReturned ? (
                              <span className="text-red-500 font-semibold">All {item.quantity} returned</span>
                            ) : returnedQty > 0 ? (
                              <>
                                <span className="line-through text-slate-400">{item.quantity}</span>
                                {' → '}
                                <span className="font-bold text-emerald-700">{netQty} sold</span>
                                {' '}
                                <span className="text-amber-600">({returnedQty} returned)</span>
                                {' × '}{getCurrency(unitPrice)}
                              </>
                            ) : (
                              <>Qty: {item.quantity} × {getCurrency(unitPrice)}</>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          {returnedQty > 0 && !isFullyReturned && (
                            <div className="text-[10px] text-slate-400 line-through">{getCurrency(originalLineTotal)}</div>
                          )}
                          <div className={`text-xs font-bold ${
                            isFullyReturned ? 'text-red-400 line-through' : 'text-slate-900 dark:text-white'
                          }`}>
                            {isFullyReturned ? getCurrency(originalLineTotal) : getCurrency(netLineTotal)}
                          </div>
                          {isFullyReturned && (
                            <div className="text-[10px] font-bold text-red-500 mt-0.5">Refunded</div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-5 text-center text-xs text-slate-600 dark:text-slate-400">
                    No bill items available.
                  </div>
                )}

                {/* NET TOTALS FOOTER */}
                <div className="border-t bg-slate-50 dark:bg-slate-800/60 px-3 py-3 space-y-1">
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>Subtotal</span>
                    <span>{getCurrency(selectedBill.subtotal || selectedBill.total)}</span>
                  </div>
                  {(selectedBill.discount || 0) > 0 && (
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Discount</span>
                      <span>- {getCurrency(selectedBill.discount)}</span>
                    </div>
                  )}
                  {(selectedBill.totalRefunded || 0) > 0 && (
                    <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400 font-semibold">
                      <span>Total Refunded</span>
                      <span>- {getCurrency(selectedBill.totalRefunded)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white border-t pt-2 mt-1">
                    <span>Net Sale Amount</span>
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {getCurrency(Math.max(0, (selectedBill.total || 0) - (selectedBill.totalRefunded || 0)))}
                    </span>
                  </div>
                </div>

              </div>

              <div className="mt-4 text-xs text-slate-600 dark:text-slate-400">

                Created:{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {formatDateTime(
                    selectedBill.createdAt
                  )}
                </span>

              </div>

              <div className="flex justify-end gap-2 mt-5">

                <button
                  onClick={() => {
                    setReturnModalBill(selectedBill);
                  }}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Return Items / Refund
                </button>

                <button
                  onClick={() =>
                    window.open(
                      `/pharmacist/receipt/${selectedBill._id}`,
                      '_blank'
                    )
                  }
                  className="px-4 py-2 border border-blue-700 text-blue-700 rounded-lg text-xs font-bold"
                >
                  Print Receipt
                </button>

                <button
                  onClick={
                    closeBillDetails
                  }
                  className="px-4 py-2 bg-blue-700 text-white rounded-lg text-xs font-bold"
                >
                  Close
                </button>

              </div>

            </div>

          </div>

        </div>
      )}

      {/* ===================================================================== */}
      {/* BILL SUCCESS MODAL */}
      {/* ===================================================================== */}

      {confirmedBill && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">

          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-xl p-6">

            <button
              type="button"
              onClick={() => setConfirmedBill(null)}
              aria-label="Close completed bill"
              title="Close; the saved bill remains in sales history"
              className="absolute right-3 top-3 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center">

              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />

              <h3 className="text-xl font-bold mt-2">
                Payment Done!
              </h3>

              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Bill{' '}
                {
                  confirmedBill.billNumber ||
                  confirmedBill._id
                }{' '}
                created successfully.
              </p>

            </div>

            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs">
              <p className="font-bold">
                {confirmedBill.customerName ||
                  confirmedBill.customerId?.name ||
                  'Walk-in Guest'}
              </p>
              <p className="mt-1 text-slate-500">
                {confirmedBill.customerPhone ||
                  confirmedBill.guestPhone ||
                  confirmedBill.customerId?.phone ||
                  'Phone not provided'}
              </p>
            </div>

            <div className="border rounded-xl mt-5 overflow-hidden">

              {Array.isArray(
                confirmedBill.items
              ) &&
                confirmedBill.items.map(
                  (
                    item,
                    index
                  ) => (

                    <div
                      key={
                        item._id ||
                        `${item.name}-${index}`
                      }
                      className="p-3 flex justify-between border-b last:border-0 text-xs"
                    >

                      <span>
                        {
                          item.name
                        }{' '}
                        ×{' '}
                        {
                          item.quantity
                        }
                      </span>

                      <span className="font-bold">
                        {getCurrency(
                          Number(
                            item.unitPrice ||
                              0
                          ) *
                            Number(
                              item.quantity ||
                                0
                            )
                        )}
                      </span>

                    </div>

                  )
                )}

            </div>

            {Number(confirmedBill.discount) > 0 && (
              <div className="flex justify-between mt-3 text-xs text-emerald-700">
                <span>Discount</span>
                <span>- {getCurrency(confirmedBill.discount)}</span>
              </div>
            )}

            <div className="flex justify-between mt-4">

              <span className="font-bold text-blue-700">
                Total Paid
              </span>

              <span className="font-bold text-blue-700">
                {getCurrency(
                  confirmedBill.total
                )}
              </span>

            </div>

            <div className="flex gap-3 mt-5">

              <button
                onClick={() =>
                  window.open(
                    `/pharmacist/receipt/${confirmedBill._id}`,
                    '_blank'
                  )
                }
                className="flex-1 py-2 border border-blue-700 text-blue-700 rounded-xl text-xs font-bold"
              >
                Print Receipt
              </button>

              <button
                onClick={() =>
                  setConfirmedBill(
                    null
                  )
                }
                className="flex-1 py-2 bg-blue-700 text-white rounded-xl text-xs font-bold"
              >
                New Bill
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
};

export default PharmacistDashboard;
