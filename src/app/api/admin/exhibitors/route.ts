import { getData, saveData, generateId } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const exhibitionId = request.nextUrl.searchParams.get('exhibitionId') || '';
  const data = await getData();
  return Response.json({ success: true, data: data.exhibitors.filter(e => e.exhibitionId === exhibitionId) });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const body = await request.json();
  const data = await getData();
  const item = {
    id: generateId(), exhibitionId: body.exhibitionId, name: body.name || '', description: body.description || '',
    boothNumber: body.boothNumber || '', imageUrl: '', details: body.details || '', allowedUserIds: [], createdAt: new Date().toISOString(),
  };
  data.exhibitors.push(item);
  await saveData(data);
  return Response.json({ success: true, data: item });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const body = await request.json();
  const data = await getData();
  const idx = data.exhibitors.findIndex(e => e.id === body.id);
  if (idx === -1) return Response.json({ success: false, error: 'Not found' }, { status: 404 });
  data.exhibitors[idx] = { ...data.exhibitors[idx], name: body.name ?? data.exhibitors[idx].name, description: body.description ?? data.exhibitors[idx].description, boothNumber: body.boothNumber ?? data.exhibitors[idx].boothNumber, details: body.details ?? data.exhibitors[idx].details };
  await saveData(data);
  return Response.json({ success: true, data: data.exhibitors[idx] });
}
