import { NextRequest } from 'next/server';
import { getData } from '@/lib/db';
import { sendOtpEmail } from '@/lib/email';

if (!(global as any).otpStore) {
  (global as any).otpStore = new Map<string, { otp: string; expiresAt: number }>();
}
const otpStore = (global as any).otpStore;

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email) {
      return Response.json({ success: false, error: 'Email is required' }, { status: 400 });
    }

    const data = await getData();
    const existing = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (existing) {
      return Response.json({ success: false, error: 'An account with this email already exists' }, { status: 409 });
    }

    // Generate a 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes from now

    otpStore.set(`register_otp:${email.toLowerCase()}`, { otp, expiresAt });

    console.log(`[Registration OTP] OTP sent to ${email}: ${otp}`);

    // Send the OTP to real email address
    const emailSent = await sendOtpEmail(email, otp);
    if (!emailSent) {
      return Response.json({ success: false, error: 'Failed to send OTP email. Please try again.' }, { status: 500 });
    }

    return Response.json({ 
      success: true, 
      message: 'OTP sent to your email address.'
    });
  } catch (err: any) {
    console.error('Send Registration OTP Error:', err);
    return Response.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
