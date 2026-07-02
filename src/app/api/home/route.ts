import { getData } from '@/lib/db';
import { verifyCache, withCacheHeaders, getCacheVersion } from '@/lib/cache';

export async function GET(request: Request) {
  const cacheRes = await verifyCache(request, 'home');
  if (cacheRes) return cacheRes;

  const data = await getData();
  const enabledExhibitions = data.exhibitions.filter(e => e.enabled !== false);
  
  const url = new URL(request.url);
  const exhibitionId = url.searchParams.get('exhibitionId');
  
  let exhibition = enabledExhibitions[0] || data.exhibitions[0];
  if (exhibitionId) {
    const found = data.exhibitions.find(e => e.id === exhibitionId);
    if (found) exhibition = found;
  }

  if (!exhibition) {
    const version = await getCacheVersion('home');
    return withCacheHeaders({ success: true, data: { exhibitions: [] } }, version);
  }

  const infos = data.homePageInfos
    .filter(h => h.exhibitionId === exhibition.id)
    .sort((a, b) => {
      const tA = a.displayFrom ? new Date(a.displayFrom).getTime() : 0;
      const tB = b.displayFrom ? new Date(b.displayFrom).getTime() : 0;
      if (tA === 0 && tB !== 0) return 1;
      if (tB === 0 && tA !== 0) return -1;
      return tA - tB;
    });

  const version = await getCacheVersion('home');
  return withCacheHeaders({ success: true, data: { exhibition, exhibitions: enabledExhibitions, infos } }, version);
}
