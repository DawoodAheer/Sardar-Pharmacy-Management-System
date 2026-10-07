import nodemailer from 'nodemailer';

/**
 * Get configured Nodemailer email transporter
 * Returns null if SMTP is not configured
 */
export const getTransporter = () => {
  const isSmtpConfigured =
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS;

  if (!isSmtpConfigured) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: String(process.env.SMTP_PORT) === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

/**
 * Send password reset email
 * Returns true if sent successfully, false if offline/failed
 */
export const sendPasswordResetEmail = async ({
  to,
  name,
  resetUrl,
  resetOtp,
}) => {
  const transporter = getTransporter();

  // If no SMTP configured, log to console for offline development/operation
  if (!transporter) {
    console.log('----------------------------------------------------');
    console.log('[OFFLINE EMAIL SIMULATOR] SMTP not configured.');
    console.log(`[OFFLINE RECOVERY] Recipient: ${to} (${name})`);
    console.log(`[OFFLINE RECOVERY] 6-Digit Code: ${resetOtp}`);
    console.log(`[OFFLINE RECOVERY] Direct Link: ${resetUrl}`);
    console.log('----------------------------------------------------');
    return false;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reset Your Password - Pharma Desk</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
        <tr>
          <td align="center" style="padding: 40px 10px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%); padding: 32px 40px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Pharma Desk</h1>
                  <p style="color: #ccfbf1; margin: 6px 0 0 0; font-size: 14px;">Password Recovery Request</p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding: 36px 40px;">
                  <p style="margin: 0 0 16px 0; color: #334155; font-size: 16px; line-height: 24px;">
                    Hello <strong>${name || 'Valued User'}</strong>,
                  </p>
                  <p style="margin: 0 0 24px 0; color: #475569; font-size: 15px; line-height: 22px;">
                    We received a request to reset the password for your Pharma Desk account. Click the button below or enter the 6-digit code on the reset page.
                  </p>

                  <!-- Direct Reset Button -->
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" style="background-color: #0d9488; color: #ffffff; display: inline-block; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none; box-shadow: 0 2px 4px rgba(13, 148, 136, 0.2);">
                      Reset My Password
                    </a>
                  </div>

                  <!-- 6-digit OTP code -->
                  <div style="background-color: #f1f5f9; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">
                      Or Enter This 6-Digit Code
                    </p>
                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0f172a;">
                      ${resetOtp}
                    </span>
                  </div>

                  <p style="margin: 24px 0 0 0; color: #64748b; font-size: 13px; line-height: 20px;">
                    This link and code will expire in <strong>15 minutes</strong>. If you did not request this change, you can safely ignore this email — your account remains secure.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 40px; text-align: center;">
                  <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                    © Pharma Desk Intelligent Pharmacy Management System. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"Pharma Desk Security" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Pharma Desk — Password Reset Code & Link',
      html: htmlContent,
      text: `Hello ${name},\n\nYou requested a password reset. Reset your password here: ${resetUrl}\nOr use the 6-digit code: ${resetOtp}\nThis link expires in 15 minutes.`,
    });
    return true;
  } catch (err) {
    console.error('[EMAIL ERROR] Failed to send password reset email:', err.message);
    return false;
  }
};
