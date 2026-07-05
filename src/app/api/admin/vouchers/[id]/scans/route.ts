import { getData } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  const data = await getData();

  // Find scans for this voucher
  const scans = data.voucherScans.filter(s => s.voucherId === id);
  const result = scans.map(s => {
    const user = data.users.find(u => u.id === s.userId);
    return {
      id: s.id,
      userId: s.userId,
      email: user ? user.email : 'Unknown Email',
      name: user ? user.name : 'Unknown User',
      scanId: s.scanId,
      scannedAt: s.scannedAt,
    };
  });

  // Sort by scannedAt ascending (earliest first)
  result.sort((a, b) => new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime());

  return Response.json({ success: true, data: result });
}
