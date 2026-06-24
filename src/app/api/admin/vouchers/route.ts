import { getData, saveData, generateId } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const exhibitionId = request.nextUrl.searchParams.get('exhibitionId') || '';
  const data = await getData();
  return Response.json({ success: true, data: data.vouchers.filter(v => v.exhibitionId === exhibitionId) });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const body = await request.json();
  const data = await getData();
  const item = {
    id: generateId(), exhibitionId: body.exhibitionId, title: body.title || '', description: body.description || '',
    details: body.details || '', requiredScanIds: body.requiredScanIds || [], createdAt: new Date().toISOString(),
  };
  data.vouchers.push(item);
  await saveData(data);
  return Response.json({ success: true, data: item });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const body = await request.json();
  const data = await getData();
  const idx = data.vouchers.findIndex(v => v.id === body.id);
  if (idx === -1) return Response.json({ success: false, error: 'Not found' }, { status: 404 });
  data.vouchers[idx] = { ...data.vouchers[idx], title: body.title ?? data.vouchers[idx].title, description: body.description ?? data.vouchers[idx].description, details: body.details ?? data.vouchers[idx].details, requiredScanIds: body.requiredScanIds ?? data.vouchers[idx].requiredScanIds };
  await saveData(data);
  return Response.json({ success: true, data: data.vouchers[idx] });
}
