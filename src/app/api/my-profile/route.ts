import { getData, saveData } from '@/lib/db';
import { getSession, createSessionValue } from '@/lib/auth';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const data = await getData();
  const user = data.users.find(u => u.id === session.id);

  if (!user) {
    return Response.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  // Sanitize passwordHash out of the response
  const { passwordHash, ...rest } = user;

  return Response.json({ success: true, data: rest });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, contact, profilePic, dob, occupation, citizenship } = body;

  if (!name || !name.trim()) {
    return Response.json({ success: false, error: 'Name is required' }, { status: 400 });
  }
  if (!occupation || !occupation.trim()) {
    return Response.json({ success: false, error: 'Occupation is required' }, { status: 400 });
  }
  if (!citizenship || !citizenship.trim()) {
    return Response.json({ success: false, error: 'Citizenship is required' }, { status: 400 });
  }

  const data = await getData();
  const userIdx = data.users.findIndex(u => u.id === session.id);

  if (userIdx === -1) {
    return Response.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  const updatedUser = {
    ...data.users[userIdx],
    name: name.trim(),
    contact: contact ? contact.trim() : '',
    profilePic: profilePic || null,
    dob: dob || null,
    occupation: occupation.trim(),
    citizenship: citizenship.trim(),
  };

  data.users[userIdx] = updatedUser;
  await saveData(data);

  // Update session cookie with the new name if changed
  const sessionUser = {
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email,
    role: updatedUser.role,
  };

  const cookieStore = await cookies();
  cookieStore.set('exhibition_session', createSessionValue(sessionUser), {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  const { passwordHash, ...sanitized } = updatedUser;

  return Response.json({ success: true, data: sanitized });
}
