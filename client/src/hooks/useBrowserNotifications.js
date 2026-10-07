import { useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const DEFAULT_REMINDER_TIME = {
  hour: 10,
  minute: 0,
};

const NOTIFICATION_DURATION = 30000;
const REMINDER_CHECK_INTERVAL = 60000;

/**
 * Parse a time string such as:
 * "04:30 PM"
 * "4:30 PM"
 * "04:30 pm"
 *
 * Returns a 24-hour time object.
 */
const parseTime = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') {
    return DEFAULT_REMINDER_TIME;
  }

  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (!match) {
    return DEFAULT_REMINDER_TIME;
  }

  let hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return DEFAULT_REMINDER_TIME;
  }

  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    return DEFAULT_REMINDER_TIME;
  }

  if (period === 'AM' && hour === 12) {
    hour = 0;
  } else if (period === 'PM' && hour !== 12) {
    hour += 12;
  }

  return { hour, minute };
};

/**
 * Create a unique key for the current minute.
 * This prevents the same reminder from firing repeatedly
 * during the same minute.
 */
const createMinuteKey = (date) =>
  [
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
  ].join('-');

/**
 * Custom hook responsible for customer medicine reminders.
 *
 * Responsibilities:
 * - Fetch active customer reminders.
 * - Request browser notification permission.
 * - Check reminder times.
 * - Show browser notifications.
 * - Prevent duplicate notifications.
 * - Log fired notifications to the backend.
 */
const useBrowserNotifications = () => {
  const { user } = useAuth();

  const firedRef = useRef(new Set());

  const customerId = user?._id;
  const isCustomer = user?.role === 'customer';

  /**
   * Fetch customer reminders.
   */
  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders', customerId],
    queryFn: async () => {
      if (!customerId) {
        return [];
      }

      const { data } = await api.get(
        `/notifications/reminders/customer/${customerId}`
      );

      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(customerId && isCustomer),
    staleTime: 60000,
    refetchInterval: 60000,
  });

  /**
   * Send fired reminder information to backend.
   */
  const logToBackend = useCallback(async (medicineName) => {
    if (!medicineName) {
      return;
    }

    try {
      await api.post('/notifications/browser-log', {
        medicineName,
      });
    } catch (error) {
      console.error(
        '[BrowserNotif] Failed to log notification:',
        error?.message || error
      );
    }
  }, []);

  /**
   * Request browser notification permission.
   */
  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      return 'denied';
    }

    try {
      return await Notification.requestPermission();
    } catch (error) {
      console.error(
        '[BrowserNotif] Permission request failed:',
        error?.message || error
      );

      return 'denied';
    }
  }, []);

  useEffect(() => {
    if (!customerId || !isCustomer) {
      return undefined;
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      return undefined;
    }

    const cleanOldFiredKeys = (currentMinuteKey) => {
      for (const key of firedRef.current) {
        if (!key.startsWith(currentMinuteKey)) {
          firedRef.current.delete(key);
        }
      }
    };

    const showNotification = (reminder) => {
      if (Notification.permission !== 'granted') {
        return;
      }

      try {
        const notification = new Notification(
          'Sardar Medical Store Medicine Reminder',
          {
            body: `It is time to take your ${reminder.medicineName}.`,
            icon: '/favicon.ico',
            tag: `pharmadesk-reminder-${reminder._id}`,
            requireInteraction: true,
          }
        );

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        window.setTimeout(() => {
          notification.close();
        }, NOTIFICATION_DURATION);
      } catch (error) {
        console.error(
          '[BrowserNotif] Failed to show notification:',
          error?.message || error
        );
      }
    };

    const checkReminders = () => {
      if (Notification.permission !== 'granted') {
        return;
      }

      const now = new Date();
      const currentMinuteKey = createMinuteKey(now);

      cleanOldFiredKeys(currentMinuteKey);

      const activeReminders = reminders.filter(
        (reminder) =>
          reminder &&
          reminder.isActive &&
          reminder._id &&
          reminder.medicineName
      );

      activeReminders.forEach((reminder) => {
        const { hour, minute } = parseTime(reminder.time);

        const isScheduledTime =
          hour === now.getHours() && minute === now.getMinutes();

        if (!isScheduledTime) {
          return;
        }

        const fireKey = `${currentMinuteKey}-${reminder._id}`;

        if (firedRef.current.has(fireKey)) {
          return;
        }

        firedRef.current.add(fireKey);

        showNotification(reminder);
        void logToBackend(reminder.medicineName);
      });
    };

    checkReminders();

    const intervalId = window.setInterval(
      checkReminders,
      REMINDER_CHECK_INTERVAL
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    customerId,
    isCustomer,
    reminders,
    logToBackend,
  ]);

  return {
    requestPermission,
  };
};

export default useBrowserNotifications;