import { getData, saveData, generateId } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { NextRequest } from 'next/server';

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const data = await getData();
  const settings = data.notificationSettings.filter(s => s.userId === session.id);
  return Response.json({ success: true, data: settings });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const { hoursBeforeEvent } = await request.json();
  const data = await getData();

  const setting = {
    id: generateId(),
    userId: session.id,
    hoursBeforeEvent,
    createdAt: new Date().toISOString(),
  };
  data.notificationSettings.push(setting);
  await saveData(data);

  return Response.json({ success: true, data: setting });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const { id } = await request.json();
  const data = await getData();
  data.notificationSettings = data.notificationSettings.filter(s => !(s.id === id && s.userId === session.id));
  await saveData(data);

  return Response.json({ success: true });
}
