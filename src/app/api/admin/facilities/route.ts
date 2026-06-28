import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { exhibitionId, facilityName, areaNumber, operatingHours } = body;

    if (!exhibitionId || !facilityName || !areaNumber) {
      return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    let operatingHoursArray = operatingHours;
    if (typeof operatingHoursArray === 'string') {
      try {
        operatingHoursArray = JSON.parse(operatingHoursArray);
      } catch (_) {}
    }

    if (!Array.isArray(operatingHoursArray) || operatingHoursArray.length === 0) {
      return Response.json({ success: false, error: 'At least one operating hour daily record is required' }, { status: 400 });
    }

    let minTime = Infinity;
    let maxTime = -Infinity;

    for (const h of operatingHoursArray) {
      if (!h.date || !h.timeFrom || !h.timeTo) {
        return Response.json({ success: false, error: 'Each operating hour record must have a Date, Time From, and Time To' }, { status: 400 });
      }

      const start = new Date(`${h.date}T${h.timeFrom}:00`);
      const end = new Date(`${h.date}T${h.timeTo}:00`);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return Response.json({ success: false, error: 'Invalid operating hour dates or times' }, { status: 400 });
      }

      if (start.getTime() >= end.getTime()) {
        return Response.json({ success: false, error: 'Time From must be before Time To' }, { status: 400 });
      }

      minTime = Math.min(minTime, start.getTime());
      maxTime = Math.max(maxTime, end.getTime());
    }

    const pFrom = new Date(minTime);
    const pTo = new Date(maxTime);
    const operatingHoursStr = JSON.stringify(operatingHoursArray);

    const facility = await prisma.facility.create({
      data: {
        exhibitionId,
        facilityName,
        areaNumber,
        periodFrom: pFrom,
        periodTo: pTo,
        operatingHours: operatingHoursStr
      }
    });

    return Response.json({ success: true, data: facility });
  } catch (error: any) {
    console.error('Error creating facility:', error);
    return Response.json({ success: false, error: error.message || 'Failed to create facility' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, facilityName, areaNumber, operatingHours } = body;

    if (!id || !facilityName || !areaNumber) {
      return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    let operatingHoursArray = operatingHours;
    if (typeof operatingHoursArray === 'string') {
      try {
        operatingHoursArray = JSON.parse(operatingHoursArray);
      } catch (_) {}
    }

    if (!Array.isArray(operatingHoursArray) || operatingHoursArray.length === 0) {
      return Response.json({ success: false, error: 'At least one operating hour daily record is required' }, { status: 400 });
    }

    let minTime = Infinity;
    let maxTime = -Infinity;

    for (const h of operatingHoursArray) {
      if (!h.date || !h.timeFrom || !h.timeTo) {
        return Response.json({ success: false, error: 'Each operating hour record must have a Date, Time From, and Time To' }, { status: 400 });
      }

      const start = new Date(`${h.date}T${h.timeFrom}:00`);
      const end = new Date(`${h.date}T${h.timeTo}:00`);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return Response.json({ success: false, error: 'Invalid operating hour dates or times' }, { status: 400 });
      }

      if (start.getTime() >= end.getTime()) {
        return Response.json({ success: false, error: 'Time From must be before Time To' }, { status: 400 });
      }

      minTime = Math.min(minTime, start.getTime());
      maxTime = Math.max(maxTime, end.getTime());
    }

    const pFrom = new Date(minTime);
    const pTo = new Date(maxTime);
    const operatingHoursStr = JSON.stringify(operatingHoursArray);

    const existing = await prisma.facility.findFirst({ where: { id } });
    if (!existing) {
      return Response.json({ success: false, error: 'Facility not found' }, { status: 404 });
    }

    const updated = await prisma.facility.update({
      where: { id },
      data: {
        facilityName,
        areaNumber,
        periodFrom: pFrom,
        periodTo: pTo,
        operatingHours: operatingHoursStr
      }
    });

    return Response.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error updating facility:', error);
    return Response.json({ success: false, error: error.message || 'Failed to update facility' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return Response.json({ success: false, error: 'Missing facility id' }, { status: 400 });
    }

    const existing = await prisma.facility.findFirst({ where: { id } });
    if (!existing) {
      return Response.json({ success: false, error: 'Facility not found' }, { status: 404 });
    }

    await prisma.facilityBooking.deleteMany({
      where: { facilityId: id }
    });

    await prisma.facility.delete({
      where: { id }
    });

    return Response.json({ success: true, message: 'Facility deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting facility:', error);
    return Response.json({ success: false, error: error.message || 'Failed to delete facility' }, { status: 500 });
  }
}
