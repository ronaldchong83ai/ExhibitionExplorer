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

  return Response.json({
    success: true,
    data: {
      redemptionRates,
      vouchersPerDay,
      purchaseConversions,
      exhibitorSales
    }
  });
}
