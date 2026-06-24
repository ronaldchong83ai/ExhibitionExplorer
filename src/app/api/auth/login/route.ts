import { getData } from '@/lib/db';
import { verifyPassword, createSessionValue } from '@/lib/auth';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return Response.json({ success: false, error: 'Email and password are required' }, { status: 400 });
    }

    const data = await getData();
    const user = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return Response.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return Response.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
    }

    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const cookieStore = await cookies();
    cookieStore.set('exhibition_session', createSessionValue(sessionUser), {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return Response.json({ success: true, data: sessionUser });
  } catch {
    return Response.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
