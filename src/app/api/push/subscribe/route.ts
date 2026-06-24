import { getData, saveData, generateId } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return Response.json({ success: false, error: 'Invalid subscription payload' }, { status: 400 });
    }

    const data = await getData();

    // Remove existing subscription with same endpoint to avoid duplicates
    data.pushSubscriptions = data.pushSubscriptions.filter(sub => sub.endpoint !== endpoint);

    // Add new subscription
    const newSub = {
      id: generateId(),
      userId: session.id,
      endpoint,
      keys: JSON.stringify(keys),
      createdAt: new Date().toISOString(),
    };

    data.pushSubscriptions.push(newSub);
    await saveData(data);

    return Response.json({ success: true, data: newSub });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { endpoint } = body;

    const data = await getData();
    data.pushSubscriptions = data.pushSubscriptions.filter(
      sub => !(sub.userId === session.id && sub.endpoint === endpoint)
    );
    await saveData(data);

    return Response.json({ success: true });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
