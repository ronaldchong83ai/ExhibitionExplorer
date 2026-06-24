import { checkAndSendUpcomingEventReminders } from '@/lib/push-notifications';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  // Simple auth check if needed (e.g. CRON_SECRET)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { sentCount } = await checkAndSendUpcomingEventReminders();
    return Response.json({ success: true, sentCount });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Allow POST for manual triggering by admin in dashboard
  try {
    const { sentCount } = await checkAndSendUpcomingEventReminders();
    return Response.json({ success: true, sentCount });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
