import { getData } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const data = await getData();
  const count = data.notifications.filter(n => n.userId === session.id && !n.readAt).length;

  return Response.json({ success: true, data: count });
}
