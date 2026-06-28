import { NextRequest } from 'next/server';

if (!(global as any).otpStore) {
  (global as any).otpStore = new Map<string, { otp: string; expiresAt: number }>();
}
const otpStore = (global as any).otpStore;

export async function POST(request: NextRequest) {
  try {
    const { email, otp } = await request.json();
    if (!email || !otp) {
      return Response.json({ success: false, error: 'Email and OTP are required' }, { status: 400 });
    }

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

    return Response.json({ 
      success: true, 
      message: 'OTP verified successfully.' 
    });
  } catch (err: any) {
    console.error('Verify OTP Error:', err);
    return Response.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
