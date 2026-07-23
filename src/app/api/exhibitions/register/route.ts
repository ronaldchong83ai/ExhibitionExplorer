import { getData, saveData, generateId } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { exhibitionId, scanId, adultsCount, childrenCount } = body;

    if (!exhibitionId) {
      return Response.json({ success: false, error: 'Exhibition ID is required' }, { status: 400 });
    }

    const data = await getData();
    const exhibition = data.exhibitions.find(e => e.id === exhibitionId);

    if (!exhibition) {
      return Response.json({ success: false, error: 'Exhibition not found' }, { status: 404 });
    }

    // Verify scanId if exhibition has a required scanId configured
    if (exhibition.scanId && exhibition.scanId.trim()) {
      if (!scanId || scanId.trim().toLowerCase() !== exhibition.scanId.trim().toLowerCase()) {
        return Response.json({
          success: false,
          error: `Scanned ID "${scanId || ''}" does not match this exhibition's required Scan ID ("${exhibition.scanId}").`
        }, { status: 400 });
      }
    }

    const adults = Math.max(1, Math.min(10, parseInt(adultsCount, 10) || 1));
    const children = Math.max(0, Math.min(10, parseInt(childrenCount, 10) || 0));

    if (!data.exhibitionRegistrations) {
      data.exhibitionRegistrations = [];
    }

    const existingIdx = data.exhibitionRegistrations.findIndex(
      r => r.exhibitionId === exhibitionId && r.userId === session.id
    );

    let registration;
    if (existingIdx !== -1) {
      data.exhibitionRegistrations[existingIdx] = {
        ...data.exhibitionRegistrations[existingIdx],
        adultsCount: adults,
        childrenCount: children,
        updatedAt: new Date().toISOString()
      };
      registration = data.exhibitionRegistrations[existingIdx];
    } else {
      registration = {
        id: generateId(),
        exhibitionId,
        userId: session.id,
        adultsCount: adults,
        childrenCount: children,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      data.exhibitionRegistrations.push(registration);
    }

    await saveData(data);

    return Response.json({
      success: true,
      message: `Successfully registered ${children} Children and ${adults} Adults for ${exhibition.title}.`,
      registration: {
        adultsCount: adults,
        childrenCount: children
      }
    });

  } catch (error: any) {
    console.error('Exhibition registration error:', error);
    return Response.json({ success: false, error: error.message || 'Failed to process registration' }, { status: 500 });
  }
}
