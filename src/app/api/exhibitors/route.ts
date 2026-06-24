import { getData } from '@/lib/db';
import { verifyCache, withCacheHeaders, getCacheVersion } from '@/lib/cache';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const cacheRes = await verifyCache(request, 'exhibitors');
  if (cacheRes) return cacheRes;

  const data = await getData();
  const search = request.nextUrl.searchParams.get('q')?.toLowerCase() || '';
  const exhibitionId = request.nextUrl.searchParams.get('exhibitionId') || data.exhibitions[0]?.id;

  let exhibitors = data.exhibitors.filter(e => e.exhibitionId === exhibitionId);

  if (search) {
    exhibitors = exhibitors.filter(e =>
      e.name.toLowerCase().includes(search) ||
      e.description.toLowerCase().includes(search) ||
      e.boothNumber.toLowerCase().includes(search)
    );
  }

  exhibitors.sort((a, b) => a.boothNumber.localeCompare(b.boothNumber));

  const exhibition = data.exhibitions.find(e => e.id === exhibitionId) || null;
  const version = await getCacheVersion('exhibitors');
  return withCacheHeaders({ success: true, data: { exhibitors, exhibition } }, version);
}
