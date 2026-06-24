import { getData } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  const exhibitorId = request.nextUrl.searchParams.get('exhibitorId') || '';
  const data = await getData();
  const products = data.products.filter(p => p.exhibitorId === exhibitorId);
  const conversions = data.purchaseConversions.filter(c => products.some(p => p.id === c.productId));
  return Response.json({ success: true, data: { products, conversions } });
}
