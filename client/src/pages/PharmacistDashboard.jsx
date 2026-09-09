import { useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

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
  Play,
  Wallet,
  TrendingUp,
  Package,
  Clock,
  Building2,
  Hash,
  Tag,
  Layers,
  ClipboardList,
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
      'bg-red-50 text-red-700 border border-red-200',

    CRITICAL:
      'bg-rose-50 text-rose-700 border border-rose-200',

    WARNING:
      'bg-orange-50 text-orange-700 border border-orange-200',

    CAUTION:
      'bg-yellow-50 text-yellow-700 border border-yellow-200',

    SAFE:
      'bg-emerald-50 text-emerald-700 border border-emerald-200',
  };

  return (
    classes[status] ||
    'bg-slate-50 text-slate-700 border border-slate-200'
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
      'bg-slate-100 text-slate-700',
  };

  return (
    <span
      className={`text-[10px] font-semibold px-2 py-1 rounded whitespace-nowrap ${
        classes[category] ||
        'bg-slate-100 text-slate-700'
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

  const { theme, toggle } = useTheme();

  const queryClient = useQueryClient();
  const location = useLocation();

  const fileInputRef = useRef(null);

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
  const [batchNumber, setBatchNumber] =
    useState('');
  const [expiryDate, setExpiryDate] =
    useState('');
  const [manufactureDate, setManufactureDate] =
    useState('');
  const [quantity, setQuantity] =
    useState('');
  const [reorderLevel, setReorderLevel] =
    useState('10');
  const [price, setPrice] =
    useState('');
  const [category, setCategory] =
    useState('Antibiotic');
  const [barcode, setBarcode] =
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

  const [bulkJson, setBulkJson] =
    useState('');

  const [bulkError, setBulkError] =
    useState('');

  const [bulkSuccess, setBulkSuccess] =
    useState('');

  // ==========================================================================
  // BILLING
  // ==========================================================================

  const [billSearch, setBillSearch] =
    useState('');

  const [billCategory, setBillCategory] =
    useState('');

  const [selectedCustomerId, setSelectedCustomerId] =
    useState('');

  const [guestPhone, setGuestPhone] =
    useState('');

  const [billItems, setBillItems] =
    useState([]);

  const [discount, setDiscount] =
    useState('');

  const [paymentMethod, setPaymentMethod] =
    useState('Card');

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

  // ==========================================================================
  // SALES VALUES
  // ==========================================================================

  const todaySales = Number(
    salesSummary?.today?.totalSales || 0
  );

  const todayBills = Number(
    salesSummary?.today?.totalBills || 0
  );

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
          await api.delete(
            `/medicines/${id}`
          );

        return response.data;
      },

      onSuccess: (_, deletedId) => {
        queryClient.invalidateQueries({
          queryKey: ['medicines'],
        });

        if (
          selectedMedicine?._id ===
          deletedId
        ) {
          setSelectedMedicine(null);
        }
      },

      onError: (err) => {
        alert(
          err.response?.data?.message ||
            'Failed to delete medicine'
        );
      },
    });

  // ==========================================================================
  // BULK IMPORT
  // ==========================================================================

  const bulkImportMutation =
    useMutation({
      mutationFn: async (data) => {
        const response =
          await api.post(
            '/medicines/bulk',
            data
          );

        return response.data;
      },

      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: ['medicines'],
        });

        setBulkSuccess(
          `Imported ${
            data?.insertedCount || 0
          } medicines. Skipped ${
            data?.skippedCount || 0
          }.`
        );

        setBulkJson('');
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
    setBatchNumber('');
    setExpiryDate('');
    setManufactureDate('');
    setQuantity('');
    setReorderLevel('10');
    setPrice('');
    setCategory('Antibiotic');
    setBarcode('');
    setLabelImageUrl('');
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

    setBatchNumber(
      medicine?.batchNumber || ''
    );

    setExpiryDate(
      medicine?.expiryDate
        ? new Date(
            medicine.expiryDate
          )
            .toISOString()
            .split('T')[0]
        : ''
    );

    setManufactureDate(
      medicine?.manufactureDate
        ? new Date(
            medicine.manufactureDate
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

    setCategory(
      medicine?.category || 'Other'
    );

    setBarcode(
      medicine?.barcode || ''
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
        Number(
          bill?.total || 0
        ),
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

  const showExpiringThisMonth = () => {
    setSearch('');
    setCategoryFilter('');
    setExpiryStatusFilter('');
    setReorderFilter(false);
    setMedicineViewFilter(
      'EXPIRING_MONTH'
    );
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
      !genericName.trim() ||
      !manufacturer.trim() ||
      !batchNumber.trim() ||
      !expiryDate ||
      !manufactureDate ||
      price === '' ||
      quantity === ''
    ) {
      setError(
        'Please fill all required medicine fields'
      );

      return;
    }

    const medicineData = {
      name: name.trim(),
      genericName:
        genericName.trim(),
      manufacturer:
        manufacturer.trim(),
      batchNumber:
        batchNumber.trim(),
      expiryDate,
      manufactureDate,
      quantity:
        Number(quantity),
      reorderLevel:
        Number(
          reorderLevel || 0
        ),
      price: Number(price),
      category,
      barcode:
        barcode.trim(),
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

        if (data.batchNumber) {
          setBatchNumber(
            data.batchNumber
          );
        }

        if (data.expiryDate) {
          setExpiryDate(
            data.expiryDate
          );
        }

        if (data.manufactureDate) {
          setManufactureDate(
            data.manufactureDate
          );
        }

        if (data.barcode) {
          setBarcode(
            data.barcode
          );
        }

        if (data.labelImageUrl) {
          setLabelImageUrl(
            data.labelImageUrl
          );
        }

        alert(
          `OCR Scan Successful!\n\nName: ${
            data.medicineName ||
            'N/A'
          }\nGeneric: ${
            data.genericName ||
            'N/A'
          }\nManufacturer: ${
            data.manufacturer ||
            'N/A'
          }\nBatch: ${
            data.batchNumber ||
            'N/A'
          }\nExpiry: ${
            data.expiryDate ||
            'N/A'
          }\nConfidence: ${
            data.confidence ??
            'N/A'
          }`
        );
      } catch (err) {
        setError(
          err.response?.data?.message ||
            'OCR scan failed'
        );
      } finally {
        setOcrLoading(false);

        if (fileInputRef.current) {
          fileInputRef.current.value =
            '';
        }
      }
    };

  // ==========================================================================
  // BULK
  // ==========================================================================

  const handleBulkSubmit = (
    event
  ) => {
    event.preventDefault();

    setBulkError('');
    setBulkSuccess('');

    if (!bulkJson.trim()) {
      setBulkError(
        'Please enter JSON data'
      );

      return;
    }

    try {
      const parsed =
        JSON.parse(
          bulkJson
        );

      if (!Array.isArray(parsed)) {
        setBulkError(
          'Please provide a JSON array'
        );

        return;
      }

      bulkImportMutation.mutate(
        parsed
      );
    } catch {
      setBulkError(
        'Invalid JSON format'
      );
    }
  };

  // ==========================================================================
  // DELETE
  // ==========================================================================

  const handleDelete = (id) => {
    const confirmed =
      window.confirm(
        'Delete this medicine?'
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
        item.price || 0
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

              customerPhone:
                selectedCustomerId
                  ? customer?.phone ||
                    ''
                  : guestPhone.trim(),

              paymentMethod,

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
                      item.price,

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

  const currentMonth =
    now.getMonth();

  const currentYear =
    now.getFullYear();

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

  const expiringThisMonth =
    medicines.filter(
      (medicine) => {
        if (!medicine?.expiryDate) {
          return false;
        }

        const expiry =
          new Date(
            medicine.expiryDate
          );

        if (
          Number.isNaN(
            expiry.getTime()
          )
        ) {
          return false;
        }

        return (
          expiry.getMonth() ===
            currentMonth &&
          expiry.getFullYear() ===
            currentYear
        );
      }
    ).length;

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
        ) <=
        Number(
          medicine?.reorderLevel ||
            0
        )
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
            ) <=
            Number(
              medicine?.reorderLevel ||
                0
            )
          );
        }

        if (
          medicineViewFilter ===
          'EXPIRING_MONTH'
        ) {
          if (
            !medicine?.expiryDate
          ) {
            return false;
          }

          const expiry =
            new Date(
              medicine.expiryDate
            );

          if (
            Number.isNaN(
              expiry.getTime()
            )
          ) {
            return false;
          }

          return (
            expiry.getMonth() ===
              currentMonth &&
            expiry.getFullYear() ===
              currentYear
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
        (medicine) =>
          medicine?.expiryDate &&
          Number(
            medicine?.quantity ||
              0
          ) > 0
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
      )
      .slice(0, 100);

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

        const batch =
          safeText(
            medicine?.batchNumber
          ).toLowerCase();

        const matchesSearch =
          !query ||
          medicineName.includes(
            query
          ) ||
          generic.includes(
            query
          ) ||
          batch.includes(
            query
          );

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
      name: 'Customers',
      tab: 'customers',
      icon: Users,
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
    <div className="min-h-screen bg-slate-50 text-slate-900">

      {/* MOBILE OVERLAY */}

      {isSidebarMobileOpen && (
        <div
          onClick={() =>
            setIsSidebarMobileOpen(
              false
            )
          }
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
        />
      )}

      {/* SIDEBAR */}

      <aside
        className={`fixed inset-y-0 left-0 z-30 w-[210px] bg-white border-r border-slate-200 transition-transform ${
          isSidebarMobileOpen
            ? 'translate-x-0'
            : '-translate-x-full'
        } md:translate-x-0`}
      >

        <div className="p-4 border-b flex items-center gap-3">

          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
            Rx
          </div>

          <div>

            <div className="font-bold text-lg text-slate-800">
              Sardar Pharmacy
            </div>

            <div className="text-[10px] text-slate-400">
              Pharmacist Portal
            </div>

          </div>

        </div>

        <nav className="p-3 space-y-1">

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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs ${
                    active
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-500 hover:bg-slate-50'
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

              <div className="text-[10px] text-slate-400">
                Pharmacist
              </div>

            </div>

          </div>

          <button
            onClick={
              logout
            }
            className="p-2 text-slate-400 hover:text-red-600"
          >
            <LogOut className="w-4 h-4" />
          </button>

        </div>

      </aside>

      {/* MAIN */}

      <main className="md:ml-[210px] min-h-screen">

        {/* HEADER */}

        <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between">

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

              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Sardar Pharmacy Operations
              </div>

              <div className="text-sm font-bold capitalize">
                {activeTab.replace(
                  '-',
                  ' '
                )}
              </div>

            </div>

          </div>

          <div className="flex items-center gap-3 text-[10px] text-slate-500">

            <button
              onClick={
                toggle
              }
              className="p-2 bg-slate-100 rounded-lg"
              title="Toggle theme"
            >
              {theme ===
              'dark'
                ? '☀'
                : '◐'}
            </button>

            <span>
              Server:{' '}
              <strong className="text-emerald-600">
                Online
              </strong>
            </span>

            <span className="hidden sm:inline">
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

          {activeTab ===
            'dashboard' && (
            <div className="space-y-5">

              {/* STAT CARDS */}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">

                {/* TOTAL MEDICINES */}

                <button
                  onClick={
                    showAllMedicines
                  }
                  className="text-left bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition"
                >

                  <div className="flex justify-between">

                    <div>

                      <div className="text-[10px] uppercase font-bold text-slate-400">
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
                        Expired Batches
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

                {/* EXPIRING THIS MONTH */}

                <button
                  onClick={
                    showExpiringThisMonth
                  }
                  className="text-left bg-white p-4 rounded-2xl border border-orange-100 shadow-sm hover:shadow-md transition"
                >

                  <div className="flex justify-between">

                    <div>

                      <div className="text-[10px] uppercase font-bold text-orange-500">
                        Expiring This Month
                      </div>

                      <div className="text-2xl font-bold text-orange-600 mt-2">
                        {
                          expiringThisMonth
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
                  className="text-left bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition"
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

                      <div className="text-[9px] text-slate-500 mt-1">
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
                  className="text-left bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition"
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

                      <div className="text-[9px] text-slate-500 mt-1">
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

              </div>

              {/* QUICK ACTIONS */}

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">

                <div className="mb-3">

                  <h3 className="font-bold text-sm">
                    Quick Actions
                  </h3>

                  <p className="text-xs text-slate-400 mt-1">
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

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">

                <div className="flex justify-between mb-5">

                  <div>

                    <h3 className="font-bold text-sm">
                      Sales Revenue History
                    </h3>

                    <p className="text-xs text-slate-400 mt-1">
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

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                <div className="p-5 border-b flex items-center justify-between gap-3">

                  <div>

                    <h3 className="font-bold text-sm">
                      Top 100 Medicines by Earliest Expiry
                    </h3>

                    <p className="text-xs text-slate-400 mt-1">
                      Medicines with available stock sorted by expiry date.
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

                      <tr className="bg-slate-50 text-left text-[10px] uppercase text-slate-400">

                        <th className="p-3">
                          #
                        </th>

                        <th className="p-3">
                          Medicine
                        </th>

                        <th className="p-3">
                          Batch
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
                            colSpan={8}
                            className="p-8 text-center text-xs text-slate-400"
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
                                className="border-t hover:bg-slate-50"
                              >

                                <td className="p-3 text-xs text-slate-400">
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

                                  <div className="text-[10px] text-slate-400">
                                    {
                                      medicine.genericName ||
                                      'N/A'
                                    }
                                  </div>

                                </td>

                                <td className="p-3 text-xs font-mono">
                                  {
                                    medicine.batchNumber ||
                                    'N/A'
                                  }
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

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                <div className="p-5 border-b flex items-center justify-between">

                  <div>

                    <h3 className="font-bold text-sm">
                      Recent Bills
                    </h3>

                    <p className="text-xs text-slate-400 mt-1">
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

                      <tr className="bg-slate-50 text-left text-[10px] uppercase text-slate-400">

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
                            className="p-8 text-center text-xs text-slate-400"
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
                              className="border-t hover:bg-slate-50"
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
                                  bill.customer?.name ||
                                  bill.customerName ||
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
                                  bill.total
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

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-700">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="font-bold text-sm">
                      Customer Orders
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Review online pharmacy orders and accept or reject them.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => refetchOnlineOrders()}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <RefreshCw className="inline w-3.5 h-3.5 mr-1" />
                    Refresh Orders
                  </button>
                </div>
              </div>

              {isOrdersLoading ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm dark:bg-slate-900 dark:border-slate-700">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                  <p className="text-xs text-slate-400 mt-3">
                    Loading customer orders...
                  </p>
                </div>
              ) : onlineOrders.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm dark:bg-slate-900 dark:border-slate-700">
                  <ClipboardList className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold mt-3">
                    No customer orders yet
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
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
                        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 dark:bg-slate-900 dark:border-slate-700"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
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
                                <p className="text-[10px] uppercase font-bold text-slate-400">Customer</p>
                                <p className="text-xs font-bold mt-1 text-slate-900 dark:text-white">
                                  {order?.customerId?.name || 'Customer'}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-1 dark:text-slate-400">
                                  {order?.customerId?.email || 'No email'}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-1 dark:text-slate-400">
                                  {order?.customerPhone || order?.customerId?.phone || 'No phone'}
                                </p>
                              </div>

                              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                                <p className="text-[10px] uppercase font-bold text-slate-400">Delivery Address</p>
                                <p className="text-xs font-semibold mt-1 leading-5 text-slate-700 dark:text-slate-200">
                                  {order?.shippingAddress || 'No delivery address provided'}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                              <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">Medicines</p>
                              <div className="space-y-2">
                                {Array.isArray(order?.items) && order.items.map((item, index) => (
                                  <div
                                    key={`${order._id}-${item?.medicineId || index}`}
                                    className="flex items-center justify-between gap-3 text-xs"
                                  >
                                    <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">
                                      {item?.name || 'Medicine'} × {item?.quantity || 0}
                                    </span>
                                    <span className="shrink-0 font-bold text-slate-900 dark:text-white">
                                      {getCurrency((Number(item?.unitPrice) || 0) * (Number(item?.quantity) || 0))}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400">
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

              <div className="bg-white p-4 rounded-2xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">

                <div>

                  <h2 className="font-bold text-sm">
                    Medicine Inventory
                  </h2>

                  <p className="text-xs text-slate-400 mt-1">
                    Manage medicines, batches, stock and expiry.
                  </p>

                </div>

                <div className="flex flex-wrap gap-2">

                  <button
                    onClick={() => {
                      setMedicineViewFilter(
                        'ALL'
                      );

                      refetchMeds();
                    }}
                    className="p-2 bg-slate-100 rounded-lg"
                    title="Refresh"
                  >
                    <RefreshCw className="w-4 h-4" />
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
                    className="px-3 py-2 bg-slate-100 rounded-lg text-xs font-bold"
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
                    className="px-3 py-2 bg-red-50 text-red-700 rounded-lg text-xs font-bold"
                  >
                    Expired
                  </button>

                  <button
                    onClick={
                      showLowStockMedicines
                    }
                    className="px-3 py-2 bg-orange-50 text-orange-700 rounded-lg text-xs font-bold"
                  >
                    Low Stock
                  </button>

                  <button
                    onClick={() =>
                      setBulkModalOpen(
                        true
                      )
                    }
                    className="px-3 py-2 bg-slate-100 rounded-lg text-xs font-bold flex items-center gap-1"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Bulk
                  </button>

                  <button
                    onClick={
                      openAddModal
                    }
                    className="px-3 py-2 bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Medicine
                  </button>

                </div>

              </div>

              {medicineViewFilter !==
                'ALL' && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center justify-between">

                  <div className="text-xs text-blue-700 font-semibold">

                    {medicineViewFilter ===
                      'LOW_STOCK' &&
                      'Showing low-stock medicines.'}

                    {medicineViewFilter ===
                      'EXPIRING_MONTH' &&
                      'Showing medicines expiring this month.'}

                  </div>

                  <button
                    onClick={() =>
                      setMedicineViewFilter(
                        'ALL'
                      )
                    }
                    className="text-[10px] bg-white border border-blue-200 px-2 py-1 rounded-lg text-blue-700 font-bold"
                  >
                    Clear View
                  </button>

                </div>
              )}

              <div className="bg-white p-3 rounded-2xl border shadow-sm grid grid-cols-1 md:grid-cols-4 gap-3">

                <div className="relative">

                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />

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
                    placeholder="Search medicine..."
                    className="w-full pl-9 pr-3 py-2 border rounded-lg text-xs"
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

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                <div className="p-4 border-b flex items-center justify-between">

                  <div>

                    <div className="text-xs text-slate-400">
                      Showing
                    </div>

                    <div className="text-sm font-bold">
                      {
                        displayedMedicines.length
                      }{' '}
                      medicine(s)
                    </div>

                  </div>

                  <div className="text-[10px] text-slate-400">
                    View Details shows complete information.
                  </div>

                </div>

                <div className="overflow-x-auto">

                  <table className="w-full">

                    <thead>

                      <tr className="bg-slate-50 text-[10px] uppercase text-slate-400">

                        <th className="p-3 text-left">
                          Medicine
                        </th>

                        <th className="p-3 text-left">
                          Batch
                        </th>

                        <th className="p-3 text-left">
                          Price
                        </th>

                        <th className="p-3 text-left">
                          Stock
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
                            className="p-8 text-center text-xs text-slate-400"
                          >
                            Loading medicines...
                          </td>

                        </tr>

                      ) : displayedMedicines.length ===
                        0 ? (

                        <tr>

                          <td
                            colSpan={7}
                            className="p-8 text-center text-xs text-slate-400"
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
                              className="border-t hover:bg-slate-50"
                            >

                              <td className="p-3">

                                <div className="font-bold text-xs">
                                  {
                                    medicine.name ||
                                    'N/A'
                                  }
                                </div>

                                <div className="text-[10px] text-slate-400">
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

                              <td className="p-3 text-xs font-mono">
                                {
                                  medicine.batchNumber ||
                                  'N/A'
                                }
                              </td>

                              <td className="p-3 text-xs font-bold">
                                {getCurrency(
                                  medicine.price
                                )}
                              </td>

                              <td className="p-3 text-xs">

                                <span
                                  className={
                                    Number(
                                      medicine.quantity ||
                                        0
                                    ) <=
                                    Number(
                                      medicine.reorderLevel ||
                                        0
                                    )
                                      ? 'text-red-600 font-bold'
                                      : ''
                                  }
                                >
                                  {
                                    medicine.quantity ??
                                    0
                                  }{' '}
                                  units
                                </span>

                              </td>

                              <td className="p-3 text-xs">

                                {formatDate(
                                  medicine.expiryDate
                                )}

                                <div className="text-[10px] text-slate-400">
                                  MFG:{' '}
                                  {formatDate(
                                    medicine.manufactureDate
                                  )}
                                </div>

                              </td>

                              <td className="p-3">

                                <ExpiryBadge
                                  status={
                                    medicine.expiryStatus
                                  }
                                />

                              </td>

                              <td className="p-3">

                                <div className="flex justify-end gap-1">

                                  <button
                                    onClick={() =>
                                      openMedicineDetails(
                                        medicine
                                      )
                                    }
                                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-700"
                                    title="View Details"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
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

                                  <button
                                    onClick={() =>
                                      handleDelete(
                                        medicine._id
                                      )
                                    }
                                    className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>

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

                <div className="p-4 border-b">

                  <h3 className="font-bold text-sm">
                    Medicine Catalog
                  </h3>

                  <p className="text-xs text-slate-400 mt-1">
                    Select medicine for the bill.
                  </p>

                </div>

                <div className="p-3 border-b flex gap-2">

                  <div className="relative flex-1">

                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />

                    <input
                      value={
                        billSearch
                      }
                      onChange={(event) =>
                        setBillSearch(
                          event.target.value
                        )
                      }
                      placeholder="Search..."
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

                            <div className="text-[10px] text-slate-400 mt-1">
                              Stock:{' '}
                              {
                                medicine.quantity ??
                                0
                              }{' '}
                              {getDot()}{' '}
                              {
                                medicine.batchNumber ||
                                'N/A'
                              }
                            </div>

                          </div>

                          <div className="flex items-center gap-2">

                            <span className="text-xs font-bold">
                              {getCurrency(
                                medicine.price
                              )}
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
                    <div className="p-8 text-center text-xs text-slate-400">
                      No medicines found.
                    </div>
                  )}

                </div>

              </div>

              <div className="bg-white rounded-2xl border shadow-sm flex flex-col overflow-hidden">

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
                    onChange={(event) =>
                      setSelectedCustomerId(
                        event.target.value
                      )
                    }
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

                  {!selectedCustomerId && (
                    <input
                      value={
                        guestPhone
                      }
                      onChange={(event) =>
                        setGuestPhone(
                          event.target.value
                        )
                      }
                      placeholder="Guest phone"
                      className="w-full border rounded-lg px-3 py-2 text-xs"
                    />
                  )}

                </div>

                <div className="flex-1 overflow-y-auto">

                  {billItems.length ===
                  0 ? (

                    <div className="h-full flex items-center justify-center">

                      <div className="text-center">

                        <FileText className="w-10 h-10 text-slate-200 mx-auto" />

                        <p className="text-xs text-slate-400 mt-2">
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

                            <div className="text-[10px] text-slate-400">
                              {
                                item.billQuantity
                              }{' '}
                              ×{' '}
                              {getCurrency(
                                item.price
                              )}
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

                    <select
                      value={
                        paymentMethod
                      }
                      onChange={(event) =>
                        setPaymentMethod(
                          event.target.value
                        )
                      }
                      className="border rounded-lg px-3 py-2 text-xs"
                    >

                      <option value="Card">
                        Card
                      </option>

                      <option value="Cash">
                        Cash
                      </option>

                      <option value="UPI">
                        UPI
                      </option>

                    </select>

                  </div>

                  {billError && (
                    <div className="p-2 bg-red-50 text-red-700 rounded-lg text-xs">
                      {
                        billError
                      }
                    </div>
                  )}

                  <div className="flex justify-between">

                    <span className="text-xs text-slate-500">
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

                  <button
                    onClick={
                      handleConfirmBill
                    }
                    disabled={
                      isBillingPending ||
                      billItems.length ===
                        0
                    }
                    className="w-full py-2.5 bg-blue-700 text-white rounded-xl text-xs font-bold disabled:opacity-40"
                  >
                    {isBillingPending
                      ? 'Processing...'
                      : 'Commit & Post Bill'}
                  </button>

                </div>

              </div>

            </div>
          )}

          {/* ================================================================= */}
          {/* CUSTOMERS */}
          {/* ================================================================= */}

          {activeTab ===
            'customers' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

              <div className="p-5 border-b">

                <h3 className="font-bold text-sm">
                  Customer Records
                </h3>

                <p className="text-xs text-slate-400 mt-1">
                  Select a customer to start a bill.
                </p>

              </div>

              <div className="overflow-x-auto">

                <table className="w-full">

                  <thead>

                    <tr className="bg-slate-50 text-[10px] uppercase text-slate-400">

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
                          className="p-8 text-center text-xs text-slate-400"
                        >
                          Loading customers...
                        </td>

                      </tr>

                    ) : customers.length ===
                      0 ? (

                      <tr>

                        <td
                          colSpan={4}
                          className="p-8 text-center text-xs text-slate-400"
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

                        <p className="text-[10px] text-slate-400 mt-1">
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
          {/* SETTINGS */}
          {/* ================================================================= */}

          {activeTab ===
            'settings' && (
            <div className="max-w-xl mx-auto space-y-4">

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">

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

                  <span className="text-[9px] uppercase text-slate-400 font-bold">
                    Email
                  </span>

                  <p className="font-semibold mt-1">
                    {
                      currentUser?.email
                    }
                  </p>

                </div>

              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">

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

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">

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
                      className="absolute right-3 top-2.5 text-slate-400"
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
                      className="absolute right-3 top-2.5 text-slate-400"
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
      {/* MEDICINE CREATE / EDIT MODAL */}
      {/* ===================================================================== */}

      {medModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">

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
                className="text-slate-400"
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

                <p className="text-[10px] text-slate-500 mt-1 mb-3">
                  Upload a medicine label to extract available information.
                </p>

                <input
                  ref={
                    fileInputRef
                  }
                  type="file"
                  accept="image/*"
                  disabled={
                    ocrLoading
                  }
                  onChange={
                    handleOcrFileChange
                  }
                  className="text-xs"
                />

              </div>
            )}

            <form
              onSubmit={
                handleMedSubmit
              }
              className="space-y-3"
            >

              <div className="grid grid-cols-2 gap-3">

                <input
                  required
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value
                    )
                  }
                  placeholder="Medicine Name"
                  className="border rounded-lg px-3 py-2 text-xs"
                />

                <input
                  required
                  value={
                    genericName
                  }
                  onChange={(event) =>
                    setGenericName(
                      event.target.value
                    )
                  }
                  placeholder="Generic Name"
                  className="border rounded-lg px-3 py-2 text-xs"
                />

              </div>

              <div className="grid grid-cols-2 gap-3">

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
                  className="border rounded-lg px-3 py-2 text-xs"
                />

                <input
                  required
                  value={
                    batchNumber
                  }
                  onChange={(event) =>
                    setBatchNumber(
                      event.target.value
                    )
                  }
                  placeholder="Batch Number"
                  className="border rounded-lg px-3 py-2 text-xs"
                />

              </div>

              <div className="grid grid-cols-2 gap-3">

                <input
                  required
                  type="date"
                  value={
                    manufactureDate
                  }
                  onChange={(event) =>
                    setManufactureDate(
                      event.target.value
                    )
                  }
                  className="border rounded-lg px-3 py-2 text-xs"
                />

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
                  className="border rounded-lg px-3 py-2 text-xs"
                />

              </div>

              <div className="grid grid-cols-3 gap-3">

                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    price
                  }
                  onChange={(event) =>
                    setPrice(
                      event.target.value
                    )
                  }
                  placeholder="Price (PKR)"
                  className="border rounded-lg px-3 py-2 text-xs"
                />

                <input
                  required
                  type="number"
                  min="0"
                  value={
                    quantity
                  }
                  onChange={(event) =>
                    setQuantity(
                      event.target.value
                    )
                  }
                  placeholder="Quantity"
                  className="border rounded-lg px-3 py-2 text-xs"
                />

                <input
                  required
                  type="number"
                  min="0"
                  value={
                    reorderLevel
                  }
                  onChange={(event) =>
                    setReorderLevel(
                      event.target.value
                    )
                  }
                  placeholder="Min Level"
                  className="border rounded-lg px-3 py-2 text-xs"
                />

              </div>

              <div className="grid grid-cols-2 gap-3">

                <select
                  value={
                    category
                  }
                  onChange={(event) =>
                    setCategory(
                      event.target.value
                    )
                  }
                  className="border rounded-lg px-3 py-2 text-xs"
                >

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

                <input
                  value={
                    barcode
                  }
                  onChange={(event) =>
                    setBarcode(
                      event.target.value
                    )
                  }
                  placeholder="Barcode"
                  className="border rounded-lg px-3 py-2 text-xs"
                />

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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">

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

            <form
              onSubmit={
                handleBulkSubmit
              }
              className="space-y-3"
            >

              <textarea
                rows={10}
                value={
                  bulkJson
                }
                onChange={(event) =>
                  setBulkJson(
                    event.target.value
                  )
                }
                placeholder={`[
  {
    "name": "Panadol 500mg",
    "genericName": "Paracetamol",
    "manufacturer": "GSK",
    "batchNumber": "PAN-001",
    "manufactureDate": "2026-01-01",
    "expiryDate": "2028-01-01",
    "price": 450,
    "quantity": 500,
    "reorderLevel": 50,
    "category": "Analgesic"
  }
]`}
                className="w-full border rounded-lg p-3 font-mono text-xs"
              />

              <button
                type="submit"
                disabled={
                  bulkImportMutation.isPending
                }
                className="w-full py-2 bg-blue-700 text-white rounded-lg text-xs font-bold"
              >
                {
                  bulkImportMutation.isPending
                    ? 'Processing...'
                    : 'Run Import'
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
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">

          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl max-h-[90vh] overflow-hidden">

            <div className="p-5 border-b flex items-center justify-between">

              <div>

                <div className="flex items-center gap-2">

                  <Package className="w-5 h-5 text-blue-600" />

                  <h3 className="font-bold text-base">
                    Medicine Details
                  </h3>

                </div>

                <p className="text-xs text-slate-400 mt-1">
                  Complete medicine and batch information
                </p>

              </div>

              <button
                onClick={
                  closeMedicineDetails
                }
                className="text-slate-400 hover:text-slate-700"
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

                  <p className="text-xs text-slate-400 mt-1">
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
                  <div className="flex items-center gap-2 text-[10px] uppercase text-slate-400 font-bold">
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
                  <div className="flex items-center gap-2 text-[10px] uppercase text-slate-400 font-bold">
                    <Hash className="w-3.5 h-3.5" />
                    Batch Number
                  </div>
                  <div className="text-xs font-semibold mt-2 font-mono">
                    {
                      selectedMedicine.batchNumber ||
                      'N/A'
                    }
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-2 text-[10px] uppercase text-slate-400 font-bold">
                    <Calendar className="w-3.5 h-3.5" />
                    Manufacture Date
                  </div>
                  <div className="text-xs font-semibold mt-2">
                    {formatDate(
                      selectedMedicine.manufactureDate
                    )}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-2 text-[10px] uppercase text-slate-400 font-bold">
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
                  <div className="flex items-center gap-2 text-[10px] uppercase text-slate-400 font-bold">
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
                  <div className="flex items-center gap-2 text-[10px] uppercase text-slate-400 font-bold">
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
                  <div className="flex items-center gap-2 text-[10px] uppercase text-slate-400 font-bold">
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
                  <div className="flex items-center gap-2 text-[10px] uppercase text-slate-400 font-bold">
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

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">

                <div className="p-3 border rounded-xl">

                  <div className="flex items-center gap-2 text-[10px] uppercase text-slate-400 font-bold">
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

                  <div className="flex items-center gap-2 text-[10px] uppercase text-slate-400 font-bold">
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

                    <span className="text-slate-400">
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

                    <span className="text-slate-400">
                      Created At
                    </span>

                    <div className="font-semibold mt-1">
                      {formatDateTime(
                        selectedMedicine.createdAt
                      )}
                    </div>

                  </div>

                  <div>

                    <span className="text-slate-400">
                      Updated At
                    </span>

                    <div className="font-semibold mt-1">
                      {formatDateTime(
                        selectedMedicine.updatedAt
                      )}
                    </div>

                  </div>

                  <div>

                    <span className="text-slate-400">
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

                <button
                  onClick={() => {
                    handleDelete(
                      selectedMedicine._id
                    );
                    closeMedicineDetails();
                  }}
                  className="px-4 py-2 bg-red-50 text-red-700 rounded-lg text-xs font-bold flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>

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
        <div className="fixed inset-0 z-[65] bg-black/50 flex items-center justify-center p-4">

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

                    {salesDetailsType ===
                    'daily'
                      ? "Today's Sales Details"
                      : 'Monthly Sales Details'}

                  </h3>

                </div>

                <p className="text-xs text-slate-400 mt-1">

                  {salesDetailsType ===
                  'daily'
                    ? "Complete sales information for today's transactions."
                    : 'Complete sales information for the current month.'}

                </p>

              </div>

              <button
                onClick={
                  closeSalesDetails
                }
                className="text-slate-400 hover:text-slate-700"
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

                  <p className="text-[10px] text-slate-400 mt-1">
                    {
                      selectedSalesBillCount
                    }{' '}
                    transaction(s) found
                  </p>

                </div>

                <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-lg text-slate-500 font-bold">

                  {salesDetailsType ===
                  'daily'
                    ? 'TODAY'
                    : 'THIS MONTH'}

                </span>

              </div>

              {selectedSalesBills.length ===
              0 ? (

                <div className="border rounded-xl p-10 text-center">

                  <Receipt className="w-10 h-10 text-slate-200 mx-auto" />

                  <p className="text-xs text-slate-400 mt-3">
                    No sales found for this period.
                  </p>

                </div>

              ) : (

                <div className="overflow-x-auto border rounded-xl">

                  <table className="w-full">

                    <thead>

                      <tr className="bg-slate-50 text-[10px] uppercase text-slate-400">

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
                              bill?.items
                            )
                              ? bill.items.reduce(
                                  (
                                    sum,
                                    item
                                  ) =>
                                    sum +
                                    Number(
                                      item?.quantity ||
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
                              className="border-t hover:bg-slate-50"
                            >

                              <td className="p-3 text-xs text-slate-400">
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
                                  bill?.customer?.name ||
                                  bill?.customerName ||
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
                                  bill?.total
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
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">

          <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl max-h-[90vh] overflow-hidden">

            <div className="p-5 border-b flex items-center justify-between">

              <div>

                <h3 className="font-bold text-base">
                  Bill Details
                </h3>

                <p className="text-xs text-slate-400 mt-1">
                  Complete transaction information
                </p>

              </div>

              <button
                onClick={
                  closeBillDetails
                }
                className="text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>

            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(90vh-80px)]">

              <div className="grid grid-cols-2 gap-3">

                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="text-[10px] uppercase text-slate-400 font-bold">
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
                  <div className="text-[10px] uppercase text-slate-400 font-bold">
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
                  <div className="text-[10px] uppercase text-slate-400 font-bold">
                    Customer
                  </div>

                  <div className="text-xs font-bold mt-2">
                    {
                      selectedBill.customer?.name ||
                      selectedBill.customerName ||
                      'Walk-in Guest'
                    }
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="text-[10px] uppercase text-slate-400 font-bold">
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
                  <div className="text-[10px] uppercase text-slate-400 font-bold">
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
                    Total
                  </div>

                  <div className="text-sm font-bold text-blue-700 mt-2">
                    {getCurrency(
                      selectedBill.total
                    )}
                  </div>
                </div>

              </div>

              <div className="mt-5 border rounded-xl overflow-hidden">

                <div className="p-3 bg-slate-50 border-b">

                  <h4 className="text-xs font-bold">
                    Bill Items
                  </h4>

                </div>

                {Array.isArray(
                  selectedBill.items
                ) &&
                selectedBill.items.length >
                  0 ? (

                  selectedBill.items.map(
                    (
                      item,
                      index
                    ) => (

                      <div
                        key={
                          item._id ||
                          `${item.medicineId}-${index}`
                        }
                        className="p-3 border-b last:border-0 flex items-center justify-between gap-3"
                      >

                        <div>

                          <div className="text-xs font-bold">
                            {
                              item.name ||
                              'Medicine'
                            }
                          </div>

                          <div className="text-[10px] text-slate-400 mt-1">
                            Qty:{' '}
                            {
                              item.quantity ??
                              0
                            }{' '}
                            ×{' '}
                            {getCurrency(
                              item.unitPrice
                            )}
                          </div>

                        </div>

                        <div className="text-xs font-bold">

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

                        </div>

                      </div>

                    )
                  )

                ) : (

                  <div className="p-5 text-center text-xs text-slate-400">
                    No bill items available.
                  </div>

                )}

              </div>

              <div className="mt-4 text-xs text-slate-400">

                Created:{' '}
                <span className="font-semibold text-slate-700">
                  {formatDateTime(
                    selectedBill.createdAt
                  )}
                </span>

              </div>

              <div className="flex justify-end gap-2 mt-5">

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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">

          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6">

            <div className="text-center">

              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />

              <h3 className="text-xl font-bold mt-2">
                Payment Done!
              </h3>

              <p className="text-xs text-slate-400 mt-1">
                Bill{' '}
                {
                  confirmedBill.billNumber ||
                  confirmedBill._id
                }{' '}
                created successfully.
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

    </div>
  );
};

export default PharmacistDashboard;