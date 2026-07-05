import { getData } from '@/lib/db';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const exhibitionId = searchParams.get('exhibitionId');
  if (!exhibitionId) {
    return Response.json({ success: false, error: 'Missing exhibitionId' }, { status: 400 });
  }

  const data = await getData();
  const record = data.aboutUs.find(a => a.exhibitionId === exhibitionId) || null;

  return Response.json({ success: true, data: record });
}
