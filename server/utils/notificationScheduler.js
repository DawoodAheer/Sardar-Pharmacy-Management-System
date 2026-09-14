import cron from 'node-cron';
import nodemailer from 'nodemailer';
import Medicine from '../models/Medicine.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import Reminder from '../models/Reminder.js';
import { checkExpiryStatus } from './expiryCheck.js';
import { createBackup } from './backupManager.js';

// Setup Nodemailer email transporter
const getEmailTransporter = () => {
  const isSmtpConfigured =
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS;

  if (isSmtpConfigured) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Ethereal fake SMTP fallback
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'mock_user',
        pass: 'mock_pass',
      },
    });
  }
};

/**
 * Helper: Get recipient email addresses (Superadmin, Pharmacists, and SMTP_USER)
 */
const getStaffEmailRecipients = async () => {
  const staffUsers = await User.find({ role: { $in: ['pharmacist', 'superadmin'] } });
  const emails = new Set();

  staffUsers.forEach((u) => {
    if (u.email && u.email.trim()) emails.add(u.email.trim());
  });

  // Ensure configured SMTP owner email is always included
  if (process.env.SMTP_USER && process.env.SMTP_USER.includes('@')) {
    emails.add(process.env.SMTP_USER.trim());
  }

  return {
    staffUsers,
    emailList: Array.from(emails),
  };
};

/**
 * Check medicines and dispatch targeted expiry alert emails:
 * 1) 1-Day Final Urgent Alert (diffDays <= 1 && diffDays >= 0)
 * 2) 10-Day Advance Warning (diffDays <= 10 && diffDays > 1)
 * 3) Expired Alert (diffDays < 0)
 *
 * @param {Object} options
 * @param {boolean} options.force - Force sending even if already flagged as sent
 * @param {string} options.medicineId - Optional filter to check a specific medicine
 */
export const checkAndSendExpiryAlerts = async ({ force = false, medicineId = null } = {}) => {
  console.log(`[Expiry Alert Engine] Checking medicines (force: ${force}, medicineId: ${medicineId || 'all'})...`);
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const msInDay = 24 * 60 * 60 * 1000;

    const query = {};
    if (medicineId) {
      query._id = medicineId;
    }

    const medicines = await Medicine.find(query);
    if (medicines.length === 0) {
      console.log('[Expiry Alert Engine] No medicines found.');
      return { status: 'success', message: 'No medicines to evaluate' };
    }

    const oneDayUrgentList = [];
    const tenDaysWarningList = [];
    const expiredList = [];

    medicines.forEach((med) => {
      const exp = new Date(med.expiryDate);
      exp.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((exp.getTime() - today.getTime()) / msInDay);

      if (diffDays < 0) {
        // Expired
        if (!med.expiryAlertExpiredSent || force) {
          expiredList.push({ med, diffDays });
        }
      } else if (diffDays <= 1 && diffDays >= 0) {
        // 1 Day before expiry (or expiring today)
        if (!med.expiryAlert1Sent || force) {
          oneDayUrgentList.push({ med, diffDays });
        }
      } else if (diffDays <= 10 && diffDays > 1) {
        // 10 Days before expiry
        if (!med.expiryAlert10Sent || force) {
          tenDaysWarningList.push({ med, diffDays });
        }
      }
    });

    const totalAlertsNeeded = oneDayUrgentList.length + tenDaysWarningList.length + expiredList.length;
    if (totalAlertsNeeded === 0) {
      console.log('[Expiry Alert Engine] All medicines are healthy or already notified. No new alerts needed.');
      return { status: 'success', message: 'No pending expiry alerts' };
    }

    const { staffUsers, emailList } = await getStaffEmailRecipients();
    if (emailList.length === 0) {
      console.log('[Expiry Alert Engine] No recipient email addresses configured.');
      return { status: 'warning', message: 'No email recipients found' };
    }

    const transporter = getEmailTransporter();
    const isEthereal = transporter.options && transporter.options.host === 'smtp.ethereal.email';
    const sender = `"Sardar Medical Store Alerts" <${process.env.SMTP_USER || 'no-reply@sardarpharmacy.com'}>`;

    // --- Helper to send formatted alert email to all staff ---
    const sendBatchAlert = async ({ subject, headerBg, badgeText, title, description, actionNotice, items, isCritical }) => {
      let tableRows = '';
      items.forEach(({ med, diffDays }) => {
        const daysLabel = diffDays === 1 ? '1 Day (Tomorrow!)' : diffDays === 0 ? 'Today!' : diffDays < 0 ? `Expired (${Math.abs(diffDays)}d ago)` : `${diffDays} Days`;
        tableRows += `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px; font-weight: 600; color: #0f172a;">
              ${med.name}
              <div style="font-size: 12px; font-weight: normal; color: #64748b;">${med.genericName || 'No generic'} | Mfr: ${med.manufacturer || 'N/A'}</div>
            </td>
            <td style="padding: 12px; font-family: monospace; color: #334155;">${med.rackLocation || 'Shelf'}</td>
            <td style="padding: 12px; text-align: center; font-weight: bold; color: #0f172a;">${med.quantity}</td>
            <td style="padding: 12px; color: #334155;">${new Date(med.expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
            <td style="padding: 12px; text-align: center; font-weight: 700; color: ${isCritical ? '#dc2626' : '#d97706'};">
              ${daysLabel}
            </td>
          </tr>
        `;
      });

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin:0; padding:20px; background-color:#f1f5f9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 6px rgba(0,0,0,0.07); border:1px solid #e2e8f0;">
            <tr>
              <td style="background:${headerBg}; padding:28px 32px; text-align:center; color:#ffffff;">
                <span style="background:rgba(255,255,255,0.2); padding:4px 12px; border-radius:20px; font-size:12px; font-weight:700; letter-spacing:1px; text-transform:uppercase;">
                  ${badgeText}
                </span>
                <h1 style="margin:12px 0 6px; font-size:22px; font-weight:800; letter-spacing:-0.5px;">${title}</h1>
                <p style="margin:0; font-size:14px; opacity:0.95;">Sardar Medical Store Management System</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;">
                <p style="margin:0 0 16px; color:#334155; font-size:15px; line-height:22px;">${description}</p>
                <div style="background:#fef2f2; border-left:4px solid ${isCritical ? '#dc2626' : '#f59e0b'}; padding:12px 16px; border-radius:6px; margin-bottom:20px;">
                  <strong style="color:#991b1b; font-size:13px;">Recommended Action:</strong>
                  <p style="margin:4px 0 0; color:#7f1d1d; font-size:13px; line-height:18px;">${actionNotice}</p>
                </div>
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse; font-size:13px; margin-top:16px;">
                  <thead>
                    <tr style="background:#f8fafc; border-bottom:2px solid #cbd5e1; text-align:left; color:#475569;">
                      <th style="padding:10px 12px;">Medicine Name</th>
                      <th style="padding:10px 12px;">Rack</th>
                      <th style="padding:10px 12px; text-align:center;">Qty</th>
                      <th style="padding:10px 12px;">Expiry Date</th>
                      <th style="padding:10px 12px; text-align:center;">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>${tableRows}</tbody>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#f8fafc; padding:16px 32px; border-top:1px solid #e2e8f0; text-align:center; font-size:12px; color:#94a3b8;">
                Sardar Medical Store Automation System &bull; Intelligent Real-Time Expiry Sentinel
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      for (const email of emailList) {
        try {
          if (isEthereal) {
            console.log(`[MOCK EMAIL] Alert sent to ${email}: ${subject}`);
          } else {
            await transporter.sendMail({
              from: sender,
              to: email,
              subject,
              html: htmlContent,
            });
            console.log(`[EMAIL DISPATCHED] To: ${email} | Subject: ${subject}`);
          }
        } catch (err) {
          console.error(`[EMAIL ERROR] Failed sending to ${email}:`, err.message);
        }
      }

      // Log notification in DB for all staff members
      for (const staff of staffUsers) {
        try {
          await Notification.create({
            recipientId: staff._id,
            type: 'Email',
            message: `${subject}\n${items.map(i => `- ${i.med.name} (Qty: ${i.med.quantity})`).join('\n')}`,
            status: 'sent',
          });
        } catch (dbErr) {
          console.error('[NOTIFICATION LOG ERROR]', dbErr.message);
        }
      }
    };

    // 1. Send 1-Day Final Urgent Warning (Expires Tomorrow / Today)
    if (oneDayUrgentList.length > 0) {
      const subject = oneDayUrgentList.length === 1
        ? `🚨 [URGENT 1-DAY FINAL ALERT] ${oneDayUrgentList[0].med.name} Expires Tomorrow!`
        : `🚨 [URGENT 1-DAY FINAL ALERT] ${oneDayUrgentList.length} Medicines Expire Tomorrow!`;

      await sendBatchAlert({
        subject,
        headerBg: 'linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)',
        badgeText: 'FINAL URGENT EXPIRY WARNING',
        title: 'Medicines Expiring Tomorrow!',
        description: 'The following medicines are reaching their final day before expiry. Immediate clearance or final sale is critical today.',
        actionNotice: 'Sell immediately today or discard from shelves. Once expired, the billing module will strictly block their sale.',
        items: oneDayUrgentList,
        isCritical: true,
      });

      // Mark expiryAlert1Sent = true
      for (const { med } of oneDayUrgentList) {
        await Medicine.findByIdAndUpdate(med._id, { expiryAlert1Sent: true });
      }
    }

    // 2. Send 10-Day Advance Warning
    if (tenDaysWarningList.length > 0) {
      const subject = tenDaysWarningList.length === 1
        ? `⚠️ [10-Day Warning] Medicine Expiring Soon: ${tenDaysWarningList[0].med.name}`
        : `⚠️ [10-Day Warning] ${tenDaysWarningList.length} Medicines Expiring in 10 Days`;

      await sendBatchAlert({
        subject,
        headerBg: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
        badgeText: '10 DAYS TO EXPIRY ADVANCE ALERT',
        title: 'Medicines Expiring in 10 Days',
        description: 'The following medicines have approximately 10 days left before expiry. Plan clearance discounts or supplier returns now.',
        actionNotice: 'Prioritize front-shelf sales, apply a promotion/discount, or initiate distributor return before expiry to prevent total financial loss.',
        items: tenDaysWarningList,
        isCritical: false,
      });

      // Mark expiryAlert10Sent = true
      for (const { med } of tenDaysWarningList) {
        await Medicine.findByIdAndUpdate(med._id, { expiryAlert10Sent: true });
      }
    }

    // 3. Send Expired Alert
    if (expiredList.length > 0) {
      const subject = expiredList.length === 1
        ? `⛔ [EXPIRED ALERT] ${expiredList[0].med.name} is Expired!`
        : `⛔ [EXPIRED ALERT] ${expiredList.length} Medicines Have Expired`;

      await sendBatchAlert({
        subject,
        headerBg: 'linear-gradient(135deg, #334155 0%, #475569 100%)',
        badgeText: 'MEDICINE EXPIRED NOTICE',
        title: 'Medicines Expired - Immediate Shelf Removal Required',
        description: 'The following medicines have passed their expiry date. The system has automatically locked them from billing.',
        actionNotice: 'Immediately remove these stocks from the physical racks and store in the quarantine/expiry bin for return or destruction.',
        items: expiredList,
        isCritical: true,
      });

      for (const { med } of expiredList) {
        await Medicine.findByIdAndUpdate(med._id, { expiryAlertExpiredSent: true });
      }
    }

    return {
      status: 'success',
      sent1DayAlerts: oneDayUrgentList.length,
      sent10DayAlerts: tenDaysWarningList.length,
      sentExpiredAlerts: expiredList.length,
    };
  } catch (error) {
    console.error('[Expiry Alert Engine Error]:', error);
    return { status: 'error', error: error.message };
  }
};

// Backwards compatibility wrapper for daily report
export const runExpiryReport = async () => {
  return await checkAndSendExpiryAlerts({ force: false });
};

// --- CRON JOB 2: Daily Low Stock Alert at 9:00 AM ---
export const runLowStockReport = async () => {
  console.log('Running daily low stock check...');
  try {
    // Find medicines where quantity is below or equal to reorderLevel
    const medicines = await Medicine.find({
      $expr: { $lte: ['$quantity', '$reorderLevel'] },
    });

    if (medicines.length === 0) {
      console.log('No low stock medicines.');
      return { status: 'success', message: 'No low stock medicines found' };
    }

    // Find all pharmacists
    const pharmacists = await User.find({ role: 'pharmacist' });
    if (pharmacists.length === 0) {
      console.log('No pharmacists found.');
      return { status: 'success', message: 'No pharmacists found' };
    }

    // Build low stock HTML report
    let htmlContent = `
      <h2 style="color: #0f172a; font-family: sans-serif;">Pharmadesk Low Stock Alert</h2>
      <p style="color: #475569; font-family: sans-serif;">The following medicines have fallen below their configured reorder thresholds:</p>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; font-family: sans-serif; width: 100%; text-align: left; border-color: #cbd5e1;">
        <tr style="background-color: #f8fafc; color: #334155;">
          <th>Medicine Name</th>
          <th>Batch Number</th>
          <th>Category</th>
          <th>Available Stock</th>
          <th>Reorder Level</th>
          <th>Status</th>
        </tr>
    `;

    medicines.forEach((med) => {
      const isDepleted = med.quantity === 0;
      htmlContent += `
        <tr>
          <td><strong>${med.name}</strong><br><span style="font-size: 11px; color: #64748b;">${med.genericName}</span></td>
            <td><code>${med.rackLocation || 'Not assigned'}</code></td>
          <td>${med.category}</td>
          <td style="color: ${isDepleted ? '#ef4444' : '#f59e0b'}; font-weight: bold;">${med.quantity} units</td>
          <td>${med.reorderLevel} units</td>
          <td style="color: ${isDepleted ? '#ef4444' : '#f59e0b'}; font-weight: bold;">
            ${isDepleted ? 'DEPLETED' : 'LOW STOCK'}
          </td>
        </tr>
      `;
    });

    htmlContent += `
      </table>
      <p style="font-size: 11px; color: #64748b; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
        Pharmadesk Medicine System - Stock Alert Notification
      </p>
    `;

    const stockSummary = medicines.map((m) => {
      const isDepleted = m.quantity === 0;
      const statusStr = isDepleted ? 'DEPLETED' : 'LOW STOCK';
      return `- ${m.name} (Rack: ${m.rackLocation || 'Not assigned'}): ${m.quantity} units left (Reorder: ${m.reorderLevel}) [${statusStr}]`;
    }).join('\n');

    const detailedMessage = `Low Stock Alert:\n${stockSummary}`;

    const transporter = getEmailTransporter();

    // Send emails
    for (const pharmacist of pharmacists) {
      try {
        const isEthereal = transporter.options.host === 'smtp.ethereal.email';
        const mailOptions = {
          from: `"Pharmadesk Notifications" <${process.env.SMTP_USER || 'no-reply@pharmadesk.com'}>`,
          to: pharmacist.email,
          subject: '⚠️ Stock Replenishment Alert - Pharmadesk Pharmacy',
          html: htmlContent,
        };

        if (isEthereal) {
          console.log(`[MOCK EMAIL] Sent to ${pharmacist.email}: Low Stock Report`);
        } else {
          await transporter.sendMail(mailOptions);
        }

        await Notification.create({
          recipientId: pharmacist._id,
          type: 'Email',
          message: detailedMessage,
          status: 'sent',
        });
      } catch (err) {
        console.error(`Failed sending low stock report to ${pharmacist.email}:`, err.message);
        await Notification.create({
          recipientId: pharmacist._id,
          type: 'Email',
          message: `Low Stock Alert failed: ${err.message}`,
          status: 'failed',
        });
      }
    }

    return { status: 'success', message: 'Low stock alerts processed' };
  } catch (error) {
    console.error('Error running low stock report cron:', error);
    return { status: 'error', error: error.message };
  }
};

// --- Helper: Convert reminder time string ("04:30 PM") to 24h hour and minute numbers ---
const parseReminderTime = (timeStr) => {
  if (!timeStr) return { hour: 10, minute: 0 }; // fallback to 10:00 AM
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return { hour: 10, minute: 0 };

  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'AM' && hour === 12) hour = 0;
  else if (period === 'PM' && hour !== 12) hour += 12;

  return { hour, minute };
};

// --- Build styled medication reminder email HTML ---
const buildReminderEmailHtml = (medicineName, customerName) => {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
      <div style="background: #ffffff; border-radius: 10px; padding: 28px; border: 1px solid #e2e8f0;">
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="display: inline-block; background: #0F4BBE; color: white; font-weight: bold; font-size: 14px; padding: 8px 14px; border-radius: 8px; letter-spacing: 1px;">
            💊 Rx
          </div>
          <h2 style="color: #0f172a; margin: 12px 0 4px; font-size: 18px;">Medication Reminder</h2>
          <p style="color: #64748b; font-size: 13px; margin: 0;">Pharmadesk Health Alert</p>
        </div>
        
        <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;">
          <p style="color: #1e40af; font-size: 14px; margin: 0 0 4px; font-weight: 600;">
            Time to take your medicine
          </p>
          <p style="color: #1e3a5f; font-size: 20px; font-weight: bold; margin: 0;">
            ${medicineName}
          </p>
        </div>

        <p style="color: #475569; font-size: 13px; line-height: 1.6; margin: 16px 0 0;">
          Hi <strong>${customerName}</strong>, this is your scheduled medication reminder from Pharmadesk.
          Please take your prescribed dose of <strong>${medicineName}</strong> as directed by your doctor.
        </p>

        <p style="color: #94a3b8; font-size: 11px; margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center;">
          Pharmadesk Medicine System — Automated Health Reminder
        </p>
      </div>
    </div>
  `;
};

// --- CRON JOB 3: Hourly Customer Email Reminders (time-matched) ---
export const runEmailReminders = async () => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  console.log(`[Reminder Cron] Running email reminder check (time: ${currentHour}:${currentMinute})...`);

  try {
    const reminders = await Reminder.find({ isActive: true }).populate('customerId');

    if (reminders.length === 0) {
      console.log('[Reminder Cron] No active medication reminders.');
      return { status: 'success', message: 'No active reminders found' };
    }

    // Filter reminders whose scheduled hour and minute match the current time
    const dueReminders = reminders.filter((r) => {
      const { hour: reminderHour, minute: reminderMinute } = parseReminderTime(r.time);
      return reminderHour === currentHour && reminderMinute === currentMinute;
    });

    if (dueReminders.length === 0) {
      return { status: 'success', message: 'No reminders due this minute' };
    }

    console.log(`[Reminder Cron] ${dueReminders.length} reminder(s) due at ${currentHour}:${currentMinute}.`);

    const transporter = getEmailTransporter();
    const isEthereal = transporter.options.host === 'smtp.ethereal.email';

    for (const reminder of dueReminders) {
      const customer = reminder.customerId;
      if (!customer) {
        console.log(`[Reminder Cron] Skipping reminder ${reminder._id} — customer ref missing`);
        continue;
      }

      const messageText = `Pharmadesk Reminder: Time to take your ${reminder.medicineName}. Keep healthy!`;

      try {
        const htmlContent = buildReminderEmailHtml(reminder.medicineName, customer.name);

        const mailOptions = {
          from: `"Pharmadesk Reminders" <${process.env.SMTP_USER || 'no-reply@pharmadesk.com'}>`,
          to: customer.email,
          subject: `💊 Reminder: Time to take ${reminder.medicineName}`,
          html: htmlContent,
        };

        if (isEthereal) {
          console.log(`[MOCK EMAIL] Reminder to ${customer.email}: ${reminder.medicineName}`);
        } else {
          await transporter.sendMail(mailOptions);
          console.log(`[EMAIL SENT] Reminder to ${customer.email}: ${reminder.medicineName}`);
        }

        await Notification.create({
          recipientId: customer._id,
          type: 'Email',
          message: messageText,
          status: 'sent',
        });
      } catch (err) {
        console.error(`[Reminder Cron] Failed emailing ${customer.email}:`, err.message);
        await Notification.create({
          recipientId: customer._id,
          type: 'Email',
          message: `Email reminder failed for ${reminder.medicineName}: ${err.message}`,
          status: 'failed',
        });
      }
    }

    return { status: 'success', message: 'Email reminders processed' };
  } catch (error) {
    console.error('[Reminder Cron] Error:', error);
    return { status: 'error', error: error.message };
  }
};

// Initialize Cron Schedulers
export const initializeNotificationScheduler = () => {
  // 1. Initial boot check: runs 5 seconds after server launch so DB connection is ready
  setTimeout(async () => {
    console.log('[Scheduler Boot] Running startup medicine expiry check...');
    try {
      await checkAndSendExpiryAlerts({ force: false });
    } catch (err) {
      console.error('[Scheduler Boot] Startup check failed:', err.message);
    }
  }, 5000);

  // Cron 1A — Hourly Expiry Check (at minute 0 of every hour: 0 * * * *)
  cron.schedule('0 * * * *', async () => {
    console.log('[Hourly Cron] Running regular medicine expiry check...');
    try {
      await checkAndSendExpiryAlerts({ force: false });
    } catch (err) {
      console.error('[Hourly Cron] Expiry check failed:', err.message);
    }
  });
  console.log('Scheduled Hourly Medicine Expiry Check (0 * * * *)');

  // Cron 1B — 8:00 AM daily morning summary (0 8 * * *)
  cron.schedule('0 8 * * *', async () => {
    console.log('[Daily Morning Cron] Running 8:00 AM medicine expiry check...');
    try {
      await checkAndSendExpiryAlerts({ force: false });
    } catch (err) {
      console.error('[Daily Morning Cron] Expiry check failed:', err.message);
    }
  });
  console.log('Scheduled Daily Morning Expiry Report (8:00 AM daily)');

  // Cron 2 — 9:00 AM daily (0 9 * * *)
  cron.schedule('0 9 * * *', runLowStockReport);
  console.log('Scheduled Low Stock Alert Cron Job (9:00 AM daily)');

  // Cron 3 — Every minute (* * * * *)
  cron.schedule('* * * * *', runEmailReminders);
  console.log('Scheduled Customer Email Reminder Cron Job (every minute, time-matched)');

  // Cron 4 — Daily Automated Database Backup at 12:00 AM Midnight (0 0 * * *)
  cron.schedule('0 0 * * *', async () => {
    console.log('Running daily database automated backup...');
    try {
      await createBackup();
    } catch (err) {
      console.error('Daily automated backup failed:', err.message);
    }
  });
  console.log('Scheduled Daily Database Backup Cron Job (12:00 AM Midnight daily)');
};
