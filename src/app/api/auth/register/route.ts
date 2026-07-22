import { getData, saveData, generateId } from '@/lib/db';
import { simpleHash, createSessionValue } from '@/lib/auth';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import type { User } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, occupation, citizenship, contact } = await request.json();

    if (!name || !email || !password || !occupation || !citizenship) {
      return Response.json({ success: false, error: 'Name, email, password, occupation, and citizenship are required' }, { status: 400 });
    }

    const data = await getData();
    const existing = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (existing) {
      return Response.json({ success: false, error: 'An account with this email already exists' }, { status: 409 });
    }

    if (!(global as any).otpStore) {
      (global as any).otpStore = new Map<string, { otp: string; expiresAt: number }>();
    }
    const otpStore = (global as any).otpStore;
    const isVerified = otpStore.get(`register_verified:${email.toLowerCase()}`);
    if (!isVerified) {
      return Response.json({ success: false, error: 'Please verify your email address using OTP first' }, { status: 400 });
    }

    // Clean up the verified flag
    otpStore.delete(`register_verified:${email.toLowerCase()}`);

    const newUser: User = {
      id: generateId(),
      name: name.trim(),
      email: email.toLowerCase(),
      contact: contact ? contact.trim() : '',
      passwordHash: simpleHash(password),
      role: 'VISITOR',
      provider: 'CREDENTIALS',
      occupation: occupation.trim(),
      citizenship: citizenship.trim(),
      createdAt: new Date().toISOString(),
    };

    data.users.push(newUser);
    await saveData(data);

    const sessionUser = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    };

    const cookieStore = await cookies();
    cookieStore.set('exhibition_session', createSessionValue(sessionUser), {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return Response.json({ success: true, data: sessionUser });
  } catch {
    return Response.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
