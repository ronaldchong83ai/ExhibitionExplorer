import { getSession } from '@/lib/auth';
import type { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const exhibitionId = searchParams.get('exhibitionId') || '';
  if (!exhibitionId) {
    return Response.json({ success: false, error: 'Missing exhibitionId' }, { status: 400 });
  }

  try {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      return Response.json({ success: true, data: [] });
    }

    const files = fs.readdirSync(uploadDir);
    // Filter files for this specific exhibition
    const prefix = `about_us_${exhibitionId}_`;
    const filteredUrls = files
      .filter(f => f.startsWith(prefix))
      .map(f => `/api/about-us/image?filename=${f}`);

    return Response.json({ success: true, data: filteredUrls });
  } catch (error: any) {
    console.error('List uploads error:', error);
    return Response.json({ success: false, error: error.message || 'Failed to list uploads' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { exhibitionId, image } = body; // image is a base64 string

    if (!exhibitionId || !image) {
      return Response.json({ success: false, error: 'Missing exhibitionId or image payload' }, { status: 400 });
    }

    // Parse base64 string
    const match = image.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) {
      return Response.json({ success: false, error: 'Invalid base64 image format' }, { status: 400 });
    }

    const ext = match[1];
    const dataBuffer = Buffer.from(match[2], 'base64');

    if (dataBuffer.length > 1024 * 1024) {
      return Response.json({ success: false, error: 'Image exceeds 1MB limit' }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `about_us_${exhibitionId}_${Date.now()}.${ext}`;
    const filePath = path.join(uploadDir, filename);

    fs.writeFileSync(filePath, dataBuffer);

    return Response.json({ success: true, url: `/api/about-us/image?filename=${filename}` });
  } catch (error: any) {
    console.error('Upload image error:', error);
    return Response.json({ success: false, error: error.message || 'Upload failed' }, { status: 500 });
  }
}
