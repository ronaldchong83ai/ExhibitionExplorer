import { prisma, invalidateCache } from './db';

/**
 * Checks if the client's cached data is still valid by comparing ETag with DB version.
 * If valid, returns a 304 Not Modified response.
 */
export async function verifyCache(request: Request, key: string): Promise<Response | null> {
  const ifNoneMatch = request.headers.get('if-none-match');
  if (!ifNoneMatch) return null;

  try {
    const dbVer = await prisma.dbVersion.findUnique({
      where: { key }
    });

    // Strip out quotes if browser wrapped ETag (e.g. W/"version" or "version")
    const cleanIfNoneMatch = ifNoneMatch.replace(/W\//, '').replace(/"/g, '');

    if (dbVer && dbVer.version === cleanIfNoneMatch) {
      return new Response(null, { status: 304 });
    }
  } catch (err) {
    console.error(`Cache check error for key ${key}:`, err);
  }
  return null;
}

/**
 * Appends ETag and Cache-Control headers to the response.
 */
export function withCacheHeaders(data: any, version: string): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'ETag': `"${version}"`,
      'Cache-Control': 'no-cache', // Must revalidate on every request
    }
  });
}

/**
 * Fetch the current version of a key from the database.
 */
export async function getCacheVersion(key: string): Promise<string> {
  try {
    const dbVer = await prisma.dbVersion.findUnique({
      where: { key }
    });
    return dbVer ? dbVer.version : '1';
  } catch {
    return '1';
  }
}

export { invalidateCache };

