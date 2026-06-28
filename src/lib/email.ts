import nodemailer from 'nodemailer';

export async function sendOtpEmail(to: string, otp: string): Promise<boolean> {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn('[SMTP WARNING] SMTP_USER or SMTP_PASS not set in environment. Falling back to console logging.');
    console.log(`[EMAIL SEND SIMULATION] To: ${to}, Subject: Reset Password OTP, Body: Your OTP code is ${otp}`);
    return true;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    });

    await transporter.sendMail({
      from: `"Exhibition Explorer" <${user}>`,
      to,
      subject: 'Reset Password OTP - Exhibition Explorer',
      text: `Hello,\n\nYou requested to reset your password. Your 6-digit OTP code is:\n\n${otp}\n\nThis OTP is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #3B82F6;">Exhibition Explorer</h2>
          <p>Hello,</p>
          <p>You requested to reset your password. Please use the following 6-digit verification code:</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #1e3a8a; margin: 20px 0;">
            ${otp}
          </div>
          <p>This OTP is valid for <strong>10 minutes</strong>. For security reasons, do not share this code with anyone.</p>
          <p>If you did not request this reset, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999; text-align: center;">Exhibition Explorer Team</p>
        </div>
      `,
    });

    console.log('[SMTP SUCCESS] Email sent successfully to:', to);
    return true;
  } catch (error) {
    console.error('[SMTP ERROR] Failed to send email:', error);
    return false;
  }
}
