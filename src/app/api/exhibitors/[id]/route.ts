import { getData } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await getData();
  const exhibitor = data.exhibitors.find(e => e.id === id);

  if (!exhibitor) {
    return Response.json({ success: false, error: 'Exhibitor not found' }, { status: 404 });
  }

  const search = request.nextUrl.searchParams.get('q')?.toLowerCase() || '';
  let products = data.products.filter(p => p.exhibitorId === id);

  if (search) {
    products = products.filter(p =>
      p.title.toLowerCase().includes(search) ||
      p.description.toLowerCase().includes(search)
    );
  }

  const session = await getSession().catch(() => null);
  const isManager = !!(session && (session.role === 'ADMIN' || exhibitor.allowedUserIds.includes(session.id)));

  let conversions: any[] = [];
  if (isManager) {
    const productIds = products.map(p => p.id);
    conversions = data.purchaseConversions.filter(c => productIds.includes(c.productId));
  }

  return Response.json({ success: true, data: { exhibitor, products, conversions } });
}
