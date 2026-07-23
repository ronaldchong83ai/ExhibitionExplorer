import { getData } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const data = await getData();
  const url = new URL(request.url);
  let exhibitionId = url.searchParams.get('exhibitionId');

  let exhibition = data.exhibitions.find(e => e.id === exhibitionId) || null;
  if (!exhibition) {
    exhibition = data.exhibitions.find(e => e.enabled) || data.exhibitions[0] || null;
  }
  if (!exhibition) return Response.json({ success: true, data: { vouchers: [], exhibition: null } });

  const now = new Date();
  const vouchers = data.vouchers
    .filter(v => {
      if (v.exhibitionId !== exhibition.id) return false;
      if (v.displayFrom && v.displayFrom.trim()) {
        if (now < new Date(v.displayFrom)) return false;
      }
      if (v.displayTo && v.displayTo.trim()) {
        if (now > new Date(v.displayTo)) return false;
      }
      return true;
    })
    .map(v => {
      const scans = data.voucherScans.filter(s => s.voucherId === v.id && s.userId === session.id);
      const scannedIds = scans.map(s => s.scanId);
      const isCollected = data.voucherCollections.some(c => c.voucherId === v.id && c.userId === session.id);
      return {
        ...v,
        scannedIds,
        collectedCount: scans.length,
        totalRequired: v.requiredScanIds.length,
        isComplete: scans.length >= v.requiredScanIds.length,
        isCollected,
      };
    });

  vouchers.sort((a, b) => {
    const dateA = a.displayFrom ? new Date(a.displayFrom).getTime() : 0;
    const dateB = b.displayFrom ? new Date(b.displayFrom).getTime() : 0;
    return dateA - dateB;
  });

  return Response.json({ success: true, data: { vouchers, exhibition } });
}
