import { getData, saveData, generateId } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'EXHIBITOR' && session.role !== 'ADMIN')) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const exhibitionId = searchParams.get('exhibitionId');
  if (!exhibitionId) {
    return Response.json({ success: false, error: 'Missing exhibitionId' }, { status: 400 });
  }

  const data = await getData();
  const profiles = data.exhibitors.filter(
    e => e.exhibitionId === exhibitionId && e.allowedUserIds.includes(session.id)
  );

  return Response.json({ success: true, data: profiles });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'EXHIBITOR' && session.role !== 'ADMIN')) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  const { exhibitionId, name, description, boothNumber, details, imageUrl } = body;

  if (!exhibitionId || !name) {
    return Response.json({ success: false, error: 'Missing exhibitionId or name' }, { status: 400 });
  }

  const data = await getData();
  
  // Check if they already have a profile for this exhibition
  const existing = data.exhibitors.find(
    e => e.exhibitionId === exhibitionId && e.allowedUserIds.includes(session.id)
  );
  if (existing) {
    return Response.json({ success: false, error: 'Profile already exists' }, { status: 400 });
  }

  const newExhibitor = {
    id: generateId(),
    exhibitionId,
    name,
    description: description || '',
    boothNumber: boothNumber || '',
    imageUrl: imageUrl || '',
    details: details || '',
    allowedUserIds: [session.id],
    createdAt: new Date().toISOString(),
  };

  data.exhibitors.push(newExhibitor);
  await saveData(data);

  return Response.json({ success: true, data: newExhibitor });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'EXHIBITOR' && session.role !== 'ADMIN')) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  const { id, name, description, boothNumber, details, imageUrl } = body;

  if (!id) {
    return Response.json({ success: false, error: 'Missing profile ID' }, { status: 400 });
  }

  const data = await getData();
  const idx = data.exhibitors.findIndex(e => e.id === id);
  if (idx === -1) {
    return Response.json({ success: false, error: 'Profile not found' }, { status: 404 });
  }

  const exhibitor = data.exhibitors[idx];
  // Verify ownership
  if (!exhibitor.allowedUserIds.includes(session.id)) {
    return Response.json({ success: false, error: 'Unauthorized to modify this profile' }, { status: 403 });
  }

  data.exhibitors[idx] = {
    ...exhibitor,
    name: name ?? exhibitor.name,
    description: description ?? exhibitor.description,
    boothNumber: boothNumber ?? exhibitor.boothNumber,
    details: details ?? exhibitor.details,
    imageUrl: imageUrl ?? exhibitor.imageUrl,
  };

  await saveData(data);
  return Response.json({ success: true, data: data.exhibitors[idx] });
}
