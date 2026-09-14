import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

import {
  FileText,
  Download,
  X,
  Eye,
  Receipt,
  ShoppingBag,
  Wallet,
  CalendarDays,
  Package,
  Store,
  Globe,
} from 'lucide-react';

// ============================================================================
// HELPERS
// ============================================================================

const getCurrency = (amount = 0) => {
  return `PKR ${Number(amount || 0).toFixed(2)}`;
};

const formatDate = (date) => {
  if (!date) {
    return '—';
  }

  return new Date(date).toLocaleDateString(
    undefined,
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }
  );
};

const formatDateTime = (date) => {
  if (!date) {
    return '—';
  }

  return new Date(date).toLocaleString(
    undefined,
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }
  );
};

// ============================================================================
// BILL TYPE BADGE
// ============================================================================

const BillTypeBadge = ({ type }) => {
  const isInStore = type === 'INSTORE';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
        isInStore
          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
      }`}
    >
      {isInStore ? (
        <Store className="w-3 h-3" />
      ) : (
        <Globe className="w-3 h-3" />
      )}

      {isInStore ? 'In-Store' : 'Online'}
    </span>
  );
};

// ============================================================================
// PAGE
// ============================================================================

const CustomerBills = () => {
  const { user } = useAuth();
  const { id: routeBillId } = useParams();
  const navigate = useNavigate();

  const [downloadingId, setDownloadingId] =
    useState(null);

  // ==========================================================================
  // FETCH CUSTOMER BILLS
  // ==========================================================================

  const {
    data: bills = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['bills', user?._id],

    queryFn: async () => {
      if (!user?._id) {
        return [];
      }

      const { data } = await api.get(
        `/bills/customer/${user._id}`
      );

      return Array.isArray(data)
        ? data
        : [];
    },

    enabled: Boolean(user?._id),
  });

  // ==========================================================================
  // SELECTED BILL
  // ==========================================================================

  const selectedBill = routeBillId
    ? bills.find(
        (bill) =>
          bill._id === routeBillId
      )
    : null;

  const modalOpen =
    Boolean(routeBillId) &&
    Boolean(selectedBill);

  // ==========================================================================
  // SUMMARY
  // ==========================================================================

  const totalInvoices = bills.length;

  const totalItems = bills.reduce(
    (sum, bill) =>
      sum +
      (Array.isArray(bill.items)
        ? bill.items.reduce(
            (itemSum, item) =>
              itemSum +
              Number(item.quantity || 0),
            0
          )
        : 0),
    0
  );

  const totalSpent = bills.reduce(
    (sum, bill) =>
      sum +
      Number(bill.total || 0),
    0
  );

  // ==========================================================================
  // ACTIONS
  // ==========================================================================

  const handleOpenDetails = (bill) => {
    navigate(
      `/customer/bills/${bill._id}`
    );
  };

  const handleCloseModal = () => {
    navigate('/customer/bills');
  };

  const handleDownloadPDF = async (
    billId,
    billNumber
  ) => {
    setDownloadingId(billId);

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

      const url =
        window.URL.createObjectURL(blob);

      const link =
        document.createElement('a');

      link.href = url;

      link.download =
        `invoice-${billNumber || billId}.pdf`;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      console.error(
        'PDF download error:',
        downloadError
      );

      alert(
        'Failed to download invoice PDF. Please try again.'
      );
    } finally {
      setDownloadingId(null);
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ================================================================= */}
        {/* HEADER */}
        {/* ================================================================= */}

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">

          <div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wider mb-3">

              <Receipt className="w-3.5 h-3.5" />

              Purchase History

            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Order History
            </h1>

            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              View your previous medicine
              purchases and available receipts.
            </p>

          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#1a2438] border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">

            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">

              <ShoppingBag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />

            </div>

            <div>

              <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                Account
              </p>

              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {user?.name || 'Customer'}
              </p>

            </div>

          </div>

        </div>

        {/* ================================================================= */}
        {/* SUMMARY */}
        {/* ================================================================= */}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

          {/* TOTAL ORDERS */}

          <div className="relative overflow-hidden bg-white dark:bg-[#1a2438] rounded-2xl border border-slate-200 dark:border-slate-700/60 p-4 shadow-sm">

            <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-900/20" />

            <div className="relative flex items-start justify-between">

              <div>

                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
                  Total Orders
                </p>

                <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
                  {isLoading
                    ? '...'
                    : totalInvoices}
                </p>

                <p className="text-[10px] text-slate-400 mt-1">
                  Completed purchases
                </p>

              </div>

              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">

                <Receipt className="w-5 h-5 text-blue-600 dark:text-blue-400" />

              </div>

            </div>

          </div>

          {/* TOTAL ITEMS */}

          <div className="relative overflow-hidden bg-white dark:bg-[#1a2438] rounded-2xl border border-slate-200 dark:border-slate-700/60 p-4 shadow-sm">

            <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-violet-50 dark:bg-violet-900/20" />

            <div className="relative flex items-start justify-between">

              <div>

                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
                  Total Items
                </p>

                <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
                  {isLoading
                    ? '...'
                    : totalItems}
                </p>

                <p className="text-[10px] text-slate-400 mt-1">
                  Medicine units ordered
                </p>

              </div>

              <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">

                <Package className="w-5 h-5 text-violet-600 dark:text-violet-400" />

              </div>

            </div>

          </div>

          {/* TOTAL VALUE */}

          <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 shadow-md text-white">

            <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-white/10" />

            <div className="relative flex items-start justify-between">

              <div>

                <p className="text-[10px] uppercase tracking-wider font-bold text-blue-100">
                  Order Value
                </p>

                <p className="text-2xl font-extrabold mt-2">
                  {isLoading
                    ? '...'
                    : getCurrency(
                        totalSpent
                      )}
                </p>

                <p className="text-[10px] text-blue-100 mt-1">
                  Total value of orders
                </p>

              </div>

              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">

                <Wallet className="w-5 h-5" />

              </div>

            </div>

          </div>

        </div>

        {/* ================================================================= */}
        {/* ORDERS TABLE */}
        {/* ================================================================= */}

        <div className="bg-white dark:bg-[#1a2438] rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm overflow-hidden">

          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">

            <div>

              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Your Orders
              </h2>

              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                View order details and receipts.
              </p>

            </div>

            <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">

              <CalendarDays className="w-3.5 h-3.5" />

              {totalInvoices}{' '}

              {totalInvoices === 1
                ? 'order'
                : 'orders'}

            </div>

          </div>

          {/* LOADING */}

          {isLoading && (
            <div className="py-20 flex flex-col items-center justify-center">

              <div className="w-9 h-9 border-4 border-slate-200 dark:border-slate-700 border-t-blue-600 rounded-full animate-spin" />

              <p className="text-xs text-slate-400 mt-4">
                Loading your orders...
              </p>

            </div>
          )}

          {/* ERROR */}

          {!isLoading &&
            isError && (
              <div className="py-20 text-center">

                <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto">

                  <X className="w-5 h-5 text-red-500" />

                </div>

                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-3">
                  Unable to load orders
                </h3>

                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                  {error?.message ||
                    'Please try again later.'}
                </p>

              </div>
            )}

          {/* EMPTY */}

          {!isLoading &&
            !isError &&
            bills.length === 0 && (
              <div className="py-20 text-center">

                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto">

                  <FileText className="w-7 h-7 text-slate-400 dark:text-slate-500" />

                </div>

                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-4">
                  No orders yet
                </h3>

                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
                  Your medicine orders will appear
                  here after you place an order.
                </p>

              </div>
            )}

          {/* TABLE */}

          {!isLoading &&
            !isError &&
            bills.length > 0 && (
              <div className="overflow-x-auto">

                <table className="w-full text-left border-collapse text-xs">

                  <thead>

                    <tr className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-700/60 text-slate-400 dark:text-slate-500 text-[9px] font-bold uppercase tracking-wider">

                      <th className="py-3 px-4">
                        Order
                      </th>

                      <th className="py-3 px-4">
                        Date
                      </th>

                      <th className="py-3 px-4">
                        Items
                      </th>

                      <th className="py-3 px-4">
                        Total
                      </th>

                      <th className="py-3 px-4">
                        Type
                      </th>

                      <th className="py-3 px-4 text-right">
                        Actions
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">

                    {bills.map(
                      (bill) => {

                        const itemCount =
                          Array.isArray(
                            bill.items
                          )
                            ? bill.items.reduce(
                                (
                                  sum,
                                  item
                                ) =>
                                  sum +
                                  Number(
                                    item.quantity ||
                                      0
                                  ),
                                0
                              )
                            : 0;

                        return (
                          <tr
                            key={
                              bill._id
                            }
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                          >

                            <td className="py-3 px-4">

                              <div className="inline-flex items-center gap-2">

                                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">

                                  <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />

                                </div>

                                <div>

                                  <span className="font-mono text-blue-700 dark:text-sky-400 font-bold">
                                    {bill.billNumber ||
                                      'N/A'}
                                  </span>

                                  <p className="text-[9px] text-slate-400 mt-0.5">
                                    Order
                                  </p>

                                </div>

                              </div>

                            </td>

                            <td className="py-3 px-4">

                              <div className="text-slate-700 dark:text-slate-300 font-medium">
                                {formatDate(
                                  bill.createdAt
                                )}
                              </div>

                              <div className="text-[9px] text-slate-400 mt-0.5">
                                {formatDateTime(
                                  bill.createdAt
                                )
                                  .split(
                                    ','
                                  )
                                  .slice(
                                    1
                                  )
                                  .join(
                                    ','
                                  )
                                  .trim()}
                              </div>

                            </td>

                            <td className="py-3 px-4">

                              <div className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-semibold">

                                <ShoppingBag className="w-3.5 h-3.5 text-violet-500" />

                                {itemCount}{' '}
                                units

                              </div>

                            </td>

                            <td className="py-3 px-4">

                              <div className="font-bold text-slate-900 dark:text-white">
                                {getCurrency(
                                  bill.total
                                )}
                              </div>

                            </td>

                            <td className="py-3 px-4">

                              <BillTypeBadge
                                type={
                                  bill.billType
                                }
                              />

                            </td>

                            <td className="py-3 px-4">

                              <div className="flex justify-end gap-1.5">

                                <button
                                  onClick={() =>
                                    handleOpenDetails(
                                      bill
                                    )
                                  }
                                  className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                                  title="View order details"
                                >

                                  <Eye className="w-4 h-4" />

                                </button>

                                <button
                                  onClick={() =>
                                    handleDownloadPDF(
                                      bill._id,
                                      bill.billNumber
                                    )
                                  }
                                  disabled={
                                    downloadingId ===
                                    bill._id
                                  }
                                  className="p-2 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-all disabled:opacity-50"
                                  title="Download receipt"
                                >

                                  {downloadingId ===
                                  bill._id ? (
                                    <span className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin block" />
                                  ) : (
                                    <Download className="w-4 h-4" />
                                  )}

                                </button>

                              </div>

                            </td>

                          </tr>
                        );
                      }
                    )}

                  </tbody>

                </table>

              </div>
            )}

        </div>

      </div>

      {/* ================================================================= */}
      {/* ORDER DETAILS MODAL */}
      {/* ================================================================= */}

      {modalOpen &&
        selectedBill && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
            onClick={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                handleCloseModal();
              }
            }}
          >

            <div className="bg-white dark:bg-[#1a2438] w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-2xl relative overflow-hidden max-h-[92vh] overflow-y-auto">

              {/* MODAL HEADER */}

              <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#1a2438]/95 backdrop-blur border-b border-slate-100 dark:border-slate-700/60 px-5 py-4">

                <div className="flex items-center justify-between">

                  <div className="flex items-center gap-3">

                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">

                      <Receipt className="w-5 h-5 text-blue-600 dark:text-sky-400" />

                    </div>

                    <div>

                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Order Details
                      </h3>

                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {selectedBill.billNumber ||
                          'Order'}
                      </p>

                    </div>

                  </div>

                  <button
                    onClick={
                      handleCloseModal
                    }
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Close"
                  >

                    <X className="w-4 h-4" />

                  </button>

                </div>

              </div>

              {/* MODAL CONTENT */}

              <div className="p-5">

                {/* ORDER META */}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-700/60">

                    <p className="text-[9px] uppercase tracking-wider font-bold text-slate-400">
                      Order Code
                    </p>

                    <p className="font-mono font-bold text-blue-700 dark:text-sky-400 mt-1">
                      {selectedBill.billNumber ||
                        'N/A'}
                    </p>

                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-700/60">

                    <p className="text-[9px] uppercase tracking-wider font-bold text-slate-400">
                      Order Date
                    </p>

                    <p className="font-semibold text-slate-700 dark:text-slate-300 mt-1">
                      {formatDateTime(
                        selectedBill.createdAt
                      )}
                    </p>

                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-700/60">

                    <p className="text-[9px] uppercase tracking-wider font-bold text-slate-400">
                      Order Type
                    </p>

                    <div className="mt-1">

                      <BillTypeBadge
                        type={
                          selectedBill.billType
                        }
                      />

                    </div>

                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-700/60">

                    <p className="text-[9px] uppercase tracking-wider font-bold text-slate-400">
                      Pharmacist
                    </p>

                    <p className="font-semibold text-slate-700 dark:text-slate-300 truncate mt-1">
                      {selectedBill
                        .pharmacistId
                        ?.name ||
                        'Sardar Medical Store'}
                    </p>

                  </div>

                </div>

                {/* ITEMS */}

                <div className="mb-4">

                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Ordered Medicines
                  </h4>

                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Complete order details
                  </p>

                </div>

                <div className="border border-slate-100 dark:border-slate-700/60 rounded-xl overflow-hidden mb-5">

                  <div className="overflow-x-auto">

                    <table className="w-full text-left text-xs">

                      <thead>

                        <tr className="bg-slate-50 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 text-[9px] font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-700/60">

                          <th className="py-2.5 px-3">
                            Medicine
                          </th>

                          <th className="py-2.5 px-3 text-right">
                            Unit Price
                          </th>

                          <th className="py-2.5 px-3 text-right">
                            Quantity
                          </th>

                          <th className="py-2.5 px-3 text-right">
                            Total
                          </th>

                        </tr>

                      </thead>

                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">

                        {Array.isArray(
                          selectedBill.items
                        ) &&
                          selectedBill.items.map(
                            (
                              item,
                              index
                            ) => {

                              const unitPrice =
                                Number(
                                  item.unitPrice ||
                                    0
                                );

                              const quantity =
                                Number(
                                  item.quantity ||
                                    0
                                );

                              const itemTotal =
                                unitPrice *
                                quantity;

                              return (
                                <tr
                                  key={`${item.name || 'item'}-${index}`}
                                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
                                >

                                  <td className="py-3 px-3">

                                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                                      {
                                        item.name ||
                                        'Medicine'
                                      }
                                    </div>

                                    {item.expiryStatus && (
                                      <span className="inline-flex mt-1 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                        {
                                          item.expiryStatus
                                        }
                                      </span>
                                    )}

                                  </td>

                                  <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                                    {getCurrency(
                                      unitPrice
                                    )}
                                  </td>

                                  <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-400">
                                    {quantity}
                                  </td>

                                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                                    {getCurrency(
                                      itemTotal
                                    )}
                                  </td>

                                </tr>
                              );
                            }
                          )}

                      </tbody>

                    </table>

                  </div>

                </div>

                {/* TOTAL */}

                <div className="bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-700/60 rounded-xl p-4">

                  <div className="flex flex-col items-end gap-2 text-xs">

                    <div className="flex items-center justify-between w-full sm:w-72">

                      <span className="text-slate-400 dark:text-slate-500">
                        Subtotal
                      </span>

                      <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {getCurrency(
                          selectedBill.subtotal
                        )}
                      </span>

                    </div>

                    <div className="flex items-center justify-between w-full sm:w-72">

                      <span className="text-slate-400 dark:text-slate-500">
                        Discount
                      </span>

                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        -{getCurrency(
                          selectedBill.discount
                        )}
                      </span>

                    </div>

                    <div className="w-full sm:w-72 border-t border-slate-200 dark:border-slate-700 pt-2 mt-1 flex items-center justify-between">

                      <span className="font-bold text-sm text-blue-700 dark:text-sky-400">
                        Order Total
                      </span>

                      <span className="font-mono font-extrabold text-lg text-blue-700 dark:text-sky-400">
                        {getCurrency(
                          selectedBill.total
                        )}
                      </span>

                    </div>

                  </div>

                </div>

                {/* ACTIONS */}

                <div className="flex flex-col sm:flex-row justify-end gap-2 mt-5">

                  <button
                    onClick={
                      handleCloseModal
                    }
                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
                  >
                    Close Details
                  </button>

                  <button
                    onClick={() =>
                      handleDownloadPDF(
                        selectedBill._id,
                        selectedBill.billNumber
                      )
                    }
                    disabled={
                      downloadingId ===
                      selectedBill._id
                    }
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >

                    {downloadingId ===
                    selectedBill._id ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}

                    {downloadingId ===
                    selectedBill._id
                      ? 'Preparing PDF...'
                      : 'Download Receipt'}

                  </button>

                </div>

              </div>

            </div>

          </div>
        )}

    </div>
  );
};

export default CustomerBills;