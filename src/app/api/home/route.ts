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
      const hasDateA = !!a.displayFrom;
      const hasDateB = !!b.displayFrom;

      if (!hasDateA && !hasDateB) {
        const typeWeight: Record<string, number> = {
          'IMPORTANT_NOTICE': 1,
          'ANNOUNCEMENT': 2,
          'EVENT_INFO': 3
        };
        const wA = typeWeight[a.type] || 99;
        const wB = typeWeight[b.type] || 99;
        if (wA !== wB) return wA - wB;
        return a.title.localeCompare(b.title);
      }

      if (!hasDateA && hasDateB) return -1;
      if (hasDateA && !hasDateB) return 1;

      const tA = new Date(a.displayFrom).getTime();
      const tB = new Date(b.displayFrom).getTime();
      return tA - tB;
    });

  const version = await getCacheVersion('home');
  return withCacheHeaders({ success: true, data: { exhibition, exhibitions: enabledExhibitions, infos } }, version);
}
