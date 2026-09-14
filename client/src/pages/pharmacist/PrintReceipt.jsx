import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Printer,
  Receipt,
  ShieldCheck,
} from 'lucide-react';
import api from '../../utils/api';

const formatPKR = (amount) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const formatDate = (value) => {
  if (!value) {
    return 'N/A';
  }

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
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleString('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const toNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
};

const getCustomerName = (bill) =>
  bill?.customerId?.name ||
  bill?.customerName ||
  'Guest Customer';

const getCustomerPhone = (bill) =>
  bill?.customerId?.phone ||
  bill?.customerPhone ||
  bill?.guestPhone ||
  'N/A';

const getPharmacistName = (bill) =>
  bill?.pharmacistId?.name ||
  bill?.pharmacistName ||
  'Pharmacist';

const PrintReceipt = () => {
  const { billId } = useParams();
  const navigate = useNavigate();

  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchBill = async () => {
      if (!billId) {
        if (isMounted) {
          setError('No bill ID was provided.');
          setLoading(false);
        }

        return;
      }

      try {
        setLoading(true);
        setError('');

        const { data } = await api.get(`/bills/${billId}`);

        if (isMounted) {
          setBill(data?.bill || data);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err?.response?.data?.message ||
              'Failed to load the receipt. Please try again.'
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchBill();

    return () => {
      isMounted = false;
    };
  }, [billId]);

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    navigate('/pharmacist', {
      state: {
        activeTab: 'new-bill',
      },
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 ring-1 ring-teal-100 dark:bg-teal-950/30 dark:text-teal-300 dark:ring-teal-800/40">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>

          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Loading receipt...
          </p>

          <p className="text-xs text-slate-400">
            Preparing your pharmacy invoice.
          </p>
        </div>
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-3xl border border-red-200 bg-white p-7 text-center shadow-xl dark:border-red-900/50 dark:bg-slate-900">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400">
            <Receipt className="h-7 w-7" />
          </div>

          <h1 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
            Unable to load receipt
          </h1>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {error || 'Receipt data was not found.'}
          </p>

          <button
            type="button"
            onClick={handleBack}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Billing
          </button>
        </div>
      </div>
    );
  }

  const items = Array.isArray(bill.items) ? bill.items : [];

  const subtotal =
    bill.subtotal !== undefined
      ? toNumber(bill.subtotal)
      : items.reduce(
          (sum, item) =>
            sum +
            toNumber(item.unitPrice) * toNumber(item.quantity),
          0
        );

  const discount = toNumber(bill.discount);

  const total =
    bill.total !== undefined
      ? toNumber(bill.total)
      : Math.max(0, subtotal - discount);

  const customerName = getCustomerName(bill);
  const customerPhone = getCustomerPhone(bill);
  const pharmacistName = getPharmacistName(bill);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100 print:bg-white print:p-0 print:text-black">
      <style>
        {`
          @page {
            size: A4;
            margin: 12mm;
          }

          @media print {
            html,
            body {
              background: #ffffff !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .no-print {
              display: none !important;
            }

            .receipt-page {
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              border: 0 !important;
              border-radius: 0 !important;
              box-shadow: none !important;
            }

            .receipt-card {
              width: 100% !important;
              max-width: 100% !important;
              border: 0 !important;
              border-radius: 0 !important;
              box-shadow: none !important;
            }

            .print-no-border {
              border-color: #d1d5db !important;
            }

            .print-break-inside-avoid {
              break-inside: avoid;
              page-break-inside: avoid;
            }

            table {
              page-break-inside: auto;
            }

            tr {
              break-inside: avoid;
              page-break-inside: avoid;
            }

            thead {
              display: table-header-group;
            }

            tfoot {
              display: table-footer-group;
            }
          }
        `}
      </style>

      <div className="receipt-page mx-auto max-w-4xl">
        {/* Screen toolbar */}
        <div className="no-print mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Billing
          </button>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 sm:flex">
              <CheckCircle2 className="h-4 w-4" />
              Bill Confirmed
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
            >
              <Printer className="h-4 w-4" />
              Print Receipt
            </button>
          </div>
        </div>

        {/* Receipt */}
        <div className="receipt-card overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
          {/* Header */}
          <div className="border-b border-slate-200 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-600 px-6 py-7 text-white sm:px-8 print:bg-white print:text-black">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 print:border print:border-slate-300">
                    <Receipt className="h-6 w-6" />
                  </div>

                  <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">
                      Sardar Medical Store
                    </h1>

                    <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.18em] text-blue-100 print:text-slate-500">
                      Pharmacy Management System
                    </p>
                  </div>
                </div>

                <p className="mt-5 max-w-md text-sm leading-6 text-blue-100 print:text-slate-600">
                  Official medicine purchase receipt for your pharmacy
                  transaction.
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4 text-left backdrop-blur-sm print:border print:border-slate-300 print:bg-white sm:min-w-[220px] sm:text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-100 print:text-slate-500">
                  Bill Number
                </p>

                <p className="mt-1 font-mono text-lg font-extrabold">
                  {bill.billNumber || bill._id || 'N/A'}
                </p>

                <p className="mt-2 text-[11px] text-blue-100 print:text-slate-500">
                  {formatDateTime(bill.createdAt)}
                </p>
              </div>
            </div>
          </div>

          {/* Customer / Pharmacist */}
          <div className="grid gap-4 border-b border-slate-200 p-6 dark:border-slate-800 sm:grid-cols-2 sm:p-8 print:border-slate-300">
            <div className="print-break-inside-avoid rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50 print:border-slate-300 print:bg-white">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Billed To
              </p>

              <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white print:text-black">
                {customerName}
              </p>

              <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400 print:text-slate-600">
                {customerPhone}
              </p>

              <p className="mt-2 text-[10px] font-semibold text-slate-400">
                {bill.customerId ? 'Registered Customer' : 'Guest Customer'}
              </p>
            </div>

            <div className="print-break-inside-avoid rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left dark:border-slate-800 dark:bg-slate-800/50 sm:text-right print:border-slate-300 print:bg-white">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Billed By
              </p>

              <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white print:text-black">
                {pharmacistName}
              </p>

              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 print:text-slate-600">
                Pharmacist
              </p>

              <p className="mt-2 text-[10px] font-semibold text-slate-400">
                Payment: {bill.paymentMethod || 'Cash'}
              </p>
            </div>
          </div>

          {/* Medicines */}
          <div className="p-6 sm:p-8">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white print:text-black">
                  Medicine Details
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Items included in this pharmacy transaction.
                </p>
              </div>

              <span className="text-xs font-semibold text-slate-400">
                {items.length} line item{items.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 print:border-slate-300">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/70 print:bg-slate-100">
                      <th className="w-10 px-3 py-3 text-center text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:px-4">
                        #
                      </th>

                      <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:px-4">
                        Medicine
                      </th>

                      <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:px-4">
                        Expiry
                      </th>

                      <th className="px-3 py-3 text-right text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:px-4">
                        Qty
                      </th>

                      <th className="px-3 py-3 text-right text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:px-4">
                        Unit Price
                      </th>

                      <th className="px-3 py-3 text-right text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:px-4">
                        Total
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-300">
                    {items.map((item, index) => {
                      const quantity = toNumber(item.quantity);
                      const unitPrice = toNumber(item.unitPrice);
                      const lineTotal = quantity * unitPrice;

                      return (
                        <tr
                          key={`${item.medicineId || item.name}-${index}`}
                          className="print-break-inside-avoid"
                        >
                          <td className="px-3 py-3 text-center text-xs font-medium text-slate-400 sm:px-4">
                            {index + 1}
                          </td>

                          <td className="px-3 py-3 sm:px-4">
                            <p className="text-xs font-bold text-slate-900 dark:text-white print:text-black">
                              {item.name || 'Unknown medicine'}
                            </p>

                            {item.rackLocation && (
                              <p className="mt-0.5 text-[9px] text-slate-400">
                                Rack: {item.rackLocation}
                              </p>
                            )}
                          </td>

                          <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500 dark:text-slate-400 print:text-slate-600 sm:px-4">
                            {formatDate(item.expiryDate)}
                          </td>

                          <td className="px-3 py-3 text-right text-xs font-semibold text-slate-700 dark:text-slate-200 print:text-black sm:px-4">
                            {quantity}
                          </td>

                          <td className="whitespace-nowrap px-3 py-3 text-right text-xs font-medium text-slate-600 dark:text-slate-300 print:text-slate-700 sm:px-4">
                            {formatPKR(unitPrice)}
                          </td>

                          <td className="whitespace-nowrap px-3 py-3 text-right text-xs font-bold text-slate-900 dark:text-white print:text-black sm:px-4">
                            {formatPKR(lineTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {items.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400 dark:border-slate-700">
                No medicine items were found on this bill.
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="border-t border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-800/30 sm:p-8 print:border-slate-300 print:bg-white">
            <div className="ml-auto w-full max-w-sm space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">
                  Subtotal
                </span>

                <span className="font-semibold text-slate-800 dark:text-slate-200 print:text-black">
                  {formatPKR(subtotal)}
                </span>
              </div>

              {discount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Discount
                  </span>

                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    - {formatPKR(discount)}
                  </span>
                </div>
              )}

              <div className="border-t border-slate-200 pt-3 dark:border-slate-700 print:border-slate-300">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Total Paid
                    </p>

                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {bill.paymentMethod || 'Cash'}
                    </p>
                  </div>

                  <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 print:text-black">
                    {formatPKR(total)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Verification */}
          <div className="px-6 pb-6 sm:px-8 sm:pb-8">
            <div className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20 print:border-slate-300 print:bg-white">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400 print:text-black" />

                <div>
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200 print:text-black">
                    Pharmacy transaction verified
                  </p>

                  <p className="mt-1 text-[10px] leading-5 text-emerald-700 dark:text-emerald-300 print:text-slate-600">
                    This receipt was generated by Sardar Medical Store and contains
                    the medicines, quantities, prices, customer details,
                    payment method and final payable amount recorded for
                    this transaction.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 px-6 py-6 text-center dark:border-slate-800 sm:px-8 print:border-slate-300">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 print:text-black">
              Thank you for choosing Sardar Medical Store
            </p>

            <p className="mt-1 text-[10px] text-slate-400">
              Computer-generated receipt · No signature required
            </p>

            <p className="mt-3 text-[9px] uppercase tracking-[0.14em] text-slate-300 dark:text-slate-600 print:text-slate-400">
              Bill ID: {bill._id || billId}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintReceipt;