import { getData } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getCacheVersion } from '@/lib/cache';

export async function GET(request: Request) {
  const session = await getSession();
  const dbVer = await getCacheVersion('home');
  const cacheTag = session ? `${dbVer}_${session.id}` : `${dbVer}_anon`;

  const ifNoneMatch = request.headers.get('if-none-match')?.replace(/W\//, '').replace(/"/g, '');
  if (ifNoneMatch === cacheTag) {
    return new Response(null, { status: 304 });
  }

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
    return new Response(JSON.stringify({ success: true, data: { exhibitions: [] } }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'ETag': `"${cacheTag}"`,
        'Cache-Control': 'no-cache',
      }
    });
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

  let userRegistration = null;
  if (session && data.exhibitionRegistrations) {
    const foundReg = data.exhibitionRegistrations.find(
      r => r.exhibitionId === exhibition.id && r.userId === session.id
    );
    if (foundReg) {
      userRegistration = {
        adultsCount: foundReg.adultsCount,
        childrenCount: foundReg.childrenCount
      };
    }
  }

  return new Response(JSON.stringify({
    success: true,
    data: {
      exhibition,
      exhibitions: enabledExhibitions,
      infos,
      userRegistration
    }
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'ETag': `"${cacheTag}"`,
      'Cache-Control': 'no-cache',
    }
  });
}
