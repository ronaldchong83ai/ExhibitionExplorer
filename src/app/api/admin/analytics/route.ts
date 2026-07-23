import { getData } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  const exhibitionId = request.nextUrl.searchParams.get('exhibitionId') || '';
  const exhibitorId = request.nextUrl.searchParams.get('exhibitorId') || '';
  const voucherId = request.nextUrl.searchParams.get('voucherId') || '';
  
  const data = await getData();

  const exhibitionVouchers = data.vouchers.filter(v => v.exhibitionId === exhibitionId);

  // 1. Total Voucher Redemption (Collections per voucher)
  const redemptionRates = exhibitionVouchers.map(v => {
    const collections = data.voucherCollections.filter(c => c.voucherId === v.id);
    return {
      voucherId: v.id,
      title: v.title,
      count: collections.length
    };
  }).sort((a, b) => b.count - a.count);

  // 2. Vouchers per day (Collections grouped by day)
  const exhibitionVoucherIds = exhibitionVouchers.map(v => v.id);
  let collections = data.voucherCollections.filter(c => exhibitionVoucherIds.includes(c.voucherId));
  if (voucherId) {
    collections = collections.filter(c => c.voucherId === voucherId);
  }

  const collectionsByDate: Record<string, number> = {};
  collections.forEach(c => {
    const dateStr = c.collectedAt.split('T')[0];
    collectionsByDate[dateStr] = (collectionsByDate[dateStr] || 0) + 1;
  });

  const sortedCollDates = Object.keys(collectionsByDate).sort();
  const vouchersPerDay = sortedCollDates.map(date => {
    let label = date;
    try {
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        label = `${months[d.getMonth()]} ${d.getDate()}`;
      }
    } catch (_) {}
    return {
      date: label,
      count: collectionsByDate[date]
    };
  });

  // 3. Purchase Conversion: Sales per day
  let exhibitionExhibitors = data.exhibitors.filter(e => e.exhibitionId === exhibitionId);
  
  // Exhibitor Sales calculations (Total Sales per Exhibitor)
  const exhibitorSales = exhibitionExhibitors.map(ex => {
    const exProducts = data.products.filter(p => p.exhibitorId === ex.id);
    const exProductIds = exProducts.map(p => p.id);
    const exConversions = data.purchaseConversions.filter(c => exProductIds.includes(c.productId));
    const totalValue = exConversions.reduce((sum, c) => sum + c.value, 0);
    return {
      exhibitorId: ex.id,
      name: ex.name,
      value: totalValue
    };
  }).sort((a, b) => b.value - a.value);

  // Group conversions for sales per day
  if (exhibitorId) {
    exhibitionExhibitors = exhibitionExhibitors.filter(e => e.id === exhibitorId);
  }
  const exhibitorIds = exhibitionExhibitors.map(e => e.id);
  
  const exhibitionProducts = data.products.filter(p => exhibitorIds.includes(p.exhibitorId));
  const productIds = exhibitionProducts.map(p => p.id);
  
  const conversions = data.purchaseConversions.filter(c => productIds.includes(c.productId));
  
  const salesByDate: Record<string, number> = {};
  conversions.forEach(c => {
    const dateStr = c.date;
    salesByDate[dateStr] = (salesByDate[dateStr] || 0) + c.value;
  });

  const sortedDates = Object.keys(salesByDate).sort();
  const purchaseConversions = sortedDates.map(date => {
    let label = date;
    try {
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        label = `${months[d.getMonth()]} ${d.getDate()}`;
      }
    } catch (_) {}
    return {
      date: label,
      value: salesByDate[date]
    };
  });

  // 4. Visitor Registrations (Adults & Children) + Occupation & Citizenship + Per-day Breakdown
  const exhibitionRegistrations = (data.exhibitionRegistrations || []).filter(r => r.exhibitionId === exhibitionId);
  const byOccupation: Record<string, number> = {};
  const byCitizenship: Record<string, number> = {};
  const visitorsByDate: Record<string, { totalVisitors: number; totalAdults: number; totalChildren: number; totalRegistrations: number }> = {};

  exhibitionRegistrations.forEach(r => {
    const u = data.users.find(user => user.id === r.userId);
    const occ = u?.occupation?.trim() || 'Unspecified';
    const cit = u?.citizenship?.trim() || 'Unspecified';
    byOccupation[occ] = (byOccupation[occ] || 0) + 1;
    byCitizenship[cit] = (byCitizenship[cit] || 0) + 1;

    const dateStr = r.createdAt ? r.createdAt.substring(0, 10) : new Date().toISOString().substring(0, 10);
    if (!visitorsByDate[dateStr]) {
      visitorsByDate[dateStr] = { totalVisitors: 0, totalAdults: 0, totalChildren: 0, totalRegistrations: 0 };
    }
    visitorsByDate[dateStr].totalAdults += r.adultsCount;
    visitorsByDate[dateStr].totalChildren += r.childrenCount;
    visitorsByDate[dateStr].totalVisitors += (r.adultsCount + r.childrenCount);
    visitorsByDate[dateStr].totalRegistrations += 1;
  });

  const occupationBreakdown = Object.entries(byOccupation)
    .map(([occupation, count]) => ({ occupation, count }))
    .sort((a, b) => b.count - a.count);

  const citizenshipBreakdown = Object.entries(byCitizenship)
    .map(([citizenship, count]) => ({ citizenship, count }))
    .sort((a, b) => b.count - a.count);

  const sortedVisitorDates = Object.keys(visitorsByDate).sort();
  const visitorsPerDay = sortedVisitorDates.map(date => {
    let label = date;
    try {
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        label = `${months[d.getMonth()]} ${d.getDate()}`;
      }
    } catch (_) {}
    return {
      date: label,
      rawDate: date,
      totalVisitors: visitorsByDate[date].totalVisitors,
      totalAdults: visitorsByDate[date].totalAdults,
      totalChildren: visitorsByDate[date].totalChildren,
      totalRegistrations: visitorsByDate[date].totalRegistrations,
    };
  });

  const registeredVisitors = {
    totalRegistrations: exhibitionRegistrations.length,
    totalAdults: exhibitionRegistrations.reduce((sum, r) => sum + r.adultsCount, 0),
    totalChildren: exhibitionRegistrations.reduce((sum, r) => sum + r.childrenCount, 0),
    totalVisitors: exhibitionRegistrations.reduce((sum, r) => sum + r.adultsCount + r.childrenCount, 0),
    occupationBreakdown,
    citizenshipBreakdown,
    visitorsPerDay,
  };

  return Response.json({
    success: true,
    data: {
      redemptionRates,
      vouchersPerDay,
      purchaseConversions,
      exhibitorSales,
      registeredVisitors
    }
  });
}
