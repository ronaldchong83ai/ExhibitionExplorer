import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  // Only admins can see the list of feedbacks
  if (session.role !== 'ADMIN') {
    return Response.json({ success: false, error: 'Unauthorized access' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const exhibitionId = searchParams.get('exhibitionId');
    const where: any = {};
    if (exhibitionId) {
      where.exhibitionId = exhibitionId;
    }

    const feedbacks = await prisma.feedback.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return Response.json({ success: true, data: feedbacks });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message || 'Database error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const { content, exhibitionId } = await request.json();

    if (!content || !content.trim()) {
      return Response.json({ success: false, error: 'Feedback content is required' }, { status: 400 });
    }

    const feedback = await prisma.feedback.create({
      data: {
        userId: session.id,
        userName: session.name,
        userEmail: session.email,
        content: content.trim(),
        exhibitionId: exhibitionId || null,
      },
    });

    return Response.json({ success: true, data: feedback });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message || 'Failed to submit feedback' }, { status: 500 });
  }
}
