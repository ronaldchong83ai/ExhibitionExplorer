import { getData, saveData, generateId } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const exhibitionId = request.nextUrl.searchParams.get('exhibitionId') || '';
  const data = await getData();
  return Response.json({ success: true, data: data.stageEvents.filter(e => e.exhibitionId === exhibitionId) });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const body = await request.json();
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
  const data = await getData();
  const idx = data.stageEvents.findIndex(e => e.id === body.id);
  if (idx === -1) return Response.json({ success: false, error: 'Not found' }, { status: 404 });
  data.stageEvents[idx] = { ...data.stageEvents[idx], ...body,
    periodFrom: body.periodFrom ? new Date(body.periodFrom).toISOString() : data.stageEvents[idx].periodFrom,
    periodTo: body.periodTo ? new Date(body.periodTo).toISOString() : data.stageEvents[idx].periodTo,
    speakerNames: body.speakerNames || data.stageEvents[idx].speakerNames,
  };
  await saveData(data);
  return Response.json({ success: true, data: data.stageEvents[idx] });
}
