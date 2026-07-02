import { getData, saveData, generateId } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const exhibitionId = request.nextUrl.searchParams.get('exhibitionId') || '';
  const data = await getData();
  const filtered = data.stageEvents.filter(e => e.exhibitionId === exhibitionId);
  filtered.sort((a, b) => new Date(a.periodFrom).getTime() - new Date(b.periodFrom).getTime());
  return Response.json({ success: true, data: filtered });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const body = await request.json();

  if (!body.title || !body.title.trim()) {
    return Response.json({ success: false, error: 'Title is required' }, { status: 400 });
  }
  if (!body.periodFrom) {
    return Response.json({ success: false, error: 'Period From is required' }, { status: 400 });
  }
  if (!body.periodTo) {
    return Response.json({ success: false, error: 'Period To is required' }, { status: 400 });
  }
  if (!body.stageNumber || !body.stageNumber.trim()) {
    return Response.json({ success: false, error: 'Stage Number is required' }, { status: 400 });
  }

  if (new Date(body.periodTo).getTime() < new Date(body.periodFrom).getTime()) {
    return Response.json({ success: false, error: 'Period To cannot be earlier than Period From' }, { status: 400 });
  }

  const data = await getData();
  const item = {
    id: generateId(), exhibitionId: body.exhibitionId, title: body.title || '',
    periodFrom: body.periodFrom ? new Date(body.periodFrom).toISOString() : '', periodTo: body.periodTo ? new Date(body.periodTo).toISOString() : '',
    stageNumber: body.stageNumber || '', speakerNames: body.speakerNames || [], details: body.details || '', createdAt: new Date().toISOString(),
  };
  data.stageEvents.push(item);
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
  if (body.periodFrom !== undefined && !body.periodFrom) {
    return Response.json({ success: false, error: 'Period From is required' }, { status: 400 });
  }
  if (body.periodTo !== undefined && !body.periodTo) {
    return Response.json({ success: false, error: 'Period To is required' }, { status: 400 });
  }
  if (body.stageNumber !== undefined && (!body.stageNumber || !body.stageNumber.trim())) {
    return Response.json({ success: false, error: 'Stage Number is required' }, { status: 400 });
  }

  const data = await getData();
  const idx = data.stageEvents.findIndex(e => e.id === body.id);
  if (idx === -1) return Response.json({ success: false, error: 'Not found' }, { status: 404 });

  const checkFrom = body.periodFrom !== undefined ? body.periodFrom : data.stageEvents[idx].periodFrom;
  const checkTo = body.periodTo !== undefined ? body.periodTo : data.stageEvents[idx].periodTo;
  if (new Date(checkTo).getTime() < new Date(checkFrom).getTime()) {
    return Response.json({ success: false, error: 'Period To cannot be earlier than Period From' }, { status: 400 });
  }

  data.stageEvents[idx] = { ...data.stageEvents[idx], ...body,
    periodFrom: body.periodFrom ? new Date(body.periodFrom).toISOString() : data.stageEvents[idx].periodFrom,
    periodTo: body.periodTo ? new Date(body.periodTo).toISOString() : data.stageEvents[idx].periodTo,
    speakerNames: body.speakerNames || data.stageEvents[idx].speakerNames,
  };
  await saveData(data);
  return Response.json({ success: true, data: data.stageEvents[idx] });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return Response.json({ success: false, error: 'Missing stage event ID' }, { status: 400 });
  const data = await getData();
  const idx = data.stageEvents.findIndex(e => e.id === id);
  if (idx === -1) return Response.json({ success: false, error: 'Not found' }, { status: 404 });
  data.stageEvents.splice(idx, 1);
  await saveData(data);
  return Response.json({ success: true });
}
