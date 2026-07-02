import { getData, saveData, generateId } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const exhibitionId = request.nextUrl.searchParams.get('exhibitionId') || '';
  console.log("[API/GET home-info] exhibitionId parsed:", exhibitionId);
  const data = await getData();
  console.log("[API/GET home-info] total homePageInfos count:", data.homePageInfos.length);
  const filtered = data.homePageInfos.filter(h => h.exhibitionId === exhibitionId);
  filtered.sort((a, b) => {
    const hasDateA = !!a.displayFrom;
    const hasDateB = !!b.displayFrom;

    if (!hasDateA && !hasDateB) {
      const typeWeight: Record<string, number> = {
        'IMPORTANT_NOTICE': 1,
        'ANNOUNCEMENT': 2,
        'EVENT_INFO': 3
      };
      const wA = typeWeight[a.type] || 99;
      const wB = typeWeight[b.type] || 99;
      if (wA !== wB) return wA - wB;
      return a.title.localeCompare(b.title);
    }

    if (!hasDateA && hasDateB) return -1;
    if (hasDateA && !hasDateB) return 1;

    const tA = new Date(a.displayFrom).getTime();
    const tB = new Date(b.displayFrom).getTime();
    return tA - tB;
  });
  console.log("[API/GET home-info] filtered count:", filtered.length);
  return Response.json({ success: true, data: filtered });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const body = await request.json();

  if (!body.title || !body.title.trim()) {
    return Response.json({ success: false, error: 'Title is required' }, { status: 400 });
  }

  const data = await getData();
  const item = {
    id: generateId(), exhibitionId: body.exhibitionId, title: body.title || '', type: body.type || 'EVENT_INFO',
    description: body.description || '', displayFrom: body.displayFrom ? new Date(body.displayFrom).toISOString() : '',
    displayTo: body.displayTo ? new Date(body.displayTo).toISOString() : '', details: body.details || '', createdAt: new Date().toISOString(),
  };
  data.homePageInfos.push(item);
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

  const data = await getData();
  const idx = data.homePageInfos.findIndex(h => h.id === body.id);
  if (idx === -1) return Response.json({ success: false, error: 'Not found' }, { status: 404 });
  data.homePageInfos[idx] = { 
    ...data.homePageInfos[idx], 
    ...body, 
    displayFrom: body.displayFrom !== undefined ? (body.displayFrom ? new Date(body.displayFrom).toISOString() : '') : data.homePageInfos[idx].displayFrom, 
    displayTo: body.displayTo !== undefined ? (body.displayTo ? new Date(body.displayTo).toISOString() : '') : data.homePageInfos[idx].displayTo 
  };
  await saveData(data);
  return Response.json({ success: true, data: data.homePageInfos[idx] });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return Response.json({ success: false, error: 'Missing home info ID' }, { status: 400 });
  const data = await getData();
  const idx = data.homePageInfos.findIndex(h => h.id === id);
  if (idx === -1) return Response.json({ success: false, error: 'Not found' }, { status: 404 });
  data.homePageInfos.splice(idx, 1);
  await saveData(data);
  return Response.json({ success: true });
}
