import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import useBrowserNotifications from '../hooks/useBrowserNotifications';
import {
  Bell,
  Phone,
  Clock,
  Plus,
  Trash2,
  AlertCircle,
  History,
  RefreshCw,
  BellRing,
  Mail,
  Globe,
  MessageSquare,
  CheckCircle2,
  XCircle,
  CalendarClock,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

const convertTo12Hour = (time24) => {
  if (!time24) return '10:00 AM';

  const [hourStr, minStr] = time24.split(':');

  let hour = parseInt(hourStr, 10);
  const minute = minStr || '00';

  if (Number.isNaN(hour)) {
    return '10:00 AM';
  }

  const ampm = hour >= 12 ? 'PM' : 'AM';

  hour = hour % 12;
  hour = hour || 12;

  const displayHour = hour < 10
    ? `0${hour}`
    : `${hour}`;

  return `${displayHour}:${minute} ${ampm}`;
};

const convertTo24Hour = (time12) => {
  if (!time12) return '10:00';

  const match = time12.match(
    /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
  );

  if (!match) {
    return '10:00';
  }

  let hour = parseInt(match[1], 10);
  const minute = match[2];
  const period = match[3].toUpperCase();

  if (Number.isNaN(hour)) {
    return '10:00';
  }

  if (period === 'AM' && hour === 12) {
    hour = 0;
  } else if (period === 'PM' && hour !== 12) {
    hour += 12;
  }

  const displayHour = hour < 10
    ? `0${hour}`
    : `${hour}`;

  return `${displayHour}:${minute}`;
};

const timeOptions = [
  '08:00 AM',
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '02:00 PM',
  '04:00 PM',
  '06:00 PM',
  '08:00 PM',
  '10:00 PM',
];

const CustomerReminders = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { requestPermission } = useBrowserNotifications();

  // --------------------------------------------------
  // Browser notification permission
  // --------------------------------------------------
  const [notifPermission, setNotifPermission] = useState(
    typeof window !== 'undefined' &&
      'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );

  // --------------------------------------------------
  // Form state
  // null means "use profile phone as fallback"
  // empty string means user intentionally cleared it
  // --------------------------------------------------
  const [medicineName, setMedicineName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [time, setTime] = useState('10:00 AM');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // --------------------------------------------------
  // Reminders
  // --------------------------------------------------
  const {
    data: reminders = [],
    isLoading: remindersLoading,
    isError: remindersError,
    refetch: refetchReminders,
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

  // --------------------------------------------------
  // Medicines catalog
  // --------------------------------------------------
  const {
    data: medicines = [],
    isLoading: medicinesLoading,
  } = useQuery({
    queryKey: ['medicinesList'],
    queryFn: async () => {
      const { data } = await api.get('/medicines');

      return Array.isArray(data) ? data : [];
    },
    enabled: !!user?._id,
  });

  // --------------------------------------------------
  // Current user profile
  // --------------------------------------------------
  const {
    data: userProfile,
    isLoading: profileLoading,
  } = useQuery({
    queryKey: ['userProfile', user?._id],
    queryFn: async () => {
      const { data } = await api.get('/auth/me');

      return data;
    },
    enabled: !!user?._id,
  });

  // --------------------------------------------------
  // Effective phone
  // --------------------------------------------------
  const profilePhone =
    userProfile?.phone ||
    user?.phone ||
    '';

  const effectivePhone =
    phoneNumber !== null
      ? phoneNumber
      : profilePhone;

  // --------------------------------------------------
  // Notification logs
  // --------------------------------------------------
  const {
    data: logs = [],
    isLoading: logsLoading,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ['notificationLogs', user?._id],
    queryFn: async () => {
      const { data } = await api.get(
        `/notifications/${user._id}`
      );

      return Array.isArray(data) ? data : [];
    },
    enabled: !!user?._id,
  });

  // --------------------------------------------------
  // Create reminder
  // --------------------------------------------------
  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(
        '/notifications/reminders',
        payload
      );

      return data;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['reminders', user?._id],
      });

      queryClient.invalidateQueries({
        queryKey: ['notificationLogs', user?._id],
      });

      setMedicineName('');
      setFormError('');

      setFormSuccess(
        'Medication reminder successfully created.'
      );

      setTimeout(() => {
        setFormSuccess('');
      }, 3000);
    },

    onError: (err) => {
      setFormSuccess('');

      setFormError(
        err?.response?.data?.message ||
          'Failed to create reminder. Please try again.'
      );

      setTimeout(() => {
        setFormError('');
      }, 4000);
    },
  });

  // --------------------------------------------------
  // Update reminder
  // --------------------------------------------------
  const updateMutation = useMutation({
    mutationFn: async ({
      reminderId,
      isActive,
      time: reminderTime,
    }) => {
      const { data } = await api.put(
        `/customers/${user._id}/reminders`,
        {
          reminderId,
          isActive,
          time: reminderTime,
        }
      );

      return data;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['reminders', user?._id],
      });

      queryClient.invalidateQueries({
        queryKey: ['notificationLogs', user?._id],
      });
    },

    onError: (err) => {
      window.alert(
        err?.response?.data?.message ||
          'Failed to update reminder settings.'
      );
    },
  });

  // --------------------------------------------------
  // Delete reminder
  // --------------------------------------------------
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { data } = await api.delete(
        `/notifications/reminders/${id}`
      );

      return data;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['reminders', user?._id],
      });

      queryClient.invalidateQueries({
        queryKey: ['notificationLogs', user?._id],
      });
    },

    onError: (err) => {
      window.alert(
        err?.response?.data?.message ||
          'Failed to delete reminder.'
      );
    },
  });

  // --------------------------------------------------
  // Create reminder
  // --------------------------------------------------
  const handleCreateReminder = (e) => {
    e.preventDefault();

    setFormError('');
    setFormSuccess('');

    const cleanMedicineName = medicineName.trim();
    const cleanPhone = String(
      effectivePhone || ''
    ).trim();

    if (!cleanMedicineName) {
      setFormError(
        'Please select a medicine.'
      );
      return;
    }

    if (!cleanPhone) {
      setFormError(
        'Please enter a mobile number or add it in your profile.'
      );
      return;
    }

    createMutation.mutate({
      medicineName: cleanMedicineName,
      phoneNumber: cleanPhone,
      time,
    });
  };

  // --------------------------------------------------
  // Toggle reminder
  // --------------------------------------------------
  const handleToggleActive = (reminder) => {
    updateMutation.mutate({
      reminderId: reminder._id,
      isActive: !reminder.isActive,
      time: reminder.time,
    });
  };

  // --------------------------------------------------
  // Change reminder time
  // --------------------------------------------------
  const handleTimeChange = (
    reminder,
    newTime
  ) => {
    if (!newTime) return;

    updateMutation.mutate({
      reminderId: reminder._id,
      isActive: reminder.isActive,
      time: convertTo12Hour(newTime),
    });
  };

  // --------------------------------------------------
  // Delete reminder
  // --------------------------------------------------
  const handleDeleteReminder = (id) => {
    const confirmed = window.confirm(
      'Delete this reminder? You will no longer receive alerts for it.'
    );

    if (confirmed) {
      deleteMutation.mutate(id);
    }
  };

  // --------------------------------------------------
  // Browser permission
  // --------------------------------------------------
  const handleEnableNotifications = async () => {
    try {
      const result = await requestPermission();

      setNotifPermission(
        result || 'default'
      );
    } catch {
      setNotifPermission('denied');
    }
  };

  // --------------------------------------------------
  // Quick time selection
  // --------------------------------------------------
  const handleQuickTime = (selectedTime) => {
    setTime(selectedTime);
  };

  // --------------------------------------------------
  // Log badge
  // --------------------------------------------------
  const getTypeBadge = (type) => {
    switch (type) {
      case 'Email':
        return {
          icon: Mail,
          className:
            'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
        };

      case 'Browser':
        return {
          icon: Globe,
          className:
            'bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400',
        };

      case 'SMS':
        return {
          icon: MessageSquare,
          className:
            'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400',
        };

      default:
        return {
          icon: Bell,
          className:
            'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-300',
        };
    }
  };

  const activeReminderCount = reminders.filter(
    (reminder) => reminder.isActive
  ).length;

  const inactiveReminderCount =
    reminders.length -
    activeReminderCount;

  return (
    <div className="space-y-4 p-4 max-w-7xl mx-auto transition-colors duration-200">

      {/* =================================================
          HEADER
      ================================================= */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#1A56A0]/10 dark:bg-sky-500/10 flex items-center justify-center">
              <BellRing className="w-4 h-4 text-[#1A56A0] dark:text-sky-400" />
            </div>

            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Medication Reminders
              </h1>

              <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                Create, manage and monitor your medication alert schedules.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/customer/profile"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg
              border border-slate-200 dark:border-slate-700
              text-[11px] font-semibold
              text-slate-600 dark:text-slate-300
              hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Profile
            <ChevronRight className="w-3 h-3" />
          </Link>

          <button
            type="button"
            onClick={() => {
              refetchReminders();
              refetchLogs();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg
              bg-[#1A56A0] hover:bg-[#154b89]
              text-white text-[11px] font-semibold transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* =================================================
          SUMMARY CARDS
      ================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        <div className="bg-white dark:bg-[#1a2438] rounded-xl border border-slate-200 dark:border-slate-700/50 p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Total reminders
              </p>

              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {reminders.length}
              </p>
            </div>

            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a2438] rounded-xl border border-slate-200 dark:border-slate-700/50 p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Active
              </p>

              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {activeReminderCount}
              </p>
            </div>

            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a2438] rounded-xl border border-slate-200 dark:border-slate-700/50 p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Paused
              </p>

              <p className="text-xl font-bold text-slate-600 dark:text-slate-300 mt-1">
                {inactiveReminderCount}
              </p>
            </div>

            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <XCircle className="w-4 h-4 text-slate-500" />
            </div>
          </div>
        </div>
      </div>

      {/* =================================================
          EMAIL / BROWSER NOTIFICATION INFO
      ================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

        {/* Email */}
        <div className="bg-white dark:bg-[#1a2438] border border-slate-200 dark:border-slate-700/50 rounded-xl p-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                Email reminder channel
              </p>

              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Your account email can be used by the backend to deliver medication reminder emails.
              </p>

              <div className="mt-2 px-2.5 py-1.5 rounded-md bg-slate-50 dark:bg-slate-900/50 text-[10px] text-slate-600 dark:text-slate-300 truncate">
                {user?.email || 'No email available'}
              </div>
            </div>
          </div>
        </div>

        {/* Browser */}
        <div className="bg-white dark:bg-[#1a2438] border border-slate-200 dark:border-slate-700/50 rounded-xl p-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center flex-shrink-0">
              <Globe className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                Browser notifications
              </p>

              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Receive reminders directly in your browser when permission is enabled.
              </p>

              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold ${
                    notifPermission === 'granted'
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {notifPermission === 'granted'
                    ? 'Enabled'
                    : notifPermission === 'unsupported'
                      ? 'Unsupported'
                      : 'Not enabled'}
                </span>

                {notifPermission !== 'granted' &&
                  notifPermission !== 'unsupported' &&
                  notifPermission !== 'denied' && (
                    <button
                      type="button"
                      onClick={handleEnableNotifications}
                      className="px-2.5 py-1 rounded-md bg-[#1A56A0] text-white text-[9px] font-semibold hover:bg-[#154b89]"
                    >
                      Enable
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =================================================
          PERMISSION BANNER
      ================================================= */}
      {notifPermission !== 'granted' &&
        notifPermission !== 'unsupported' && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-800/40 flex items-center justify-center shrink-0">
                <BellRing className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Enable Browser Notifications
                </p>

                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {notifPermission === 'denied'
                    ? 'Notifications are blocked. Please enable them from browser site settings.'
                    : 'Get medication alerts even when you are viewing another tab.'}
                </p>
              </div>
            </div>

            {notifPermission !== 'denied' && (
              <button
                type="button"
                onClick={handleEnableNotifications}
                className="px-4 py-2 bg-[#1A56A0] hover:bg-[#154b89]
                  text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
              >
                Enable Now
              </button>
            )}
          </div>
        )}

      {/* =================================================
          ACTIVE CHANNELS
      ================================================= */}
      <div className="flex flex-wrap items-center gap-2.5 text-[10px]">
        <span className="text-slate-400 dark:text-slate-500 font-medium">
          Notification channels:
        </span>

        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/30 font-semibold">
          <Mail className="w-3 h-3" />
          Email
        </span>

        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full font-semibold ${
            notifPermission === 'granted'
              ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-700/30'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <Globe className="w-3 h-3" />
          Browser
        </span>

        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-semibold">
          <Phone className="w-3 h-3" />
          Mobile number
        </span>
      </div>

      {/* =================================================
          MAIN CONTENT
      ================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* =================================================
            CREATE REMINDER
        ================================================= */}
        <div className="bg-white dark:bg-[#1a2438] p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm h-max">

          <div className="flex items-center justify-between gap-2 border-b border-slate-150 dark:border-slate-700/50 pb-3 mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#1A56A0] dark:text-sky-400" />
              Create Reminder
            </h2>

            <CalendarClock className="w-4 h-4 text-slate-400" />
          </div>

          {/* Success */}
          {formSuccess && (
            <div className="mb-3 p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          {/* Error */}
          {formError && (
            <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <form
            onSubmit={handleCreateReminder}
            className="space-y-4"
          >

            {/* Medicine */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                Medicine Name *
              </label>

              <select
                required
                value={medicineName}
                onChange={(e) =>
                  setMedicineName(e.target.value)
                }
                disabled={medicinesLoading}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0C1628]
                  border border-slate-200 dark:border-slate-700/60
                  text-slate-900 dark:text-white
                  focus:outline-none focus:border-[#1A56A0]
                  dark:focus:border-sky-400
                  text-xs disabled:opacity-60"
              >
                <option value="">
                  {medicinesLoading
                    ? 'Loading medicines...'
                    : 'Select a medicine...'}
                </option>

                {medicines.map((med) => (
                  <option
                    key={med._id}
                    value={med.name}
                  >
                    {med.name}
                    {med.genericName
                      ? ` (${med.genericName})`
                      : ''}
                  </option>
                ))}
              </select>

              {!medicinesLoading &&
                medicines.length === 0 && (
                  <p className="mt-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                    No medicines are currently available in the catalog.
                  </p>
                )}
            </div>

            {/* Phone */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Mobile Number *
                </label>

                <Link
                  to="/customer/profile"
                  className="text-[9px] text-[#1A56A0] dark:text-sky-400 font-semibold hover:underline"
                >
                  Edit profile
                </Link>
              </div>

              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />

                <input
                  type="tel"
                  required
                  value={effectivePhone}
                  onChange={(e) =>
                    setPhoneNumber(e.target.value)
                  }
                  placeholder="+92 XXXXX XXXXX"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0C1628]
                    border border-slate-200 dark:border-slate-700/60
                    text-slate-900 dark:text-white
                    placeholder-slate-400 dark:placeholder-slate-500
                    focus:outline-none focus:border-[#1A56A0]
                    dark:focus:border-sky-400 text-xs"
                />
              </div>

              {profileLoading && !effectivePhone && (
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Loading saved phone number...
                </p>
              )}

              {!profileLoading &&
                !profilePhone && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5 leading-normal">
                    Add your phone number in{' '}
                    <Link
                      to="/customer/profile"
                      className="underline font-semibold text-[#1A56A0] dark:text-sky-400"
                    >
                      My Profile
                    </Link>{' '}
                    to use it automatically.
                  </p>
                )}
            </div>

            {/* Schedule */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                Notification Schedule *
              </label>

              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />

                <input
                  type="time"
                  required
                  value={convertTo24Hour(time)}
                  onChange={(e) =>
                    setTime(
                      convertTo12Hour(
                        e.target.value
                      )
                    )
                  }
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0C1628]
                    border border-slate-200 dark:border-slate-700/60
                    text-slate-900 dark:text-white
                    text-xs focus:outline-none
                    focus:border-[#1A56A0]
                    dark:focus:border-sky-400"
                />
              </div>

              {/* Quick time buttons */}
              <div className="mt-2">
                <p className="text-[9px] text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">
                  Quick times
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {timeOptions.map(
                    (option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() =>
                          handleQuickTime(
                            option
                          )
                        }
                        className={`px-2 py-1 rounded-md border text-[9px] font-semibold transition-colors ${
                          time === option
                            ? 'bg-[#1A56A0] text-white border-[#1A56A0]'
                            : 'bg-slate-50 dark:bg-[#0C1628] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-[#1A56A0] hover:text-[#1A56A0]'
                        }`}
                      >
                        {option}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={
                createMutation.isPending ||
                medicinesLoading ||
                medicines.length === 0
              }
              className="w-full py-2.5 bg-[#1A56A0]
                hover:bg-[#154b89]
                text-white font-semibold rounded-lg shadow-sm
                transition-all text-xs flex items-center
                justify-center gap-1.5
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  Create Reminder
                </>
              )}
            </button>
          </form>

          {/* Email information */}
          <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />

              <div>
                <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                  Reminder delivery
                </p>

                <p className="text-[9px] text-blue-600/80 dark:text-blue-300/70 mt-1 leading-relaxed">
                  The reminder schedule is saved in the system. Email delivery is handled by the backend notification service.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================
            RIGHT COLUMN
        ================================================= */}
        <div className="lg:col-span-2 space-y-4">

          {/* =================================================
              REMINDER LIST
          ================================================= */}
          <div className="bg-white dark:bg-[#1a2438] p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm">

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#1A56A0] dark:text-sky-400" />
                  Medication Alarm Panel
                </h3>

                <p className="text-[9px] text-slate-400 mt-1">
                  Manage reminder status and schedules.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  refetchReminders()
                }
                className="self-start sm:self-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-[9px] font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
            </div>

            {remindersLoading ? (
              <div className="py-10 flex flex-col items-center justify-center">
                <div className="w-6 h-6 border-2 border-slate-200 dark:border-slate-700 border-t-[#1A56A0] rounded-full animate-spin" />
                <p className="text-[10px] text-slate-400 mt-2">
                  Loading reminders...
                </p>
              </div>
            ) : remindersError ? (
              <div className="py-10 text-center">
                <AlertCircle className="w-6 h-6 text-red-400 mx-auto" />

                <p className="text-xs text-red-500 dark:text-red-400 mt-2">
                  Failed to load reminders.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    refetchReminders()
                  }
                  className="mt-2 px-3 py-1.5 rounded-md bg-[#1A56A0] text-white text-[10px] font-semibold"
                >
                  Try again
                </button>
              </div>
            ) : reminders.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                <Bell className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto" />

                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
                  No reminders configured
                </p>

                <p className="text-[9px] text-slate-400 mt-1">
                  Create your first medication reminder from the form.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {reminders.map((reminder) => {

                  const isUpdating =
                    updateMutation.isPending &&
                    updateMutation.variables?.reminderId ===
                      reminder._id;

                  const isDeleting =
                    deleteMutation.isPending &&
                    deleteMutation.variables ===
                      reminder._id;

                  return (
                    <div
                      key={reminder._id}
                      className={`rounded-xl border p-3 transition-all ${
                        reminder.isActive
                          ? 'border-blue-200 dark:border-blue-800/40 bg-blue-50/30 dark:bg-blue-900/10'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20'
                      }`}
                    >
                      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">

                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                              reminder.isActive
                                ? 'bg-blue-100 dark:bg-blue-900/30'
                                : 'bg-slate-100 dark:bg-slate-800'
                            }`}
                          >
                            <Bell
                              className={`w-4 h-4 ${
                                reminder.isActive
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-slate-400'
                              }`}
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold text-slate-900 dark:text-white text-xs">
                                {reminder.medicineName}
                              </h4>

                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                  reminder.isActive
                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                }`}
                              >
                                {reminder.isActive
                                  ? 'ACTIVE'
                                  : 'PAUSED'}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 mt-1.5">
                              <span className="text-[9px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {reminder.phoneNumber || 'No phone'}
                              </span>

                              <span className="text-[9px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {reminder.time || '10:00 AM'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">

                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-slate-400" />

                            <input
                              type="time"
                              value={convertTo24Hour(
                                reminder.time
                              )}
                              onChange={(e) =>
                                handleTimeChange(
                                  reminder,
                                  e.target.value
                                )
                              }
                              disabled={
                                isUpdating ||
                                isDeleting
                              }
                              className="bg-white dark:bg-[#0C1628]
                                border border-slate-200 dark:border-slate-700
                                text-[10px] rounded-lg px-2 py-1.5
                                text-slate-900 dark:text-slate-200
                                focus:outline-none
                                focus:border-[#1A56A0]
                                dark:focus:border-sky-400
                                disabled:opacity-50"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleToggleActive(
                                reminder
                              )
                            }
                            disabled={
                              isUpdating ||
                              isDeleting
                            }
                            className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-all disabled:opacity-50 ${
                              reminder.isActive
                                ? 'bg-[#1A56A0] justify-end'
                                : 'bg-slate-300 dark:bg-slate-700 justify-start'
                            }`}
                            aria-label={
                              reminder.isActive
                                ? 'Pause reminder'
                                : 'Activate reminder'
                            }
                            title={
                              reminder.isActive
                                ? 'Pause reminder'
                                : 'Activate reminder'
                            }
                          >
                            <span className="w-4 h-4 bg-white rounded-full shadow-sm" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteReminder(
                                reminder._id
                              )
                            }
                            disabled={
                              isUpdating ||
                              isDeleting
                            }
                            className="p-1.5 text-slate-400
                              hover:text-red-600
                              dark:hover:text-red-400
                              hover:bg-red-50
                              dark:hover:bg-red-500/10
                              rounded-lg transition-all
                              disabled:opacity-50"
                            title="Delete reminder"
                            aria-label="Delete reminder"
                          >
                            {isDeleting ? (
                              <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-red-500 rounded-full animate-spin block" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* =================================================
              DELIVERY LOGS
          ================================================= */}
          <div className="bg-white dark:bg-[#1a2438] p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm">

            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-[#1A56A0] dark:text-sky-400" />
                  Notification Delivery Log
                </h3>

                <p className="text-[9px] text-slate-400 mt-1">
                  Review previously generated notification attempts.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  refetchLogs()
                }
                disabled={logsLoading}
                className="p-2 bg-slate-100 hover:bg-slate-200
                  dark:bg-[#0C1628] dark:hover:bg-slate-800
                  text-slate-500 dark:text-slate-400
                  rounded-lg border border-slate-200 dark:border-slate-700/60
                  transition-colors disabled:opacity-50"
                title="Refresh delivery logs"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    logsLoading
                      ? 'animate-spin'
                      : ''
                  }`}
                />
              </button>
            </div>

            {logsLoading ? (
              <div className="py-8 flex justify-center">
                <div className="w-6 h-6 border-2 border-slate-200 dark:border-slate-700 border-t-[#1A56A0] rounded-full animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <div className="py-8 text-center">
                <History className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto" />

                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  No notification records yet.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-150 dark:divide-slate-700/50 max-h-80 overflow-y-auto pr-1">

                {logs.map((log) => {
                  const badge =
                    getTypeBadge(log.type);

                  const TypeIcon =
                    badge.icon;

                  const isSent =
                    log.status === 'sent';

                  return (
                    <div
                      key={log._id}
                      className="py-3 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">

                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${badge.className}`}
                          >
                            <TypeIcon className="w-2.5 h-2.5" />
                            {log.type || 'Notification'}
                          </span>

                          <span
                            className={`inline-flex items-center gap-1 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              isSent
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-red-500/10 text-red-600 dark:text-red-400'
                            }`}
                          >
                            {isSent ? (
                              <CheckCircle2 className="w-2.5 h-2.5" />
                            ) : (
                              <AlertCircle className="w-2.5 h-2.5" />
                            )}

                            {log.status || 'unknown'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                          {log.message ||
                            'No message available.'}
                        </p>

                        <span className="text-[9px] text-slate-400 dark:text-slate-500 block mt-1">
                          {log.sentAt
                            ? new Date(
                                log.sentAt
                              ).toLocaleString()
                            : 'Unknown time'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default CustomerReminders;