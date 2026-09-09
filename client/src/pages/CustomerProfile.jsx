import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  User,
  Mail,
  Shield,
  Calendar,
  Hash,
  Lock,
  Phone,
  Pencil,
  Check,
  ShieldCheck,
  Clock,
  Receipt,
  Bell,
  RefreshCw,
  Copy,
  LayoutDashboard,
  ArrowRight,
} from 'lucide-react';

const CustomerProfileContent = ({
  user,
  setUser,
  bills,
  billsLoading,
  reminders,
  remindersLoading,
}) => {
  const queryClient = useQueryClient();

  // ---------------------------------------
  // Initial profile values
  // ---------------------------------------
  const splitName = user?.name
    ? user.name.trim().split(/\s+/)
    : [];

  const initialFirstName =
    user?.firstName ||
    splitName[0] ||
    '';

  const initialLastName =
    user?.lastName ||
    splitName.slice(1).join(' ') ||
    '';

  const initialPhone = user?.phone || '';

  // ---------------------------------------
  // Name states
  // ---------------------------------------
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [editing, setEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [nameError, setNameError] = useState('');

  // ---------------------------------------
  // Phone states
  // ---------------------------------------
  const [phone, setPhone] = useState(initialPhone);
  const [newPhone, setNewPhone] = useState(initialPhone);
  const [editingPhone, setEditingPhone] = useState(false);
  const [pwdVerify, setPwdVerify] = useState('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [phoneSaveSuccess, setPhoneSaveSuccess] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  // ---------------------------------------
  // Copy ID state
  // ---------------------------------------
  const [copied, setCopied] = useState(false);

  // ---------------------------------------
  // Display name
  // ---------------------------------------
  const displayName =
    [firstName, lastName]
      .filter(Boolean)
      .join(' ') ||
    user?.name ||
    'User';

  // ---------------------------------------
  // Active reminders count
  // ---------------------------------------
  const activeReminders = reminders.filter(
    (reminder) => reminder.isActive
  ).length;

  // ---------------------------------------
  // Refresh customer profile data
  // ---------------------------------------
  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['bills', user?._id],
      }),
      queryClient.invalidateQueries({
        queryKey: ['reminders', user?._id],
      }),
    ]);
  };

  // ---------------------------------------
  // Copy account ID
  // ---------------------------------------
  const handleCopyId = async () => {
    if (!user?._id) return;

    try {
      await navigator.clipboard.writeText(user._id);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1400);
    } catch {
      // Clipboard may be unavailable in some browsers.
      setCopied(false);
    }
  };

  // ---------------------------------------
  // Cancel name editing
  // ---------------------------------------
  const handleCancelName = () => {
    setFirstName(initialFirstName);
    setLastName(initialLastName);
    setEditing(false);
    setNameError('');
    setSaveSuccess(false);
  };

  // ---------------------------------------
  // Save name
  // ---------------------------------------
  const handleSaveName = async () => {
    const trimFirst = firstName.trim();
    const trimLast = lastName.trim();

    if (!trimFirst) {
      setNameError('First name is required');
      return;
    }

    setIsSaving(true);
    setNameError('');

    try {
      const newName = [trimFirst, trimLast]
        .filter(Boolean)
        .join(' ');

      await api.patch('/users/profile', {
        name: newName,
      });

      setUser((prev) => ({
        ...prev,
        name: newName,
        firstName: trimFirst,
        lastName: trimLast,
      }));

      setSaveSuccess(true);

      setTimeout(() => {
        setSaveSuccess(false);
        setEditing(false);
      }, 1400);
    } catch (err) {
      setNameError(
        err?.response?.data?.message ||
          'Failed to save. Try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ---------------------------------------
  // Cancel phone editing
  // ---------------------------------------
  const handleCancelPhone = () => {
    setNewPhone(phone);
    setEditingPhone(false);
    setPhoneError('');
    setPwdVerify('');
    setPhoneSaveSuccess(false);
  };

  // ---------------------------------------
  // Save phone
  // ---------------------------------------
  const handleSavePhone = async () => {
    const trimPhone = newPhone.trim();

    if (!trimPhone) {
      setPhoneError('Phone number is required');
      return;
    }

    if (!pwdVerify) {
      setPhoneError(
        'Password is required to confirm change'
      );
      return;
    }

    setIsSavingPhone(true);
    setPhoneError('');

    try {
      await api.patch('/users/profile', {
        phone: trimPhone,
        currentPassword: pwdVerify,
      });

      setPhone(trimPhone);

      setUser((prev) => ({
        ...prev,
        phone: trimPhone,
      }));

      setPhoneSaveSuccess(true);
      setPwdVerify('');

      setTimeout(() => {
        setPhoneSaveSuccess(false);
        setEditingPhone(false);
      }, 1400);
    } catch (err) {
      if (err?.response?.status === 401) {
        setPhoneError('Incorrect password');
      } else {
        setPhoneError(
          err?.response?.data?.message ||
            'Failed to save. Try again.'
        );
      }
    } finally {
      setIsSavingPhone(false);
    }
  };

  return (
    <div className="p-4 space-y-4">

      {/* ---------------------------------
          Header
      ---------------------------------- */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-sm font-medium text-slate-900 dark:text-white">
            Customer Profile
          </h1>

          <p className="text-[10px] text-slate-400 mt-1">
            Manage your personal information and account activity
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/customer/dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md
              text-[11px] font-medium border border-slate-200
              dark:border-slate-700 text-slate-600 dark:text-slate-300
              hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Dashboard
          </Link>

          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md
              text-[11px] font-medium border border-slate-200
              dark:border-slate-700 text-slate-600 dark:text-slate-300
              hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-3 items-start">

        {/* ---------------------------------
            LEFT PANEL
        ---------------------------------- */}
        <div className="space-y-3">

          {/* Identity Card */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200
            dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">

            <div className="h-14 bg-gradient-to-br from-[#1A56A0] to-[#0ea5e9]" />

            <div className="flex justify-center -mt-6 relative z-10">
              <div
                className="w-12 h-12 rounded-full border-[3px]
                  border-white dark:border-[#111827]
                  bg-[#1A56A0] flex items-center justify-center
                  text-sm font-semibold text-white flex-shrink-0
                  select-none"
              >
                {displayName?.[0]?.toUpperCase() || 'U'}
              </div>
            </div>

            <div className="px-4 pb-4 pt-2 text-center">
              <h2
                className="text-sm font-medium dark:text-white
                  text-slate-900 mb-1 truncate"
                title={displayName}
              >
                {displayName}
              </h2>

              <span
                className="inline-flex items-center gap-1 text-[10px]
                  font-medium px-2 py-0.5 rounded bg-blue-50
                  text-blue-800 dark:bg-blue-950/40
                  dark:text-blue-300 mb-3"
              >
                <User className="w-2.5 h-2.5" />
                Customer Portal
              </span>

              <div className="h-px bg-slate-100 dark:bg-slate-800 mb-3" />

              {/* ---------------------------------
                  Clickable Stats
              ---------------------------------- */}
              <div className="grid grid-cols-2 gap-2 mb-3">

                {/* Invoices */}
                <Link
                  to="/customer/bills"
                  className="bg-slate-50 dark:bg-slate-800 rounded-lg
                    p-2 text-center hover:bg-blue-50
                    dark:hover:bg-blue-950/30 transition-colors group"
                >
                  <div className="flex justify-center mb-1">
                    <Receipt
                      className="w-3.5 h-3.5 text-blue-500"
                    />
                  </div>

                  <p className="text-sm font-medium dark:text-white text-slate-900">
                    {billsLoading ? '...' : bills.length}
                  </p>

                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Invoices
                  </p>

                  <span
                    className="text-[9px] text-blue-600
                      dark:text-blue-400 opacity-0
                      group-hover:opacity-100 transition-opacity"
                  >
                    View
                  </span>
                </Link>

                {/* Reminders */}
                <Link
                  to="/customer/reminders"
                  className="bg-slate-50 dark:bg-slate-800 rounded-lg
                    p-2 text-center hover:bg-blue-50
                    dark:hover:bg-blue-950/30 transition-colors group"
                >
                  <div className="flex justify-center mb-1">
                    <Bell
                      className="w-3.5 h-3.5 text-amber-500"
                    />
                  </div>

                  <p className="text-sm font-medium dark:text-white text-slate-900">
                    {remindersLoading ? '...' : activeReminders}
                  </p>

                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Active reminders
                  </p>

                  <span
                    className="text-[9px] text-blue-600
                      dark:text-blue-400 opacity-0
                      group-hover:opacity-100 transition-opacity"
                  >
                    Manage
                  </span>
                </Link>
              </div>

              {/* Account Status */}
              <div
                className="flex items-center justify-between px-3 py-2
                  rounded-lg bg-slate-50 dark:bg-slate-800"
              >
                <span className="text-[11px] text-slate-500">
                  Account status
                </span>

                <span
                  className="flex items-center gap-1.5
                    text-[11px] font-medium text-emerald-500"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Active
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div
            className="bg-white dark:bg-[#111827]
              border border-slate-200 dark:border-slate-800
              rounded-xl p-3 shadow-sm"
          >
            <p className="text-[11px] font-medium text-slate-700 dark:text-slate-200 mb-2">
              Quick actions
            </p>

            <div className="space-y-2">

              <Link
                to="/customer/bills"
                className="flex items-center justify-between
                  w-full px-3 py-2 rounded-lg
                  bg-slate-50 dark:bg-slate-800
                  hover:bg-blue-50 dark:hover:bg-blue-950/30
                  transition-colors"
              >
                <span className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300">
                  <Receipt className="w-3.5 h-3.5 text-blue-500" />
                  View all invoices
                </span>

                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>

              <Link
                to="/customer/reminders"
                className="flex items-center justify-between
                  w-full px-3 py-2 rounded-lg
                  bg-slate-50 dark:bg-slate-800
                  hover:bg-blue-50 dark:hover:bg-blue-950/30
                  transition-colors"
              >
                <span className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300">
                  <Bell className="w-3.5 h-3.5 text-amber-500" />
                  Manage reminders
                </span>

                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
            </div>
          </div>
        </div>

        {/* ---------------------------------
            RIGHT PANEL
        ---------------------------------- */}
        <div className="space-y-3">

          {/* Account Details */}
          <div
            className="bg-white dark:bg-[#111827]
              border border-slate-200 dark:border-slate-800
              rounded-xl overflow-hidden shadow-sm"
          >
            <div
              className="px-4 py-2.5 border-b
                border-slate-100 dark:border-slate-800
                flex items-center justify-between"
            >
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                Account details
              </span>

              <span className="text-[10px] text-slate-400">
                Personal information
              </span>
            </div>

            <div className="grid grid-cols-2">

              {/* Full Name */}
              <div
                className="p-3 border-b
                  border-slate-100 dark:border-slate-800
                  col-span-2"
              >
                <span
                  className="text-[10px] font-medium
                    tracking-wider uppercase text-slate-400
                    mb-1.5 flex items-center gap-1"
                >
                  <User className="w-2.5 h-2.5" />
                  Full Name
                </span>

                {!editing ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-800 dark:text-slate-100">
                      {displayName}
                    </span>

                    <button
                      onClick={() => setEditing(true)}
                      className="w-5 h-5 flex items-center justify-center
                        rounded border border-slate-200
                        dark:border-slate-700 text-slate-400
                        hover:bg-blue-50 hover:text-[#1A56A0]
                        hover:border-[#1A56A0]
                        dark:hover:bg-blue-950/40
                        dark:hover:text-blue-400 transition-all"
                      aria-label="Edit name"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={firstName}
                        onChange={(e) =>
                          setFirstName(e.target.value)
                        }
                        placeholder="First name"
                        className="text-xs px-2.5 py-1.5 rounded-md
                          border border-slate-200 dark:border-slate-700
                          bg-slate-50 dark:bg-slate-800
                          text-slate-800 dark:text-slate-100
                          outline-none focus:border-[#1A56A0]
                          focus:ring-1 focus:ring-[#1A56A0]/20"
                      />

                      <input
                        value={lastName}
                        onChange={(e) =>
                          setLastName(e.target.value)
                        }
                        placeholder="Last name"
                        className="text-xs px-2.5 py-1.5 rounded-md
                          border border-slate-200 dark:border-slate-700
                          bg-slate-50 dark:bg-slate-800
                          text-slate-800 dark:text-slate-100
                          outline-none focus:border-[#1A56A0]
                          focus:ring-1 focus:ring-[#1A56A0]/20"
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={handleSaveName}
                        disabled={isSaving}
                        className="px-3 py-1 rounded-md
                          text-[11px] font-medium text-white
                          bg-[#1A56A0] hover:bg-[#1e63b8]
                          disabled:opacity-50 transition-colors"
                      >
                        {isSaving
                          ? 'Saving…'
                          : 'Save changes'}
                      </button>

                      <button
                        onClick={handleCancelName}
                        className="px-2.5 py-1 rounded-md
                          text-[11px] border
                          border-slate-200 dark:border-slate-700
                          text-slate-500 hover:bg-slate-50
                          dark:hover:bg-slate-800
                          transition-colors"
                      >
                        Cancel
                      </button>

                      {saveSuccess && (
                        <span className="text-[11px] text-emerald-500 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Saved!
                        </span>
                      )}

                      {nameError && (
                        <span className="text-[11px] text-red-400">
                          {nameError}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Phone */}
              <div
                className="p-3 border-b
                  border-slate-100 dark:border-slate-800
                  col-span-2"
              >
                <span
                  className="text-[10px] font-medium
                    tracking-wider uppercase text-slate-400
                    mb-1.5 flex items-center gap-1"
                >
                  <Phone className="w-2.5 h-2.5" />
                  Phone Number
                </span>

                {!editingPhone ? (
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs ${
                        phone
                          ? 'text-slate-800 dark:text-slate-100'
                          : 'text-slate-400'
                      }`}
                    >
                      {phone || 'Not set'}
                    </span>

                    <button
                      onClick={() => {
                        setEditingPhone(true);
                        setNewPhone(phone);
                      }}
                      className="w-5 h-5 flex items-center justify-center
                        rounded border border-slate-200
                        dark:border-slate-700 text-slate-400
                        hover:bg-blue-50 hover:text-[#1A56A0]
                        hover:border-[#1A56A0]
                        dark:hover:bg-blue-950/40
                        transition-all"
                      aria-label="Edit phone number"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 mt-2">

                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e) =>
                        setNewPhone(e.target.value)
                      }
                      placeholder="+92 XXXXX XXXXX"
                      className="text-xs px-2.5 py-1.5 rounded-md
                        border border-slate-200 dark:border-slate-700
                        bg-slate-50 dark:bg-slate-800
                        text-slate-800 dark:text-slate-100
                        outline-none focus:border-[#1A56A0]
                        focus:ring-1 focus:ring-[#1A56A0]/20"
                    />

                    <div
                      className="flex items-center gap-2 px-2.5 py-2
                        rounded-md bg-amber-50
                        dark:bg-amber-950/20
                        border border-amber-100
                        dark:border-amber-900/30
                        text-[10px] text-amber-700
                        dark:text-amber-400"
                    >
                      <Lock className="w-3 h-3 flex-shrink-0" />
                      Confirm your current password to update phone number
                    </div>

                    <input
                      type="password"
                      value={pwdVerify}
                      onChange={(e) =>
                        setPwdVerify(e.target.value)
                      }
                      placeholder="Current password"
                      className="text-xs px-2.5 py-1.5 rounded-md
                        border border-amber-200
                        dark:border-amber-850/50
                        bg-slate-50 dark:bg-slate-800
                        text-slate-800 dark:text-slate-100
                        outline-none focus:border-amber-400
                        focus:ring-1 focus:ring-amber-400/20"
                    />

                    <div className="flex items-center gap-2 flex-wrap">

                      <button
                        onClick={handleSavePhone}
                        disabled={isSavingPhone}
                        className="px-3 py-1 rounded-md
                          text-[11px] font-medium text-white
                          bg-[#1A56A0] hover:bg-[#1e63b8]
                          disabled:opacity-50 transition-colors"
                      >
                        {isSavingPhone
                          ? 'Verifying…'
                          : 'Verify & save'}
                      </button>

                      <button
                        onClick={handleCancelPhone}
                        className="px-2.5 py-1 rounded-md
                          text-[11px] border
                          border-slate-200 dark:border-slate-700
                          text-slate-500 hover:bg-slate-50
                          dark:hover:bg-slate-800
                          transition-colors"
                      >
                        Cancel
                      </button>

                      {phoneSaveSuccess && (
                        <span className="text-[11px] text-emerald-500 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Saved!
                        </span>
                      )}

                      {phoneError && (
                        <span className="text-[11px] text-red-400">
                          {phoneError}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Email */}
              <div
                className="p-3 border-b border-r
                  border-slate-100 dark:border-slate-800"
              >
                <span
                  className="text-[10px] font-medium
                    tracking-wider uppercase text-slate-400
                    mb-1.5 flex items-center gap-1"
                >
                  <Mail className="w-2.5 h-2.5" />
                  Email address
                </span>

                <p
                  className="text-xs text-slate-800
                    dark:text-slate-100 truncate"
                  title={user.email}
                >
                  {user.email}
                </p>
              </div>

              {/* Role */}
              <div
                className="p-3 border-b
                  border-slate-100 dark:border-slate-800"
              >
                <span
                  className="text-[10px] font-medium
                    tracking-wider uppercase text-slate-400
                    mb-1.5 flex items-center gap-1"
                >
                  <Shield className="w-2.5 h-2.5" />
                  Role authority
                </span>

                <span
                  className="inline-flex items-center gap-1
                    text-[11px] font-medium px-2 py-0.5 rounded
                    bg-blue-50 text-blue-800
                    dark:bg-blue-950/40
                    dark:text-blue-300"
                >
                  Customer
                </span>
              </div>

              {/* Registered */}
              <div
                className="p-3 border-r
                  border-slate-150 dark:border-slate-800"
              >
                <span
                  className="text-[10px] font-medium
                    tracking-wider uppercase text-slate-400
                    mb-1.5 flex items-center gap-1"
                >
                  <Calendar className="w-2.5 h-2.5" />
                  Registered on
                </span>

                <p className="text-xs text-slate-800 dark:text-slate-100">
                  {user.createdAt
                    ? new Date(
                        user.createdAt
                      ).toLocaleDateString(
                        undefined,
                        {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        }
                      )
                    : 'Just now'}
                </p>
              </div>

              {/* Account ID */}
              <div className="p-3">
                <span
                  className="text-[10px] font-medium
                    tracking-wider uppercase text-slate-400
                    mb-1.5 flex items-center gap-1"
                >
                  <Hash className="w-2.5 h-2.5" />
                  Account ID
                </span>

                <div className="flex items-center gap-2">
                  <p
                    className="text-[10px] font-mono
                      text-slate-400 select-all truncate"
                    title={user._id}
                  >
                    {user._id}
                  </p>

                  <button
                    onClick={handleCopyId}
                    className="flex-shrink-0 w-6 h-6
                      flex items-center justify-center rounded
                      border border-slate-200
                      dark:border-slate-700
                      text-slate-400 hover:text-[#1A56A0]
                      hover:bg-blue-50
                      dark:hover:bg-blue-950/30
                      transition-colors"
                    aria-label="Copy account ID"
                  >
                    {copied ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ---------------------------------
              Related Activity
          ---------------------------------- */}
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >

            {/* Invoices */}
            <div
              className="bg-white dark:bg-[#111827]
                border border-slate-200 dark:border-slate-800
                rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-7 h-7 rounded-lg
                        flex items-center justify-center
                        bg-blue-50 text-blue-600
                        dark:bg-blue-950/30 dark:text-blue-400"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                    </div>

                    <p className="text-xs font-medium text-slate-800 dark:text-white">
                      Invoice history
                    </p>
                  </div>

                  <p className="text-[10px] text-slate-400">
                    View all purchases and invoice details.
                  </p>
                </div>

                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {billsLoading ? '...' : bills.length}
                </span>
              </div>

              <Link
                to="/customer/bills"
                className="mt-3 inline-flex items-center gap-1.5
                  px-3 py-1.5 rounded-md text-[11px]
                  font-medium text-white bg-[#1A56A0]
                  hover:bg-[#1e63b8] transition-colors"
              >
                View invoices
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Reminders */}
            <div
              className="bg-white dark:bg-[#111827]
                border border-slate-200 dark:border-slate-800
                rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-7 h-7 rounded-lg
                        flex items-center justify-center
                        bg-amber-50 text-amber-600
                        dark:bg-amber-950/30
                        dark:text-amber-400"
                    >
                      <Bell className="w-3.5 h-3.5" />
                    </div>

                    <p className="text-xs font-medium text-slate-800 dark:text-white">
                      Medicine reminders
                    </p>
                  </div>

                  <p className="text-[10px] text-slate-400">
                    Manage active medicine reminder schedules.
                  </p>
                </div>

                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {remindersLoading
                    ? '...'
                    : activeReminders}
                </span>
              </div>

              <Link
                to="/customer/reminders"
                className="mt-3 inline-flex items-center gap-1.5
                  px-3 py-1.5 rounded-md text-[11px]
                  font-medium border border-slate-200
                  dark:border-slate-700
                  text-slate-700 dark:text-slate-200
                  hover:bg-slate-50 dark:hover:bg-slate-800
                  transition-colors"
              >
                Manage reminders
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* ---------------------------------
              Account Safety
          ---------------------------------- */}
          <div
            className="bg-white dark:bg-[#111827]
              border border-slate-200 dark:border-slate-800
              rounded-xl overflow-hidden shadow-sm"
          >
            <div
              className="px-4 py-2.5 border-b
                border-slate-100 dark:border-slate-800
                flex items-center justify-between"
            >
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                Account safety
              </span>

              <span className="text-[10px] text-slate-400">
                Security status
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">

              {/* Security */}
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-lg
                      flex items-center justify-center flex-shrink-0
                      bg-emerald-50 text-emerald-700
                      dark:bg-emerald-950/30
                      dark:text-emerald-400"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>

                  <div>
                    <p className="text-xs font-medium dark:text-white text-slate-805">
                      Your account is secure
                    </p>

                    <p className="text-[10px] text-slate-400 mt-0.5">
                      You are logged in and your session is protected
                    </p>
                  </div>
                </div>

                <span
                  className="text-[10px] font-medium px-2 py-0.5
                    rounded bg-emerald-50 text-emerald-800
                    dark:bg-emerald-950/30
                    dark:text-emerald-400"
                >
                  Active
                </span>
              </div>

              {/* Password */}
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-lg
                      flex items-center justify-center flex-shrink-0
                      bg-blue-50 text-blue-700
                      dark:bg-blue-950/40
                      dark:text-blue-400"
                  >
                    <Lock className="w-3.5 h-3.5" />
                  </div>

                  <div>
                    <p className="text-xs font-medium dark:text-white text-slate-805">
                      Password protected
                    </p>

                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Your password is stored securely
                    </p>
                  </div>
                </div>

                <span
                  className="text-[10px] font-medium px-2 py-0.5
                    rounded bg-blue-50 text-blue-800
                    dark:bg-blue-950/40
                    dark:text-blue-300"
                >
                  Protected
                </span>
              </div>

              {/* Session */}
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-lg
                      flex items-center justify-center flex-shrink-0
                      bg-slate-100 text-slate-500
                      dark:bg-slate-800
                      dark:text-slate-400"
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </div>

                  <div>
                    <p className="text-xs font-medium dark:text-white text-slate-805">
                      Session protection
                    </p>

                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Your authenticated session is protected
                    </p>
                  </div>
                </div>

                <span
                  className="text-[10px] font-medium px-2 py-0.5
                    rounded bg-slate-100 text-slate-600
                    dark:bg-slate-800 dark:text-slate-400"
                >
                  Enabled
                </span>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

const CustomerProfile = () => {
  const { user, setUser } = useAuth();

  const {
    data: bills = [],
    isLoading: billsLoading,
  } = useQuery({
    queryKey: ['bills', user?._id],
    queryFn: async () => {
      const { data } = await api.get(
        `/bills/customer/${user._id}`
      );

      return Array.isArray(data) ? data : [];
    },
    enabled: !!user?._id,
  });

  const {
    data: reminders = [],
    isLoading: remindersLoading,
  } = useQuery({
    queryKey: ['reminders', user?._id],
    queryFn: async () => {
      const { data } = await api.get(
        `/notifications/reminders/customer/${user._id}`
      );

      return Array.isArray(data) ? data : [];
    },
    enabled: !!user?._id,
  });

  if (!user) {
    return (
      <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500">
        Loading profile...
      </div>
    );
  }

  return (
    <CustomerProfileContent
      key={user._id}
      user={user}
      setUser={setUser}
      bills={bills}
      billsLoading={billsLoading}
      reminders={reminders}
      remindersLoading={remindersLoading}
    />
  );
};

export default CustomerProfile;