import { getData } from '@/lib/db';
import { verifyCache, withCacheHeaders, getCacheVersion } from '@/lib/cache';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const cacheRes = await verifyCache(request, 'stages');
  if (cacheRes) return cacheRes;

  const data = await getData();
  const search = request.nextUrl.searchParams.get('q')?.toLowerCase() || '';
  const exhibitionId = request.nextUrl.searchParams.get('exhibitionId') || data.exhibitions[0]?.id;

  let events = data.stageEvents.filter(e => e.exhibitionId === exhibitionId);

  if (search) {
    events = events.filter(e =>
      e.title.toLowerCase().includes(search) ||
      e.stageNumber.toLowerCase().includes(search) ||
      e.speakerNames.some(s => s.toLowerCase().includes(search))
    );
  }

  events.sort((a, b) => new Date(a.periodFrom).getTime() - new Date(b.periodFrom).getTime());

  const exhibition = data.exhibitions.find(e => e.id === exhibitionId) || null;
  const version = await getCacheVersion('stages');
  return withCacheHeaders({ success: true, data: { events, exhibition } }, version);
}
