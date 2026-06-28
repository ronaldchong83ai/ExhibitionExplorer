import { getData, saveData, generateId } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const { scanId } = await request.json();
    if (!scanId || !scanId.trim()) {
      return Response.json({ success: false, error: 'Scan ID is required' }, { status: 400 });
    }

    const cleanScanId = scanId.trim();
    const data = await getData();

    // Find all active vouchers that require this scanId and are within their display periods
    const now = new Date();
    const matchingVouchers = data.vouchers.filter(v => {
      if (!v.requiredScanIds.includes(cleanScanId)) return false;
      if (v.displayFrom && v.displayFrom.trim()) {
        if (now < new Date(v.displayFrom)) return false;
      }
      if (v.displayTo && v.displayTo.trim()) {
        if (now > new Date(v.displayTo)) return false;
      }
      return true;
    });

    if (matchingVouchers.length === 0) {
      // Create a generic scan action log
      data.actionLogs.push({
        id: generateId(),
        userId: session.id,
        action: 'SCAN_QR',
        details: `Scanned code ${cleanScanId} (does not match any active vouchers)`,
        createdAt: new Date().toISOString()
      });
      await saveData(data);

      return Response.json({
        success: true,
        matched: false,
        message: `Scanned code "${cleanScanId}" successfully, but it does not match any active vouchers.`
      });
    }

    let addedCount = 0;
    let alreadyScannedCount = 0;
    const registeredVouchers: string[] = [];

    for (const voucher of matchingVouchers) {
      // Check if this specific scanId has already been scanned by this user for this voucher
      const hasScanned = data.voucherScans.some(
        s => s.voucherId === voucher.id && s.userId === session.id && s.scanId === cleanScanId
      );

      if (hasScanned) {
        alreadyScannedCount++;
        registeredVouchers.push(`${voucher.title} (already scanned)`);
        continue;
      }

      // Add new VoucherScan
      const newScan = {
        id: generateId(),
        voucherId: voucher.id,
        userId: session.id,
        scanId: cleanScanId,
        scannedAt: new Date().toISOString()
      };
      data.voucherScans.push(newScan);
      addedCount++;
      registeredVouchers.push(voucher.title);

      // Add to action logs
      data.actionLogs.push({
        id: generateId(),
        userId: session.id,
        action: 'SCAN_QR',
        details: `Scanned code "${cleanScanId}" for voucher "${voucher.title}"`,
        createdAt: new Date().toISOString()
      });
    }

    if (addedCount > 0) {
      await saveData(data);
    }

    if (addedCount === 0 && alreadyScannedCount > 0) {
      return Response.json({
        success: true,
        matched: true,
        alreadyScanned: true,
        message: `You have already scanned "${cleanScanId}" for: ${registeredVouchers.join(', ')}.`
      });
    }

    return Response.json({
      success: true,
      matched: true,
      message: `Scan registered successfully for: ${registeredVouchers.join(', ')}.`,
      registeredVouchers
    });

  } catch (error: any) {
    console.error('Scan registration error:', error);
    return Response.json({ success: false, error: error.message || 'Failed to register scan' }, { status: 500 });
  }
}
