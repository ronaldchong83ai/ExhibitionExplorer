import { getData, saveData, generateId } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const exhibitionId = searchParams.get('exhibitionId');
  if (!exhibitionId) {
    return Response.json({ success: false, error: 'Missing exhibitionId' }, { status: 400 });
  }

  const data = await getData();
  const map = data.venueMaps.find(m => m.exhibitionId === exhibitionId) || null;

  return Response.json({ success: true, data: map });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  const { exhibitionId, imageUrl } = body;

  if (!exhibitionId || !imageUrl) {
    return Response.json({ success: false, error: 'Missing exhibitionId or imageUrl' }, { status: 400 });
  }

  const data = await getData();
  const existingIdx = data.venueMaps.findIndex(m => m.exhibitionId === exhibitionId);

  if (existingIdx !== -1) {
    data.venueMaps[existingIdx] = {
      ...data.venueMaps[existingIdx],
      imageUrl,
      uploadedAt: new Date().toISOString()
    };
  } else {
    data.venueMaps.push({
      id: generateId(),
      exhibitionId,
      imageUrl,
      uploadedAt: new Date().toISOString()
    });
  }

  await saveData(data);

  return Response.json({ success: true, data: data.venueMaps.find(m => m.exhibitionId === exhibitionId) });
}
