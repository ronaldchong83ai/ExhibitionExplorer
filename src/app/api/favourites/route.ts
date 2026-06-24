import { getData, saveData, generateId } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const type = request.nextUrl.searchParams.get('type');
  const targetId = request.nextUrl.searchParams.get('targetId');
  const data = await getData();

  // Check if specific favourite exists
  if (type && targetId) {
    const exists = data.favourites.some(f => f.userId === session.id && f.type === type && f.targetId === targetId);
    return Response.json({ success: true, data: exists });
  }

  // Return all favourites for user
  const favourites = data.favourites.filter(f => f.userId === session.id);
  return Response.json({ success: true, data: favourites });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const { type, targetId } = await request.json();
  const data = await getData();

  const existing = data.favourites.find(f => f.userId === session.id && f.type === type && f.targetId === targetId);
  if (existing) return Response.json({ success: true, data: existing });

  const fav = { id: generateId(), userId: session.id, type, targetId, createdAt: new Date().toISOString() };
  data.favourites.push(fav);

  // Log action
  data.actionLogs.push({
    id: generateId(), userId: session.id, action: 'FAVOURITE_ADD',
    details: `Added ${type} ${targetId} to favourites`, createdAt: new Date().toISOString()
  });

  await saveData(data);
  return Response.json({ success: true, data: fav });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const { type, targetId } = await request.json();
  const data = await getData();

  data.favourites = data.favourites.filter(f => !(f.userId === session.id && f.type === type && f.targetId === targetId));

  data.actionLogs.push({
    id: generateId(), userId: session.id, action: 'FAVOURITE_REMOVE',
    details: `Removed ${type} ${targetId} from favourites`, createdAt: new Date().toISOString()
  });

  await saveData(data);
  return Response.json({ success: true });
}
