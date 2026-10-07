import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import {
  Wallet,
  Plus,
  X,
  Search,
  Phone,
  MapPin,
  User,
  Calendar,
  Package,
  CheckCircle,
  Clock,
  AlertCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  FileText,
  Edit3,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  ReceiptText,
  Banknote,
} from 'lucide-react';

// ─── helpers ────────────────────────────────────────────────────────────────
const PKR = (v) =>
  new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(v || 0);

const fmt = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtTime = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' });
};

const statusBadge = (status) => {
  const m = {
    PENDING: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
    PARTIALLY_PAID: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    PAID: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  };
  const labels = { PENDING: 'Baaki', PARTIALLY_PAID: 'Adha Paid', PAID: 'Paid' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${m[status] || ''}`}>
      {status === 'PAID' && <CheckCircle className="h-2.5 w-2.5" />}
      {status === 'PENDING' && <AlertCircle className="h-2.5 w-2.5" />}
      {status === 'PARTIALLY_PAID' && <Clock className="h-2.5 w-2.5" />}
      {labels[status] || status}
    </span>
  );
};

// ─── blank form state ────────────────────────────────────────────────────────
const blankItem = () => ({ medicineName: '', quantity: 1, unitPrice: 0, dateTaken: new Date().toISOString().split('T')[0], notes: '' });
const blankForm = () => ({ customerName: '', customerPhone: '', customerAddress: '', notes: '', billRef: '', items: [blankItem()] });

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function UdharManagement() {
  const qc = useQueryClient();

  // list state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedRecord, setSelectedRecord] = useState(null); // detail view
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // form states
  const [form, setForm] = useState(blankForm());
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [newItem, setNewItem] = useState(blankItem());
  const [editForm, setEditForm] = useState({ customerName: '', customerPhone: '', customerAddress: '', notes: '', billRef: '' });

  // ── queries ──────────────────────────────────────────────────────────────
  const { data: summaryData, refetch: refetchUdharSummary } = useQuery({
    queryKey: ['udharSummary'],
    queryFn: async () => (await api.get('/udhar/summary')).data.summary,
    refetchInterval: 60000,
  });

  const { data: listData, isLoading, refetch: refetchUdharList } = useQuery({
    queryKey: ['udharList', search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      params.append('limit', '100');
      return (await api.get(`/udhar?${params}`)).data;
    },
    keepPreviousData: true,
  });

  const records = listData?.records || [];

  // ── mutations ─────────────────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['udharList'] });
    qc.invalidateQueries({ queryKey: ['udharSummary'] });
  };

  const createMut = useMutation({
    mutationFn: (data) => api.post('/udhar', data),
    onSuccess: (res) => {
      invalidate();
      setShowCreateModal(false);
      setForm(blankForm());
      setSelectedRecord(res.data.udhar);
    },
  });

  const payMut = useMutation({
    mutationFn: ({ id, amount, note }) => api.post(`/udhar/${id}/pay`, { amount, note }),
    onSuccess: (res) => {
      invalidate();
      setShowPayModal(false);
      setPayAmount('');
      setPayNote('');
      setSelectedRecord(res.data.udhar);
    },
  });

  const addItemMut = useMutation({
    mutationFn: ({ id, item }) => api.post(`/udhar/${id}/add-item`, item),
    onSuccess: (res) => {
      invalidate();
      setShowAddItemModal(false);
      setNewItem(blankItem());
      setSelectedRecord(res.data.udhar);
    },
  });

  const removeItemMut = useMutation({
    mutationFn: ({ id, itemId }) => api.delete(`/udhar/${id}/item/${itemId}`),
    onSuccess: (res) => {
      invalidate();
      setSelectedRecord(res.data.udhar);
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => api.put(`/udhar/${id}`, data),
    onSuccess: (res) => {
      invalidate();
      setShowEditModal(false);
      setSelectedRecord(res.data.udhar);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/udhar/${id}`),
    onSuccess: () => {
      invalidate();
      setSelectedRecord(null);
    },
  });

  // ── form helpers ─────────────────────────────────────────────────────────
  const setItem = (idx, field, val) => {
    setForm((p) => {
      const items = [...p.items];
      items[idx] = { ...items[idx], [field]: val };
      return { ...p, items };
    });
  };
  const addRow = () => setForm((p) => ({ ...p, items: [...p.items, blankItem()] }));
  const removeRow = (idx) => setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const handleCreate = () => {
    const data = {
      ...form,
      items: form.items.map((it) => ({
        ...it,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
      })),
    };
    createMut.mutate(data);
  };

  const openEdit = (rec) => {
    setEditForm({
      customerName: rec.customerName,
      customerPhone: rec.customerPhone,
      customerAddress: rec.customerAddress,
      notes: rec.notes,
      billRef: rec.billRef,
    });
    setShowEditModal(true);
  };

  const summary = summaryData || {};
  const overall = summary.overall || {};

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className="font-sans">
      {/* ── Page Header ── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Udhar Khata</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Credit & Payment Management</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { refetchUdharSummary(); refetchUdharList(); }}
            className="inline-flex items-center gap-2 rounded-2xl bg-white border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => { setForm(blankForm()); setShowCreateModal(true); }}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/25 transition hover:brightness-110 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Naya Udhar Likho
          </button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Udhar Diya', value: PKR(overall.totalUdharGiven), icon: TrendingDown, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/30' },
          { label: 'Total Wapis Aya', value: PKR(overall.totalRecovered), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
          { label: 'Baaki Amount', value: PKR(overall.totalPending), icon: Banknote, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
          { label: 'Total Customers', value: overall.totalCustomers || 0, icon: User, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
        ].map((c) => (
          <div key={c.label} className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm`}>
            <div className={`mb-2 inline-flex rounded-xl p-2 ${c.bg}`}>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{c.label}</p>
            <p className={`text-lg font-extrabold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* ── Main Layout: List + Detail ── */}
      <div className="flex gap-4 flex-col lg:flex-row">

        {/* ── LIST PANEL ── */}
        <div className="w-full lg:w-96 shrink-0">
          {/* Filters */}
          <div className="mb-3 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Naam ya number search karo..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">Sab</option>
              <option value="PENDING">Baaki</option>
              <option value="PARTIALLY_PAID">Adha Paid</option>
              <option value="PAID">Paid</option>
            </select>
          </div>

          {/* Records List */}
          <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Loading...</div>
            ) : records.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-8 text-center text-slate-400 text-sm">
                <Wallet className="mx-auto mb-2 h-10 w-10 opacity-30" />
                Koi udhar record nahi mila
              </div>
            ) : (
              records.map((rec) => (
                <button
                  key={rec._id}
                  onClick={() => setSelectedRecord(rec)}
                  className={`w-full rounded-xl border p-3 text-left transition-all ${
                    selectedRecord?._id === rec._id
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 shadow-md ring-1 ring-amber-400/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900 dark:text-white text-sm">{rec.customerName}</p>
                      {rec.customerPhone && (
                        <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          <Phone className="h-3 w-3" />{rec.customerPhone}
                        </p>
                      )}
                    </div>
                    {statusBadge(rec.status)}
                  </div>
                  <div className="mt-3 flex justify-between items-end">
                    <div>
                      <p className="text-[10px] text-slate-400">Baaki</p>
                      <p className="text-base font-extrabold text-rose-600 dark:text-rose-400">{PKR(rec.remainingAmount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400">Total</p>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{PKR(rec.totalAmount)}</p>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-400">{fmt(rec.createdAt)} · {rec.items?.length || 0} item(s)</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── DETAIL PANEL ── */}
        <div className="flex-1 min-w-0">
          {!selectedRecord ? (
            <div className="flex h-full min-h-64 items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400">
              <div className="text-center">
                <ReceiptText className="mx-auto mb-3 h-12 w-12 opacity-30" />
                <p className="text-sm">Koi record select karo ya naya banao</p>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
              {/* Detail Header */}
              <div className="border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-amber-500 to-orange-600 p-6 text-white">
                <div className="flex flex-wrap items-start gap-4 justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-extrabold">{selectedRecord.customerName}</h2>
                        <div className="flex flex-wrap gap-3 mt-0.5 text-amber-100 text-xs">
                          {selectedRecord.customerPhone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{selectedRecord.customerPhone}</span>}
                          {selectedRecord.customerAddress && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{selectedRecord.customerAddress}</span>}
                        </div>
                      </div>
                    </div>
                    {selectedRecord.notes && <p className="mt-2 text-xs text-amber-100 italic">"{selectedRecord.notes}"</p>}
                    {selectedRecord.billRef && <p className="mt-1 text-xs text-amber-100">Bill Ref: {selectedRecord.billRef}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {statusBadge(selectedRecord.status)}
                    <button onClick={() => openEdit(selectedRecord)} className="rounded-lg bg-white/20 p-2 hover:bg-white/30 transition" title="Edit Info">
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { if (window.confirm('Yeh record delete karo?')) deleteMut.mutate(selectedRecord._id); }}
                      className="rounded-lg bg-white/20 p-2 hover:bg-red-500/40 transition"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Financials */}
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total Amount', value: PKR(selectedRecord.totalAmount), cls: 'text-white' },
                    { label: 'Total Paid', value: PKR(selectedRecord.totalPaid), cls: 'text-emerald-200' },
                    { label: 'Baaki (Remaining)', value: PKR(selectedRecord.remainingAmount), cls: 'text-rose-200 text-lg font-extrabold' },
                  ].map((f) => (
                    <div key={f.label} className="rounded-xl bg-white/15 p-3 text-center">
                      <p className="text-[10px] text-amber-100 uppercase tracking-wide">{f.label}</p>
                      <p className={`text-sm font-bold ${f.cls}`}>{f.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              {selectedRecord.status !== 'PAID' && (
                <div className="flex flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-800/50">
                  <button
                    onClick={() => { setPayAmount(''); setPayNote(''); setShowPayModal(true); }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-700 transition"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    Payment Lena
                  </button>
                  <button
                    onClick={() => { setNewItem(blankItem()); setShowAddItemModal(true); }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-blue-700 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Medicine Add Karo
                  </button>
                </div>
              )}

              <div className="p-4 overflow-y-auto max-h-[420px] space-y-5">
                {/* Medicine Items */}
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <Package className="h-4 w-4 text-blue-600" />
                    Medicines ({selectedRecord.items?.length || 0})
                  </h3>
                  {selectedRecord.items?.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Koi medicine nahi</p>
                  ) : (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-[10px]">
                          <tr>
                            <th className="px-3 py-2">Medicine</th>
                            <th className="px-3 py-2 text-center">Qty</th>
                            <th className="px-3 py-2">Rate</th>
                            <th className="px-3 py-2">Total</th>
                            <th className="px-3 py-2">Date</th>
                            {selectedRecord.status !== 'PAID' && <th className="px-3 py-2"></th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {selectedRecord.items.map((item) => (
                            <tr key={item._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-white">
                                {item.medicineName}
                                {item.notes && <p className="text-[10px] text-slate-400 italic">{item.notes}</p>}
                              </td>
                              <td className="px-3 py-2.5 text-center text-slate-700 dark:text-slate-300">{item.quantity}</td>
                              <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">{PKR(item.unitPrice)}</td>
                              <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white">{PKR(item.totalPrice)}</td>
                              <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{fmt(item.dateTaken)}</td>
                              {selectedRecord.status !== 'PAID' && (
                                <td className="px-3 py-2.5">
                                  <button
                                    onClick={() => { if (window.confirm('Yeh item remove karo?')) removeItemMut.mutate({ id: selectedRecord._id, itemId: item._id }); }}
                                    className="text-rose-400 hover:text-rose-600 transition"
                                    title="Remove item"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-amber-50 dark:bg-amber-950/20 font-bold text-amber-700 dark:text-amber-400">
                          <tr>
                            <td colSpan={3} className="px-3 py-2 text-xs uppercase tracking-wide">Total Amount</td>
                            <td className="px-3 py-2 text-sm">{PKR(selectedRecord.totalAmount)}</td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* Payment History */}
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <CreditCard className="h-4 w-4 text-emerald-600" />
                    Payment History ({selectedRecord.payments?.length || 0})
                  </h3>
                  {selectedRecord.payments?.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Koi payment nahi aayi abhi tak</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedRecord.payments.map((p, idx) => (
                        <div key={p._id || idx} className="flex items-center gap-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{PKR(p.amount)}</p>
                            {p.note && <p className="text-[10px] text-emerald-600 dark:text-emerald-400 italic">{p.note}</p>}
                          </div>
                          <p className="text-[10px] text-slate-400 whitespace-nowrap">{fmtTime(p.paidAt)}</p>
                        </div>
                      ))}
                      <div className="flex justify-between items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Total Paid</span>
                        <span className="text-sm font-extrabold text-emerald-600">{PKR(selectedRecord.totalPaid)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════════════ */}

      {/* ── Create Udhar Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="my-6 w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-amber-600" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Naya Udhar Likho</h2>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Customer Info */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Customer Ki Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Naam *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        value={form.customerName}
                        onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))}
                        placeholder="Jaise: Ali Khan"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Mobile Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        value={form.customerPhone}
                        onChange={(e) => setForm((p) => ({ ...p, customerPhone: e.target.value }))}
                        placeholder="03xxxxxxxxx"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Address (optional)</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        value={form.customerAddress}
                        onChange={(e) => setForm((p) => ({ ...p, customerAddress: e.target.value }))}
                        placeholder="Ghar ka address"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Bill Ref (optional)</label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        value={form.billRef}
                        onChange={(e) => setForm((p) => ({ ...p, billRef: e.target.value }))}
                        placeholder="Bill number"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Notes (optional)</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    rows={2}
                    placeholder="Kuch zaruri notes..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-none resize-none"
                  />
                </div>
              </div>

              {/* Medicine Items */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Medicines</h3>
                  <button onClick={addRow} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition">
                    <Plus className="h-3 w-3" /> Row Add Karo
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 uppercase text-[10px]">
                        <th className="pb-2 text-left">Medicine Naam</th>
                        <th className="pb-2 text-left w-16">Qty</th>
                        <th className="pb-2 text-left w-24">Rate (Rs)</th>
                        <th className="pb-2 text-left w-32">Tarikh</th>
                        <th className="pb-2 text-left">Notes</th>
                        <th className="pb-2 w-6"></th>
                      </tr>
                    </thead>
                    <tbody className="space-y-2">
                      {form.items.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-50 dark:border-slate-800/50">
                          <td className="py-1.5 pr-2">
                            <input
                              value={item.medicineName}
                              onChange={(e) => setItem(idx, 'medicineName', e.target.value)}
                              placeholder="Medicine naam"
                              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:border-amber-400 focus:outline-none"
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <input
                              type="number" min={1}
                              value={item.quantity}
                              onChange={(e) => setItem(idx, 'quantity', e.target.value)}
                              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:border-amber-400 focus:outline-none"
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <input
                              type="number" min={0}
                              value={item.unitPrice}
                              onChange={(e) => setItem(idx, 'unitPrice', e.target.value)}
                              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:border-amber-400 focus:outline-none"
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <input
                              type="date"
                              value={item.dateTaken}
                              onChange={(e) => setItem(idx, 'dateTaken', e.target.value)}
                              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:border-amber-400 focus:outline-none"
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <input
                              value={item.notes}
                              onChange={(e) => setItem(idx, 'notes', e.target.value)}
                              placeholder="Note"
                              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:border-amber-400 focus:outline-none"
                            />
                          </td>
                          <td className="py-1.5">
                            {form.items.length > 1 && (
                              <button onClick={() => removeRow(idx)} className="text-rose-400 hover:text-rose-600 transition">
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Total Preview */}
                <div className="flex justify-end">
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-2 text-sm font-bold text-amber-700 dark:text-amber-300">
                    Total: {PKR(form.items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              {createMut.isError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 rounded-xl px-4 py-2">
                  {createMut.error?.response?.data?.message || 'Kuch error aayi. Dobara try karo.'}
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowCreateModal(false)} className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={createMut.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:brightness-110 disabled:opacity-60 transition"
                >
                  {createMut.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                  Udhar Save Karo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Modal ── */}
      {showPayModal && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Payment Likho</h2>
              </div>
              <button onClick={() => setShowPayModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-2xl border border-rose-100 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-950/20 p-4 text-center">
                <p className="text-xs text-rose-600 dark:text-rose-400">Baaki Raqam</p>
                <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">{PKR(selectedRecord.remainingAmount)}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Payment Amount (Rs) *</label>
                <input
                  type="number" min={1} max={selectedRecord.remainingAmount}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Kitne paisy aaye?"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-lg font-bold text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Note (optional)</label>
                <input
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="Jaise: Cash payment via hand"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              {payMut.isError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 rounded-xl px-4 py-2">
                  {payMut.error?.response?.data?.message || 'Error aayi.'}
                </p>
              )}
              <div className="flex gap-2 justify-end pt-1">
                <button onClick={() => setShowPayModal(false)} className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">Cancel</button>
                <button
                  onClick={() => payMut.mutate({ id: selectedRecord._id, amount: Number(payAmount), note: payNote })}
                  disabled={payMut.isPending || !payAmount || Number(payAmount) <= 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-60 transition"
                >
                  {payMut.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Payment Record Karo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Item Modal ── */}
      {showAddItemModal && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Medicine Add Karo</h2>
              </div>
              <button onClick={() => setShowAddItemModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: 'Medicine Naam *', field: 'medicineName', type: 'text', placeholder: 'Jaise: Panadol' },
                { label: 'Quantity *', field: 'quantity', type: 'number', placeholder: '1' },
                { label: 'Unit Price / Rate (Rs) *', field: 'unitPrice', type: 'number', placeholder: '50' },
                { label: 'Tarikh', field: 'dateTaken', type: 'date', placeholder: '' },
                { label: 'Notes (optional)', field: 'notes', type: 'text', placeholder: 'Koi note' },
              ].map((f) => (
                <div key={f.field}>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{f.label}</label>
                  <input
                    type={f.type} placeholder={f.placeholder}
                    value={newItem[f.field]}
                    min={f.type === 'number' ? 0 : undefined}
                    onChange={(e) => setNewItem((p) => ({ ...p, [f.field]: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              ))}
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 px-4 py-2 text-sm font-bold text-blue-700 dark:text-blue-300">
                Total: {PKR((Number(newItem.quantity) || 0) * (Number(newItem.unitPrice) || 0))}
              </div>
              {addItemMut.isError && (
                <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-xl px-4 py-2">
                  {addItemMut.error?.response?.data?.message || 'Error aayi.'}
                </p>
              )}
              <div className="flex gap-2 justify-end pt-1">
                <button onClick={() => setShowAddItemModal(false)} className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">Cancel</button>
                <button
                  onClick={() => addItemMut.mutate({ id: selectedRecord._id, item: { ...newItem, quantity: Number(newItem.quantity), unitPrice: Number(newItem.unitPrice) } })}
                  disabled={addItemMut.isPending || !newItem.medicineName}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:opacity-60 transition"
                >
                  {addItemMut.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add Karo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Customer Info Modal ── */}
      {showEditModal && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
              <div className="flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-slate-600" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Info Update Karo</h2>
              </div>
              <button onClick={() => setShowEditModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {[
                { label: 'Naam *', key: 'customerName', placeholder: 'Customer naam' },
                { label: 'Phone', key: 'customerPhone', placeholder: '03xxxxxxxxx' },
                { label: 'Address', key: 'customerAddress', placeholder: 'Address' },
                { label: 'Bill Ref', key: 'billRef', placeholder: 'Bill number' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{f.label}</label>
                  <input
                    value={editForm[f.key]}
                    onChange={(e) => setEditForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button onClick={() => setShowEditModal(false)} className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">Cancel</button>
                <button
                  onClick={() => updateMut.mutate({ id: selectedRecord._id, data: editForm })}
                  disabled={updateMut.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-amber-700 disabled:opacity-60 transition"
                >
                  {updateMut.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Update Karo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
