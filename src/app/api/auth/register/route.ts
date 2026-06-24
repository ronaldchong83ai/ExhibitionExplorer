import { getData, saveData, generateId } from '@/lib/db';
import { simpleHash, createSessionValue } from '@/lib/auth';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import type { User } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { name, email, contact, password } = await request.json();

    if (!name || !email || !password) {
      return Response.json({ success: false, error: 'Name, email, and password are required' }, { status: 400 });
    }

    const data = await getData();
    const existing = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (existing) {
      return Response.json({ success: false, error: 'An account with this email already exists' }, { status: 409 });
    }

    const newUser: User = {
      id: generateId(),
      name,
      email: email.toLowerCase(),
      contact: contact || '',
      passwordHash: simpleHash(password),
      role: 'VISITOR',
      provider: 'CREDENTIALS',
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
