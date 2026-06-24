import { getData } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const data = await getData();
  const url = new URL(request.url);
  const exhibitionId = url.searchParams.get('exhibitionId') || data.exhibitions[0]?.id;

  const exhibition = data.exhibitions.find(e => e.id === exhibitionId) || null;
  if (!exhibition) return Response.json({ success: true, data: { vouchers: [], exhibition: null } });

  const vouchers = data.vouchers
    .filter(v => v.exhibitionId === exhibition.id)
    .map(v => {
      const scans = data.voucherScans.filter(s => s.voucherId === v.id && s.userId === session.id);
      const isCollected = data.voucherCollections.some(c => c.voucherId === v.id && c.userId === session.id);
      return {
        ...v,
        collectedCount: scans.length,
        totalRequired: v.requiredScanIds.length,
        isComplete: scans.length >= v.requiredScanIds.length,
        isCollected,
      };
    });

  return Response.json({ success: true, data: { vouchers, exhibition } });
}
