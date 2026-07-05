import { getData, saveData, generateId } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'EXHIBITOR')) return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const exhibitionId = request.nextUrl.searchParams.get('exhibitionId') || '';
  const data = await getData();
  const filtered = data.exhibitors.filter(e => e.exhibitionId === exhibitionId);
  filtered.sort((a, b) => {
    const aTrophy = a.hasTrophy ? 1 : 0;
    const bTrophy = b.hasTrophy ? 1 : 0;
    if (aTrophy !== bTrophy) return bTrophy - aTrophy;
    return a.boothNumber.localeCompare(b.boothNumber);
  });
  return Response.json({ success: true, data: filtered });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'EXHIBITOR')) return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const body = await request.json();

  if (!body.name || !body.name.trim()) {
    return Response.json({ success: false, error: 'Name is required' }, { status: 400 });
  }
  if (!body.boothNumber || !body.boothNumber.trim()) {
    return Response.json({ success: false, error: 'Booth Number is required' }, { status: 400 });
  }

  const data = await getData();
  const item = {
    id: generateId(), exhibitionId: body.exhibitionId, name: body.name || '', description: body.description || '',
    boothNumber: body.boothNumber || '', imageUrl: '', details: body.details || '', allowedUserIds: [session.id], createdAt: new Date().toISOString(),
    hasTrophy: body.hasTrophy ?? false
  };
  data.exhibitors.push(item);
  await saveData(data);
  return Response.json({ success: true, data: item });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'EXHIBITOR')) return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const body = await request.json();

  if (body.name !== undefined && (!body.name || !body.name.trim())) {
    return Response.json({ success: false, error: 'Name is required' }, { status: 400 });
  }
  if (body.boothNumber !== undefined && (!body.boothNumber || !body.boothNumber.trim())) {
    return Response.json({ success: false, error: 'Booth Number is required' }, { status: 400 });
  }

  const data = await getData();
  const idx = data.exhibitors.findIndex(e => e.id === body.id);
  if (idx === -1) return Response.json({ success: false, error: 'Not found' }, { status: 404 });
  data.exhibitors[idx] = { 
    ...data.exhibitors[idx], 
    name: body.name ?? data.exhibitors[idx].name, 
    description: body.description ?? data.exhibitors[idx].description, 
    boothNumber: body.boothNumber ?? data.exhibitors[idx].boothNumber, 
    details: body.details ?? data.exhibitors[idx].details,
    hasTrophy: body.hasTrophy ?? data.exhibitors[idx].hasTrophy
  };
  await saveData(data);
  return Response.json({ success: true, data: data.exhibitors[idx] });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'EXHIBITOR')) return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return Response.json({ success: false, error: 'Missing profile ID' }, { status: 400 });
  const data = await getData();
  const idx = data.exhibitors.findIndex(e => e.id === id);
  if (idx === -1) return Response.json({ success: false, error: 'Not found' }, { status: 404 });
  data.exhibitors.splice(idx, 1);
  await saveData(data);
  return Response.json({ success: true });
}
