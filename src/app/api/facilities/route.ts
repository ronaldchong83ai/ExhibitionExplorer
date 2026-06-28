import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const exhibitionId = searchParams.get('exhibitionId');

  if (!exhibitionId) {
    return Response.json({ success: false, error: 'Missing exhibitionId' }, { status: 400 });
  }

  try {
    const facilities = await prisma.facility.findMany({
      where: { exhibitionId },
      orderBy: { facilityName: 'asc' }
    });

    const facilityIds = facilities.map(f => f.id);
    const bookings = await prisma.facilityBooking.findMany({
      where: { facilityId: { in: facilityIds } }
    });

    // Fetch users who made these bookings
    const userIds = Array.from(new Set(bookings.map(b => b.userId)));
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true }
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    // Group bookings by facilityId
    const data = facilities.map(facility => {
      const facilityBookings = bookings.filter(b => b.facilityId === facility.id);
      
      const mappedBookings = facilityBookings.map(b => {
        const bookingUser = userMap.get(b.userId);
        const isMyBooking = b.userId === session.id;
        const isAdmin = session.role === 'ADMIN';

        return {
          id: b.id,
          bookingTime: b.bookingTime.toISOString(),
          isMyBooking,
          user: (isAdmin || isMyBooking) ? {
            name: bookingUser?.name || 'Unknown',
            email: bookingUser?.email || ''
          } : null
        };
      });

      return {
        id: facility.id,
        exhibitionId: facility.exhibitionId,
        facilityName: facility.facilityName,
        areaNumber: facility.areaNumber,
        periodFrom: facility.periodFrom.toISOString(),
        periodTo: facility.periodTo.toISOString(),
        operatingHours: facility.operatingHours,
        createdAt: facility.createdAt.toISOString(),
        bookings: mappedBookings
      };
    });

    return Response.json({ success: true, data });
  } catch (error: any) {
    console.error('Error fetching facilities:', error);
    return Response.json({ success: false, error: error.message || 'Failed to fetch facilities' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { facilityId, bookingTimes, timezoneOffset } = body;

    if (!facilityId || !bookingTimes || !Array.isArray(bookingTimes)) {
      return Response.json({ success: false, error: 'Missing facilityId or bookingTimes' }, { status: 400 });
    }

    const facility = await prisma.facility.findFirst({
      where: { id: facilityId }
    });

    if (!facility) {
      return Response.json({ success: false, error: 'Facility not found' }, { status: 404 });
    }

    let entries: any[] = [];
    if (facility.operatingHours) {
      try {
        entries = JSON.parse(facility.operatingHours);
      } catch (_) {}
    }

    const offsetMin = timezoneOffset !== undefined ? Number(timezoneOffset) : new Date().getTimezoneOffset();

    for (const timeStr of bookingTimes) {
      const time = new Date(timeStr);
      if (isNaN(time.getTime())) {
        return Response.json({ success: false, error: `Invalid booking time: ${timeStr}` }, { status: 400 });
      }
      
      const timeMs = time.getTime();
      const slotEndMs = timeMs + 15 * 60 * 1000;

      if (entries.length > 0) {
        const inInterval = entries.some(entry => {
          const start = new Date(`${entry.date}T${entry.timeFrom}:00`);
          const end = new Date(`${entry.date}T${entry.timeTo}:00`);
          const startUTC = start.getTime() + (offsetMin - start.getTimezoneOffset()) * 60000;
          const endUTC = end.getTime() + (offsetMin - end.getTimezoneOffset()) * 60000;
          return timeMs >= startUTC && slotEndMs <= endUTC;
        });

        if (!inInterval) {
          return Response.json({ success: false, error: 'Booking time is outside the facility operating hours' }, { status: 400 });
        }
      } else {
        const fFrom = new Date(facility.periodFrom).getTime();
        const fTo = new Date(facility.periodTo).getTime();
        if (timeMs < fFrom || slotEndMs > fTo) {
          return Response.json({ success: false, error: 'Booking time is outside the facility operating period' }, { status: 400 });
        }
      }

      if (time.getMinutes() % 15 !== 0 || time.getSeconds() !== 0 || time.getMilliseconds() !== 0) {
        return Response.json({ success: false, error: 'Booking times must be aligned to 15-minute intervals' }, { status: 400 });
      }
    }

    const parsedTimes = bookingTimes.map(t => new Date(t));
    const existingBookings = await prisma.facilityBooking.findMany({
      where: {
        facilityId,
        bookingTime: { in: parsedTimes }
      }
    });

    if (existingBookings.length > 0) {
      return Response.json({ success: false, error: 'One or more selected slots are already booked' }, { status: 400 });
    }

    const bookingsToCreate = parsedTimes.map(t => ({
      facilityId,
      userId: session.id,
      bookingTime: t
    }));

    await prisma.facilityBooking.createMany({
      data: bookingsToCreate
    });

    return Response.json({ success: true, message: 'Booking registered successfully' });
  } catch (error: any) {
    console.error('Error creating bookings:', error);
    return Response.json({ success: false, error: error.message || 'Failed to create booking' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const facilityId = searchParams.get('facilityId');
  const bookingTimeStr = searchParams.get('bookingTime');

  if (!facilityId || !bookingTimeStr) {
    return Response.json({ success: false, error: 'Missing facilityId or bookingTime' }, { status: 400 });
  }

  try {
    const bookingTime = new Date(bookingTimeStr);
    if (isNaN(bookingTime.getTime())) {
      return Response.json({ success: false, error: 'Invalid bookingTime' }, { status: 400 });
    }

    const booking = await prisma.facilityBooking.findFirst({
      where: {
        facilityId,
        bookingTime
      }
    });

    if (!booking) {
      return Response.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    if (session.role !== 'ADMIN' && booking.userId !== session.id) {
      return Response.json({ success: false, error: 'Unauthorized to cancel this booking' }, { status: 403 });
    }

    await prisma.facilityBooking.delete({
      where: { id: booking.id }
    });

    return Response.json({ success: true, message: 'Booking cancelled successfully' });
  } catch (error: any) {
    console.error('Error deleting booking:', error);
    return Response.json({ success: false, error: error.message || 'Failed to cancel booking' }, { status: 500 });
  }
}
