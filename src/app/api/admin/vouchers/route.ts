import { getData, saveData, generateId } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const exhibitionId = request.nextUrl.searchParams.get('exhibitionId') || '';
  const data = await getData();
  const filtered = data.vouchers.filter(v => v.exhibitionId === exhibitionId);
  filtered.sort((a, b) => {
    const dateA = a.displayFrom ? new Date(a.displayFrom).getTime() : 0;
    const dateB = b.displayFrom ? new Date(b.displayFrom).getTime() : 0;
    return dateA - dateB;
  });
  return Response.json({ success: true, data: filtered });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const body = await request.json();
  
  if (!body.title || !body.title.trim()) {
    return Response.json({ success: false, error: 'Title is required' }, { status: 400 });
  }
  if (!body.displayFrom) {
    return Response.json({ success: false, error: 'Display Period From is required' }, { status: 400 });
  }
  if (!body.displayTo) {
    return Response.json({ success: false, error: 'Display Period To is required' }, { status: 400 });
  }

  const data = await getData();
  const scanItems = body.scanItems !== undefined ? body.scanItems : null;
  const requiredScanIds = scanItems ? scanItems.map((s: any) => s.scanId) : (body.requiredScanIds || []);

  const item = {
    id: generateId(),
    exhibitionId: body.exhibitionId,
    title: body.title || '',
    description: body.description || '',
    details: body.details || '',
    requiredScanIds,
    scanItems,
    displayFrom: body.displayFrom ? new Date(body.displayFrom).toISOString() : '',
    displayTo: body.displayTo ? new Date(body.displayTo).toISOString() : '',
    createdAt: new Date().toISOString(),
  };
  data.vouchers.push(item);
  await saveData(data);
  return Response.json({ success: true, data: item });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const body = await request.json();

  if (body.title !== undefined && (!body.title || !body.title.trim())) {
    return Response.json({ success: false, error: 'Title is required' }, { status: 400 });
  }
  if (body.displayFrom !== undefined && !body.displayFrom) {
    return Response.json({ success: false, error: 'Display Period From is required' }, { status: 400 });
  }
  if (body.displayTo !== undefined && !body.displayTo) {
    return Response.json({ success: false, error: 'Display Period To is required' }, { status: 400 });
  }

  const data = await getData();
  const idx = data.vouchers.findIndex(v => v.id === body.id);
  if (idx === -1) return Response.json({ success: false, error: 'Not found' }, { status: 404 });

  const updatedScanItems = body.scanItems !== undefined ? body.scanItems : data.vouchers[idx].scanItems;
  const updatedRequiredScanIds = body.scanItems !== undefined 
    ? body.scanItems.map((s: any) => s.scanId) 
    : (body.requiredScanIds ?? data.vouchers[idx].requiredScanIds);

  data.vouchers[idx] = { 
    ...data.vouchers[idx], 
    title: body.title ?? data.vouchers[idx].title, 
    description: body.description ?? data.vouchers[idx].description, 
    details: body.details ?? data.vouchers[idx].details, 
    requiredScanIds: updatedRequiredScanIds,
    scanItems: updatedScanItems,
    displayFrom: body.displayFrom !== undefined ? (body.displayFrom ? new Date(body.displayFrom).toISOString() : '') : data.vouchers[idx].displayFrom,
    displayTo: body.displayTo !== undefined ? (body.displayTo ? new Date(body.displayTo).toISOString() : '') : data.vouchers[idx].displayTo
  };
  await saveData(data);
  return Response.json({ success: true, data: data.vouchers[idx] });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return Response.json({ success: false, error: 'Missing voucher ID' }, { status: 400 });
  const data = await getData();
  const idx = data.vouchers.findIndex(v => v.id === id);
  if (idx === -1) return Response.json({ success: false, error: 'Not found' }, { status: 404 });
  data.vouchers.splice(idx, 1);
  await saveData(data);
  return Response.json({ success: true });
}
