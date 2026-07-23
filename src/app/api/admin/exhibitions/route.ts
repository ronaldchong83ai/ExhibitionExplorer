import { getData, saveData, generateId } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { NextRequest } from 'next/server';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const data = await getData();
  return Response.json({ success: true, data: data.exhibitions });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const body = await request.json();

  if (!body.title || !body.title.trim()) {
    return Response.json({ success: false, error: 'Title is required' }, { status: 400 });
  }
  if (!body.eventPeriodFrom) {
    return Response.json({ success: false, error: 'Event Period From is required' }, { status: 400 });
  }
  if (!body.eventPeriodTo) {
    return Response.json({ success: false, error: 'Event Period To is required' }, { status: 400 });
  }

  const data = await getData();
  const exhibition = {
    id: generateId(),
    title: body.title || '',
    description: body.description || '',
    eventPeriodFrom: body.eventPeriodFrom ? new Date(body.eventPeriodFrom).toISOString() : '',
    eventPeriodTo: body.eventPeriodTo ? new Date(body.eventPeriodTo).toISOString() : '',
    details: body.details || '',
    enabled: body.enabled !== false,
    logoUrl: body.logoUrl || null,
    createdBy: session.id,
    createdAt: new Date().toISOString(),
  };
  data.exhibitions.push(exhibition);
  await saveData(data);
  return Response.json({ success: true, data: exhibition });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const body = await request.json();

  if (body.title !== undefined && (!body.title || !body.title.trim())) {
    return Response.json({ success: false, error: 'Title is required' }, { status: 400 });
  }
  if (body.eventPeriodFrom !== undefined && !body.eventPeriodFrom) {
    return Response.json({ success: false, error: 'Event Period From is required' }, { status: 400 });
  }
  if (body.eventPeriodTo !== undefined && !body.eventPeriodTo) {
    return Response.json({ success: false, error: 'Event Period To is required' }, { status: 400 });
  }

  const data = await getData();
  const idx = data.exhibitions.findIndex(e => e.id === body.id);
  if (idx === -1) return Response.json({ success: false, error: 'Not found' }, { status: 404 });

  data.exhibitions[idx] = {
    ...data.exhibitions[idx],
    title: body.title ?? data.exhibitions[idx].title,
    description: body.description ?? data.exhibitions[idx].description,
    eventPeriodFrom: body.eventPeriodFrom ? new Date(body.eventPeriodFrom).toISOString() : data.exhibitions[idx].eventPeriodFrom,
    eventPeriodTo: body.eventPeriodTo ? new Date(body.eventPeriodTo).toISOString() : data.exhibitions[idx].eventPeriodTo,
    details: body.details ?? data.exhibitions[idx].details,
    enabled: body.enabled ?? data.exhibitions[idx].enabled,
    logoUrl: body.logoUrl !== undefined ? body.logoUrl : data.exhibitions[idx].logoUrl,
  };
  await saveData(data);
  return Response.json({ success: true, data: data.exhibitions[idx] });
}
