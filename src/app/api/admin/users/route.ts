import { getData, saveData } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { NextRequest } from 'next/server';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }
  const data = await getData();
  
  // Return users, hiding sensitive password hashes
  const sanitizedUsers = data.users.map(u => {
    const { passwordHash, ...rest } = u;
    return rest;
  });
  
  sanitizedUsers.sort((a, b) => a.name.localeCompare(b.name));
  return Response.json({ success: true, data: sanitizedUsers });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }
  
  const body = await request.json();
  const { userId, role } = body;
  
  if (!userId || !role) {
    return Response.json({ success: false, error: 'Missing userId or role' }, { status: 400 });
  }
  
  if (role !== 'ADMIN' && role !== 'EXHIBITOR' && role !== 'VISITOR' && role !== 'REDEMPTOR') {
    return Response.json({ success: false, error: 'Invalid role' }, { status: 400 });
  }

  const data = await getData();
  const userIdx = data.users.findIndex(u => u.id === userId);
  if (userIdx === -1) {
    return Response.json({ success: false, error: 'User not found' }, { status: 404 });
  }
  
  // Prevent admin from demoting themselves
  if (userId === session.id && role !== 'ADMIN') {
    return Response.json({ success: false, error: 'Cannot demote your own admin account' }, { status: 400 });
  }
  
  data.users[userIdx].role = role;
  await saveData(data);
  
  return Response.json({ success: true, data: { userId, role } });
}
