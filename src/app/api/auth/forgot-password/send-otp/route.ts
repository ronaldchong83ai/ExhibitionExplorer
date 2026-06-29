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
    const user = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return Response.json({ success: false, error: 'No user account found with this email' }, { status: 404 });
    }

    // Google/LinkedIn users cannot reset password via credentials
    if (user.provider !== 'CREDENTIALS') {
      return Response.json({ 
        success: false, 
        error: `This account is registered via ${user.provider}. Please log in using the social sign-in option.` 
      }, { status: 400 });
    }

    // Generate a 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes from now

    otpStore.set(email.toLowerCase(), { otp, expiresAt });

    // Send the OTP to real email address
    const emailSent = await sendOtpEmail(email, otp);
    if (!emailSent) {
      return Response.json({ success: false, error: 'Failed to send OTP email. Please try again.' }, { status: 500 });
    }

    // Return the response without the debug OTP
    return Response.json({ 
      success: true, 
      message: 'OTP sent to your email address, check spam mail if not in inbox.'
    });
  } catch (err: any) {
    console.error('Send OTP Error:', err);
    return Response.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
