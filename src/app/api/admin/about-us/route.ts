import { getData, saveData, generateId } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { exhibitionId, content } = body;

    if (!exhibitionId) {
      return Response.json({ success: false, error: 'Missing exhibitionId' }, { status: 400 });
    }

    const data = await getData();
    const existingIdx = data.aboutUs.findIndex(a => a.exhibitionId === exhibitionId);

    if (existingIdx !== -1) {
      data.aboutUs[existingIdx] = {
        ...data.aboutUs[existingIdx],
        content,
        updatedAt: new Date().toISOString()
      };
    } else {
      data.aboutUs.push({
        id: generateId(),
        exhibitionId,
        content,
        updatedAt: new Date().toISOString()
      });
    }

    await saveData(data);
    return Response.json({ success: true });
  } catch (error: any) {
    console.error('Save About Us error:', error);
    return Response.json({ success: false, error: error.message || 'Failed to save' }, { status: 500 });
  }
}
