import { getData, saveData, generateId } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'EXHIBITOR' && session.role !== 'ADMIN')) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const exhibitionId = searchParams.get('exhibitionId');
  if (!exhibitionId) {
    return Response.json({ success: false, error: 'Missing exhibitionId' }, { status: 400 });
  }

  const data = await getData();
  // Find the exhibitor profile for this user
  const profile = data.exhibitors.find(
    e => e.exhibitionId === exhibitionId && e.allowedUserIds.includes(session.id)
  );

  if (!profile) {
    return Response.json({ success: true, data: { products: [], conversions: [] } });
  }

  const products = data.products.filter(p => p.exhibitorId === profile.id);
  const productIds = products.map(p => p.id);
  const conversions = data.purchaseConversions.filter(c => productIds.includes(c.productId));

  return Response.json({ success: true, data: { products, conversions } });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'EXHIBITOR' && session.role !== 'ADMIN')) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  const { exhibitorId, title, description, details, imageUrl } = body;

  if (!exhibitorId || !title) {
    return Response.json({ success: false, error: 'Missing exhibitorId or title' }, { status: 400 });
  }

  const data = await getData();
  const profile = data.exhibitors.find(e => e.id === exhibitorId);

  if (!profile) {
    return Response.json({ success: false, error: 'Exhibitor profile not found' }, { status: 404 });
  }

  const isAuthorized = session.role === 'ADMIN' || profile.allowedUserIds.includes(session.id);
  if (!isAuthorized) {
    return Response.json({ success: false, error: 'Unauthorized to modify this profile' }, { status: 403 });
  }

  const newProduct = {
    id: generateId(),
    exhibitorId: profile.id,
    title,
    description: description || '',
    details: details || '',
    imageUrl: imageUrl || '',
    createdAt: new Date().toISOString(),
  };

  data.products.push(newProduct);
  await saveData(data);

  return Response.json({ success: true, data: newProduct });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== 'EXHIBITOR' && session.role !== 'ADMIN')) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  const { id, title, description, details, imageUrl, conversions } = body;

  if (!id) {
    return Response.json({ success: false, error: 'Missing product ID' }, { status: 400 });
  }

  const data = await getData();
  const idx = data.products.findIndex(p => p.id === id);
  if (idx === -1) {
    return Response.json({ success: false, error: 'Product not found' }, { status: 404 });
  }

  const product = data.products[idx];
  
  // Verify ownership via the product's exhibitor
  const exhibitor = data.exhibitors.find(e => e.id === product.exhibitorId);
  if (!exhibitor || (session.role !== 'ADMIN' && !exhibitor.allowedUserIds.includes(session.id))) {
    return Response.json({ success: false, error: 'Unauthorized to modify this product' }, { status: 403 });
  }

  // Update product fields
  data.products[idx] = {
    ...product,
    title: title ?? product.title,
    description: description ?? product.description,
    details: details ?? product.details,
    imageUrl: imageUrl ?? product.imageUrl,
  };

  // Update sub records of purchase conversion
  if (Array.isArray(conversions)) {
    // Delete existing
    data.purchaseConversions = data.purchaseConversions.filter(c => c.productId !== id);
    // Add new ones
    const newConversions = conversions.map(c => ({
      id: c.id || generateId(),
      productId: id,
      date: c.date,
      value: Number(c.value) || 0,
    }));
    data.purchaseConversions.push(...newConversions);
  }

  await saveData(data);
  return Response.json({ success: true, data: data.products[idx] });
}
