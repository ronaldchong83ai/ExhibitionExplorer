import { getData, saveData, generateId } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'REDEMPTOR')) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  const data = await getData();

  const collections = data.voucherCollections.filter(c => c.voucherId === id);
  const result = collections.map(c => {
    const user = data.users.find(u => u.id === c.userId);
    return {
      id: c.id,
      userId: c.userId,
      name: user ? user.name : 'Unknown User',
      email: user ? user.email : 'Unknown Email',
      collectedAt: c.collectedAt,
      giftedBy: c.giftedBy || null,
    };
  });

  // Sort by collectedAt date ascending (earliest first)
  result.sort((a, b) => new Date(a.collectedAt).getTime() - new Date(b.collectedAt).getTime());

  return Response.json({ success: true, data: result });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'REDEMPTOR')) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const email = (body.email || '').trim().toLowerCase();

  if (!email) {
    return Response.json({ success: false, error: 'Email is required' }, { status: 400 });
  }

  const data = await getData();

  // Find user by email
  const user = data.users.find(u => u.email.toLowerCase() === email);
  if (!user) {
    return Response.json({ success: false, error: 'User with this email not found' }, { status: 404 });
  }

  // Check if already collected
  const alreadyCollected = data.voucherCollections.some(
    c => c.voucherId === id && c.userId === user.id
  );

  if (alreadyCollected) {
    return Response.json({ success: false, error: 'Voucher already collected by this user' }, { status: 400 });
  }

  // Create new collection
  const newCollection = {
    id: generateId(),
    voucherId: id,
    userId: user.id,
    collectedAt: new Date().toISOString(),
    giftedBy: session.email,
  };

  data.voucherCollections.push(newCollection);
  await saveData(data);

  return Response.json({
    success: true,
    data: {
      id: newCollection.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      collectedAt: newCollection.collectedAt,
      giftedBy: newCollection.giftedBy,
    },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || (session.role !== 'ADMIN' && session.role !== 'REDEMPTOR')) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  const userId = request.nextUrl.searchParams.get('userId') || '';

  if (!userId) {
    return Response.json({ success: false, error: 'userId parameter is required' }, { status: 400 });
  }

  const data = await getData();

  const idx = data.voucherCollections.findIndex(
    c => c.voucherId === id && c.userId === userId
  );

  if (idx === -1) {
    return Response.json({ success: false, error: 'Voucher collection record not found' }, { status: 404 });
  }

  data.voucherCollections.splice(idx, 1);
  await saveData(data);

  return Response.json({ success: true });
}
