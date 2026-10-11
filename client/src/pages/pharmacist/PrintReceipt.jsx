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
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
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
  bill?.customerName ||
  bill?.customerId?.name ||
  'Guest Customer';

const getCustomerPhone = (bill) =>
  bill?.customerPhone ||
  bill?.guestPhone ||
  bill?.customerId?.phone ||
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

  const billedItems = Array.isArray(bill.items) ? bill.items : [];
  const items = billedItems.map((item) => {
    const returnedQuantity = (bill.returns || [])
      .filter((returnItem) => String(returnItem.medicineId) === String(item.medicineId))
      .reduce((sum, returnItem) => sum + toNumber(returnItem.quantityReturned), 0);
    return { ...item, remainingQuantity: Math.max(0, toNumber(item.quantity) - returnedQuantity) };
  }).filter((item) => item.remainingQuantity > 0);

  const originalSubtotal = billedItems.reduce(
    (sum, item) => sum + toNumber(item.salePrice ?? item.unitPrice) * toNumber(item.quantity), 0
  );
  const subtotal = items.reduce(
    (sum, item) => sum + toNumber(item.salePrice ?? item.unitPrice) * item.remainingQuantity, 0
  );
  const discount = originalSubtotal > 0
    ? Math.min(subtotal, toNumber(bill.discount) * subtotal / originalSubtotal)
    : 0;

  const total =
    bill.total !== undefined
      ? toNumber(bill.total)
      : Math.max(0, subtotal - discount);
  const totalRefunded = toNumber(bill.totalRefunded);
  const netTotal = Math.max(0, bill.netTotal !== undefined
    ? toNumber(bill.netTotal)
    : total - totalRefunded);

  const customerName = getCustomerName(bill);
  const customerPhone = getCustomerPhone(bill);
  const pharmacistName = getPharmacistName(bill);

  return (
    <div className="receipt-container min-h-screen bg-slate-100 px-4 py-6 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100 print:bg-white print:p-0 print:text-black">
      <style>
        {`
          @page {
            size: auto;
            margin: 6mm 8mm;
          }

          @media print {
            *, *::before, *::after {
              box-sizing: border-box !important;
              color: #000000 !important;
              text-shadow: none !important;
              filter: none !important;
            }

            html,
            body {
              width: 100% !important;
              min-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              font-size: 11pt !important;
              line-height: 1.3 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            .no-print {
              display: none !important;
            }

            .receipt-container {
              padding: 0 !important;
              margin: 0 !important;
              background: #ffffff !important;
              min-height: auto !important;
              width: 100% !important;
            }

            .receipt-page {
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
            }

            .receipt-card {
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              border: 1px solid #1e293b !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              background: #ffffff !important;
              page-break-inside: avoid;
            }

            .receipt-header {
              background: #0f172a !important;
              color: #ffffff !important;
              border-bottom: 2px solid #000000 !important;
              padding: 12px 16px !important;
            }

            .receipt-header * {
              color: #ffffff !important;
            }

            .print-table {
              width: 100% !important;
              border-collapse: collapse !important;
              margin-top: 6px !important;
            }

            .print-table th,
            .print-table td {
              border: 1px solid #cbd5e1 !important;
              padding: 6px 8px !important;
              font-size: 10pt !important;
              color: #000000 !important;
            }

            .print-table th {
              background: #f1f5f9 !important;
              font-weight: 700 !important;
              text-transform: uppercase !important;
              font-size: 9pt !important;
            }

            .receipt-info-grid {
              display: grid !important;
              grid-template-columns: 1fr 1fr !important;
              gap: 8px !important;
              padding: 10px 14px !important;
              border-bottom: 1px solid #94a3b8 !important;
            }

            .info-box {
              border: 1px solid #cbd5e1 !important;
              border-radius: 4px !important;
              padding: 6px 10px !important;
              background: #fafafa !important;
            }

            .receipt-body {
              padding: 10px 14px !important;
            }

            .receipt-totals {
              padding: 10px 14px !important;
              border-top: 1px solid #94a3b8 !important;
              background: #ffffff !important;
            }

            .receipt-verification {
              padding: 8px 14px !important;
              border-top: 1px dashed #94a3b8 !important;
              background: #f8fafc !important;
            }

            .receipt-footer {
              padding: 8px 14px !important;
              border-top: 1px solid #cbd5e1 !important;
              text-align: center !important;
            }

            .print-break-inside-avoid {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
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
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 active:scale-95"
            >
              <Printer className="h-4 w-4" />
              Print Receipt (Saaf & Poora Page)
            </button>
          </div>
        </div>

        {/* Receipt Card */}
        <div className="receipt-card overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
          {/* Header */}
          <div className="receipt-header border-b border-slate-200 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-600 px-6 py-6 text-white sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
                    <Receipt className="h-6 w-6" />
                  </div>

                  <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">
                      Sardar Pharmacy
                    </h1>

                    <p className="mt-0.5 text-xs font-bold tracking-wide text-blue-100">
                      Main Ada Girote Near MCB Bank | Phone: 0305-6091354
                    </p>
                  </div>
                </div>

                <p className="mt-2 text-xs font-medium text-blue-100">
                  Official medicine purchase receipt & tax invoice
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-3 text-left backdrop-blur-sm sm:min-w-[200px] sm:text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-100">
                  Bill Number
                </p>

                <p className="mt-0.5 font-mono text-base font-extrabold">
                  {bill.billNumber || bill._id || 'N/A'}
                </p>

                <p className="mt-1 text-[11px] font-semibold text-blue-100">
                  {formatDateTime(bill.createdAt)}
                </p>
              </div>
            </div>
          </div>

          {/* Customer / Pharmacist Details */}
          <div className="receipt-info-grid grid gap-4 border-b border-slate-200 p-5 dark:border-slate-800 sm:grid-cols-2 sm:p-6">
            <div className="info-box print-break-inside-avoid rounded-2xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Billed To (Customer)
              </p>

              <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                {customerName}
              </p>

              <p className="mt-0.5 font-mono text-xs font-medium text-slate-600 dark:text-slate-400">
                Phone: {customerPhone}
              </p>

              <p className="mt-1 text-[10px] font-semibold text-slate-500">
                {bill.customerId ? 'Registered Account' : 'Walk-in Guest'}
              </p>
            </div>

            <div className="info-box print-break-inside-avoid rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-left dark:border-slate-800 dark:bg-slate-800/50 sm:text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Billed By (Counter)
              </p>

              <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                {pharmacistName}
              </p>

              <p className="mt-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                Role: Pharmacist
              </p>

              <p className="mt-1 text-[10px] font-bold uppercase text-slate-700 dark:text-slate-300">
                Payment Method: {bill.paymentMethod || 'Cash'}
              </p>
            </div>
          </div>

          {/* Medicines Table */}
          <div className="receipt-body p-5 sm:p-6">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Medicine Particulars
                </h2>
                <p className="text-[11px] text-slate-500">
                  Sold medicines, batch & expiry details
                </p>
              </div>

              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                {items.length} {items.length === 1 ? 'Item' : 'Items'}
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="print-table w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/70">
                    <th className="w-10 px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      #
                    </th>
                    <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      Medicine Name
                    </th>
                    <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      Expiry Date
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      Qty
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      Unit Price
                    </th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((item, index) => {
                    const quantity = toNumber(item.remainingQuantity);
                    const returnedQuantity = Math.max(0, toNumber(item.quantity) - quantity);
                    const netQuantity = quantity;
                    const unitPrice = toNumber(item.salePrice ?? item.unitPrice);
                    const lineTotal = quantity * unitPrice;
                    const itemDiscount = originalSubtotal > 0
                      ? (toNumber(bill.discount) * lineTotal) / originalSubtotal
                      : 0;
                    const netLineTotal = Math.max(0, lineTotal - itemDiscount);

                    return (
                      <tr
                        key={`${item.medicineId || item.name}-${index}`}
                        className="print-break-inside-avoid"
                      >
                        <td className="px-3 py-2 text-center text-xs font-semibold text-slate-500">
                          {index + 1}
                        </td>

                        <td className="px-3 py-2">
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            {item.name || 'Unknown medicine'}
                          </p>
                          {item.rackLocation && (
                            <p className="text-[10px] font-semibold text-slate-500">
                              Rack: {item.rackLocation}
                            </p>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                          {formatDate(item.expiryDate)}
                        </td>

                        <td className="px-3 py-2 text-right text-xs font-bold text-slate-900 dark:text-slate-200">
                          <div>{quantity}</div>
                          {returnedQuantity > 0 && (
                            <div className="text-[9px] font-bold text-amber-600">
                              ({returnedQuantity} ret · {netQuantity} net)
                            </div>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-3 py-2 text-right text-xs font-medium text-slate-700 dark:text-slate-300">
                          {formatPKR(unitPrice)}
                        </td>

                        <td className="whitespace-nowrap px-3 py-2 text-right text-xs font-bold text-slate-900 dark:text-white">
                          {formatPKR(netLineTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {items.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400 dark:border-slate-700">
                No medicine items on this bill.
              </div>
            )}
          </div>

          {/* Totals Section */}
          <div className="receipt-totals border-t border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/30 sm:p-6">
            <div className="ml-auto w-full max-w-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600 dark:text-slate-400">
                  Subtotal:
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-200">
                  {formatPKR(subtotal)}
                </span>
              </div>

              {discount > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Discount Given:
                  </span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    - {formatPKR(discount)}
                  </span>
                </div>
              )}

              {totalRefunded > 0 && (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-400">
                      Original Bill:
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-200">
                      {formatPKR(total)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-rose-600 dark:text-rose-400">
                      Refunds Deducted:
                    </span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                      - {formatPKR(totalRefunded)}
                    </span>
                  </div>
                </>
              )}

              <div className="border-t-2 border-slate-800 pt-2">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                      {totalRefunded > 0 ? 'Net Amount:' : 'Total Payable:'}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-500">
                      ({bill.paymentMethod || 'Cash'})
                    </p>
                  </div>

                  <p className="text-xl font-black text-slate-950 dark:text-blue-400">
                    {formatPKR(netTotal)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Verification Badge */}
          <div className="receipt-verification px-5 py-3 sm:px-6">
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
              <p className="text-[10px] leading-tight font-medium">
                Verified computerized invoice by Sardar Pharmacy · Main Ada Girote Near MCB Bank · Ph: 0305-6091354
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="receipt-footer border-t border-slate-200 px-5 py-4 text-center dark:border-slate-800 sm:px-6">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Thank You For Your Visit! Sehat Mand Rahain.
            </p>
            <p className="mt-0.5 text-[10px] font-medium text-slate-500">
              Computer Generated Receipt · No Signature Required · Bill ID: {bill._id || billId}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintReceipt;
