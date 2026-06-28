import { NextRequest } from 'next/server';
import { getData, saveData } from '@/lib/db';
import { simpleHash } from '@/lib/auth';
import { invalidateCache } from '@/lib/cache';

if (!(global as any).otpStore) {
  (global as any).otpStore = new Map<string, { otp: string; expiresAt: number }>();
}
const otpStore = (global as any).otpStore;

export async function POST(request: NextRequest) {
  try {
    const { email, otp, newPassword } = await request.json();
    if (!email || !otp || !newPassword) {
      return Response.json({ success: false, error: 'Email, OTP, and new password are required' }, { status: 400 });
    }

    const data = await getData();
    const user = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return Response.json({ success: false, error: 'User account not found' }, { status: 404 });
    }

    if (user.provider !== 'CREDENTIALS') {
      return Response.json({ success: false, error: 'Social accounts cannot reset passwords' }, { status: 400 });
    }

    // Verify OTP
    const stored = otpStore.get(email.toLowerCase());
    if (!stored) {
      return Response.json({ success: false, error: 'No OTP requested for this email address' }, { status: 400 });
    }

    if (stored.otp !== otp) {
      return Response.json({ success: false, error: 'Incorrect OTP' }, { status: 400 });
    }

    if (Date.now() > stored.expiresAt) {
      otpStore.delete(email.toLowerCase());
      return Response.json({ success: false, error: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }

    // Hash and update password
    user.passwordHash = simpleHash(newPassword);
    await saveData(data);

    // Delete used OTP
    otpStore.delete(email.toLowerCase());

    // Invalidate Cache version to sync state
    await invalidateCache('home');

    return Response.json({ 
      success: true, 
      message: 'Your password has been successfully reset. Please log in with your new password.' 
    });
  } catch (err: any) {
    console.error('Reset Password Error:', err);
    return Response.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
