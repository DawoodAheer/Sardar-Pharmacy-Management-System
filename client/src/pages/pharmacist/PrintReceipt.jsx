import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Printer,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import api from '../../utils/api';

const formatPKR = (amount) =>
  `PKR ${Number(amount || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

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

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const getCustomerName = (bill) =>
  bill?.customerName ||
  bill?.customerId?.name ||
  'Walk-in Customer';

const getCustomerPhone = (bill) =>
  bill?.customerPhone ||
  bill?.guestPhone ||
  bill?.customerId?.phone ||
  'N/A';

// Dynamic employee name & role resolution based on authenticated data
const getBilledByEmployee = (bill) => {
  const employee = bill?.pharmacistId || bill?.reviewedBy;
  if (!employee) return 'Staff (Counter)';

  const name = typeof employee === 'object' ? employee.name : bill.pharmacistName;
  const roleRaw = typeof employee === 'object' ? employee.role : null;

  let roleLabel = 'Staff';
  if (roleRaw === 'superadmin' || roleRaw === 'admin') {
    roleLabel = 'Admin';
  } else if (roleRaw === 'pharmacist') {
    roleLabel = 'Pharmacist';
  } else if (roleRaw) {
    roleLabel = roleRaw.charAt(0).toUpperCase() + roleRaw.slice(1);
  } else if (bill.pharmacistId) {
    roleLabel = 'Pharmacist';
  }

  return `${name || 'Counter'} (${roleLabel})`;
};

const PrintReceipt = () => {
  const { billId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Mode: standard sales receipt or refund receipt
  const isRefundReceipt = searchParams.get('type') === 'refund';
  const autoPrint = searchParams.get('print') === '1';

  useEffect(() => {
    let isMounted = true;

    const fetchBill = async () => {
      if (!billId) {
        if (isMounted) {
          setError('No bill ID provided.');
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
              'Failed to load receipt details. Please try again.'
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

  // Handle auto-print if opened via ?print=1
  useEffect(() => {
    if (!loading && bill && autoPrint) {
      // Allow browser to fully paint the receipt sheet and webfonts before opening print preview
      const timer = setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.print();
          });
        });
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [loading, bill, autoPrint]);

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/pharmacist');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-800" />
          <p className="text-sm font-semibold text-slate-800">
            Loading receipt...
          </p>
          <p className="text-xs text-slate-500">
            Preparing Sardar Medical Store invoice.
          </p>
        </div>
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-lg">
          <Receipt className="mx-auto h-10 w-10 text-red-500" />
          <h1 className="mt-3 text-lg font-bold text-slate-900">
            Unable to Load Receipt
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            {error || 'Receipt data was not found.'}
          </p>
          <button
            type="button"
            onClick={handleBack}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </div>
    );
  }

  // Calculate items and totals
  const billedItems = Array.isArray(bill.items) ? bill.items : [];
  const returns = Array.isArray(bill.returns) ? bill.returns : [];

  const subtotal = toNumber(bill.subtotal) || billedItems.reduce(
    (sum, item) => sum + toNumber(item.salePrice ?? item.unitPrice) * toNumber(item.quantity),
    0
  );
  const discount = toNumber(bill.discount);
  const total = toNumber(bill.total) || Math.max(0, subtotal - discount);
  const totalRefunded = toNumber(bill.totalRefunded);
  const netTotal = bill.netTotal !== undefined
    ? toNumber(bill.netTotal)
    : Math.max(0, total - totalRefunded);

  // Paid amount & balance logic: In-store sales are cash/card paid in full upon confirmation
  const paidAmount = total;
  const balance = Math.max(0, total - paidAmount);

  // Refund employee info (latest return or combined)
  const latestReturn = returns.length > 0 ? returns[returns.length - 1] : null;
  const refundEmployee = latestReturn?.returnedBy;
  const refundEmployeeName = typeof refundEmployee === 'object'
    ? `${refundEmployee.name || 'Staff'} (${(refundEmployee.role || 'staff').toUpperCase() === 'SUPERADMIN' ? 'Admin' : (refundEmployee.role || 'staff')})`
    : 'Admin / Pharmacist';

  return (
    <div className="receipt-wrapper min-h-screen bg-slate-100 py-6 font-sans text-black print:bg-white print:p-0">
      <style>
        {`
          /* Universal clean print styles for Epson 80mm / A4 / Letter */
          @page {
            size: auto;
            margin: 4mm 6mm;
          }

          @media print {
            *, *::before, *::after {
              box-sizing: border-box !important;
              color: #000000 !important;
              background: transparent !important;
              box-shadow: none !important;
              text-shadow: none !important;
            }

            html, body {
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important;
              font-size: 10pt !important;
              line-height: 1.25 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            .no-print {
              display: none !important;
            }

            .receipt-wrapper {
              background: #ffffff !important;
              padding: 0 !important;
              margin: 0 !important;
              min-height: auto !important;
              width: 100% !important;
            }

            .receipt-sheet {
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
              page-break-inside: avoid;
              break-inside: avoid;
            }

            .print-border-b {
              border-bottom: 1px solid #000000 !important;
            }

            .print-border-t {
              border-top: 1px solid #000000 !important;
            }

            .print-border-double {
              border-top: 2px solid #000000 !important;
              border-bottom: 2px solid #000000 !important;
            }

            table {
              width: 100% !important;
              border-collapse: collapse !important;
              page-break-inside: avoid !important;
            }

            th, td {
              border-bottom: 1px solid #e2e8f0 !important;
              padding: 4px 2px !important;
              color: #000000 !important;
            }

            th {
              border-bottom: 1px solid #000000 !important;
              border-top: 1px solid #000000 !important;
              font-weight: 700 !important;
            }

            .avoid-break {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          }
        `}
      </style>

      {/* Screen toolbar (hidden during printing) */}
      <div className="no-print mx-auto mb-4 max-w-xl px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-center gap-2">
            {returns.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800 border border-amber-200">
                <RotateCcw className="h-3.5 w-3.5" />
                {returns.length} Return(s) Logged
              </span>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-900 active:scale-95 transition-all"
            >
              <Printer className="h-4 w-4" />
              Print Receipt (Epson / Thermal / A4)
            </button>
          </div>
        </div>
      </div>

      {/* Clean, high-legibility thermal & paper receipt sheet */}
      <div className="receipt-sheet mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-md print:max-w-full print:rounded-none print:border-none print:p-0 print:shadow-none">

        {/* ============================================================== */}
        {/* 1. STORE HEADER: SARDAR MEDICAL STORE ONLY */}
        {/* ============================================================== */}
        <div className="text-center pb-3 border-b border-slate-300 print:border-b print:border-black">
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-black">
            Sardar Medical Store
          </h1>
          <p className="mt-0.5 text-xs font-medium text-slate-700 print:text-black">
            Main Ada Girote Near MCB Bank · Phone: 0305-6091354
          </p>
          <div className="mt-1 inline-block border-y border-slate-300 print:border-y print:border-black py-0.5 px-3">
            <p className="text-[11px] font-bold tracking-wider uppercase text-emerald-900 print:text-black">
              {isRefundReceipt ? '★ OFFICIAL REFUND RECEIPT ★' : 'SALES TAX INVOICE & CASH RECEIPT'}
            </p>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. RECEIPT META: BILL #, DATE, BILLED BY, CUSTOMER */}
        {/* ============================================================== */}
        <div className="py-2.5 text-xs border-b border-slate-200 print:border-b print:border-black space-y-1">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-600 print:text-black">Bill No:</span>
            <span className="font-mono font-bold text-black">{bill.billNumber || bill._id}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-600 print:text-black">Date & Time:</span>
            <span className="font-medium text-black">{formatDateTime(bill.createdAt)}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-600 print:text-black">Billed By:</span>
            <span className="font-bold text-black">{getBilledByEmployee(bill)}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-600 print:text-black">Customer:</span>
            <span className="font-medium text-black">
              {getCustomerName(bill)} {getCustomerPhone(bill) !== 'N/A' && `(${getCustomerPhone(bill)})`}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-600 print:text-black">Payment Method:</span>
            <span className="font-bold text-black">{bill.paymentMethod || 'Cash'}</span>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 3. MEDICINES TABLE */}
        {/* ============================================================== */}
        <div className="py-2">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-black text-[11px] uppercase">
                <th className="py-1.5 w-6 text-center">#</th>
                <th className="py-1.5">Medicine Name</th>
                <th className="py-1.5 text-center">Qty</th>
                <th className="py-1.5 text-right">Price</th>
                <th className="py-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 print:divide-slate-300">
              {billedItems.map((item, index) => {
                const qty = toNumber(item.quantity);
                const unitPrice = toNumber(item.salePrice ?? item.unitPrice);
                const lineTotal = qty * unitPrice;

                // Check if this item had returns
                const itemReturns = returns.filter(
                  (ret) => String(ret.medicineId) === String(item.medicineId)
                );
                const qtyReturned = itemReturns.reduce(
                  (sum, ret) => sum + toNumber(ret.quantityReturned),
                  0
                );

                return (
                  <tr key={`${item.medicineId || item.name}-${index}`} className="avoid-break">
                    <td className="py-1.5 text-center text-slate-600 print:text-black font-mono text-[11px]">
                      {index + 1}
                    </td>
                    <td className="py-1.5 pr-2">
                      <div className="font-bold text-black">{item.name}</div>
                      {item.expiryDate && (
                        <div className="text-[10px] text-slate-500 print:text-black">
                          Exp: {formatDate(item.expiryDate)} {item.rackLocation && `· Rack: ${item.rackLocation}`}
                        </div>
                      )}
                      {qtyReturned > 0 && (
                        <div className="text-[10px] font-bold text-amber-800 print:text-black">
                          [Returned: {qtyReturned} | Remaining: {Math.max(0, qty - qtyReturned)}]
                        </div>
                      )}
                    </td>
                    <td className="py-1.5 text-center font-bold text-black">
                      {qty}
                    </td>
                    <td className="py-1.5 text-right font-mono text-black whitespace-nowrap">
                      {formatPKR(unitPrice)}
                    </td>
                    <td className="py-1.5 text-right font-mono font-bold text-black whitespace-nowrap">
                      {formatPKR(lineTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {billedItems.length === 0 && (
            <p className="py-4 text-center text-xs text-slate-400">
              No medicine items recorded on this bill.
            </p>
          )}
        </div>

        {/* ============================================================== */}
        {/* 4. TOTALS SECTION: SUBTOTAL, DISCOUNT, TOTAL, PAID, BALANCE */}
        {/* ============================================================== */}
        <div className="pt-2 border-t-2 border-black space-y-1 text-xs avoid-break">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-700 print:text-black">Subtotal:</span>
            <span className="font-mono font-medium text-black">{formatPKR(subtotal)}</span>
          </div>

          {discount > 0 && (
            <div className="flex justify-between items-center">
              <span className="font-semibold text-emerald-800 print:text-black">Discount:</span>
              <span className="font-mono font-bold text-emerald-800 print:text-black">- {formatPKR(discount)}</span>
            </div>
          )}

          <div className="flex justify-between items-center font-bold text-sm border-t border-slate-300 print:border-black pt-1">
            <span>Bill Total:</span>
            <span className="font-mono text-base font-black">{formatPKR(total)}</span>
          </div>

          <div className="flex justify-between items-center pt-0.5">
            <span className="font-semibold text-slate-700 print:text-black">Paid Amount:</span>
            <span className="font-mono font-bold text-black">{formatPKR(paidAmount)}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-700 print:text-black">Balance Due:</span>
            <span className="font-mono font-bold text-black">{formatPKR(balance)}</span>
          </div>

          {/* Refund details if items were returned */}
          {totalRefunded > 0 && (
            <div className="mt-2 rounded-lg border border-slate-300 print:border-black p-2 bg-slate-50 print:bg-transparent space-y-1">
              <div className="flex justify-between items-center text-xs font-bold text-amber-900 print:text-black">
                <span>Total Refunded:</span>
                <span className="font-mono">- {formatPKR(totalRefunded)}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold">
                <span>Net Sales Amount:</span>
                <span className="font-mono text-sm">{formatPKR(netTotal)}</span>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* 5. REFUND SECTION BREAKDOWN (IF ANY RETURNS LOGGED) */}
        {/* ============================================================== */}
        {returns.length > 0 && (
          <div className="mt-3 pt-2 border-t-2 border-dashed border-black avoid-break text-xs">
            <div className="flex items-center justify-between pb-1">
              <span className="font-bold uppercase tracking-wider text-black">
                Processed Returns & Refunds
              </span>
              <span className="text-[10px] text-slate-600 print:text-black">
                Processed By: {refundEmployeeName}
              </span>
            </div>

            <table className="w-full text-left text-[11px] mt-1 border-t border-slate-300 print:border-black">
              <thead>
                <tr className="border-b border-slate-300 print:border-black text-slate-600 print:text-black">
                  <th className="py-1">Returned Item</th>
                  <th className="py-1 text-center">Qty</th>
                  <th className="py-1 text-right">Refund</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 print:divide-slate-300">
                {returns.map((ret, rIdx) => (
                  <tr key={ret._id || rIdx}>
                    <td className="py-1 font-semibold text-black">
                      {ret.name}
                      {ret.reason && (
                        <div className="text-[10px] font-normal text-slate-500 print:text-black">
                          Reason: {ret.reason}
                        </div>
                      )}
                    </td>
                    <td className="py-1 text-center font-bold text-black">
                      {ret.quantityReturned}
                    </td>
                    <td className="py-1 text-right font-mono font-bold text-black whitespace-nowrap">
                      {formatPKR(ret.refundAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ============================================================== */}
        {/* 6. RECEIPT FOOTER */}
        {/* ============================================================== */}
        <div className="mt-4 pt-3 border-t border-slate-300 print:border-black text-center text-[10px] space-y-0.5 avoid-break">
          <p className="font-bold uppercase text-black">
            Thank you for visiting Sardar Medical Store!
          </p>
          <p className="text-slate-600 print:text-black">
            Medicines return / exchange acceptable within 3 days with original receipt.
          </p>
          <p className="text-slate-500 print:text-black font-mono text-[9px] pt-1">
            Computer Generated Tax Invoice · Bill ID: {bill._id}
          </p>
        </div>

      </div>
    </div>
  );
};

export default PrintReceipt;
