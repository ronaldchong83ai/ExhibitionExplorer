import { getData } from '@/lib/db';
import type { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await getData();
  const event = data.stageEvents.find(e => e.id === id);

  if (!event) {
    return Response.json({ success: false, error: 'Stage event not found' }, { status: 404 });
  }

  return Response.json({ success: true, data: event });
}
