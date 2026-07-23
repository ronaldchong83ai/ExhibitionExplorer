import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import type {
  User, Exhibition, HomePageInfo, StageEvent, Exhibitor,
  Product, PurchaseConversion, VenueMap, Voucher, VoucherScan, VoucherCollection,
  Favourite, ActionLog, Notification, NotificationSetting, PushSubscription, AboutUs, ExhibitionRegistration,
  UserRole, AuthProvider, HomeInfoType, FavouriteType, ActionType
} from '@/types';

export interface DataStore {
  users: User[];
  exhibitions: Exhibition[];
  homePageInfos: HomePageInfo[];
  stageEvents: StageEvent[];
  exhibitors: Exhibitor[];
  products: Product[];
  purchaseConversions: PurchaseConversion[];
  venueMaps: VenueMap[];
  vouchers: Voucher[];
  voucherScans: VoucherScan[];
  voucherCollections: VoucherCollection[];
  favourites: Favourite[];
  actionLogs: ActionLog[];
  notifications: Notification[];
  notificationSettings: NotificationSetting[];
  pushSubscriptions: PushSubscription[];
  aboutUs: AboutUs[];
  exhibitionRegistrations: ExhibitionRegistration[];
}

let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
} else {
  // Use global variable to prevent hot-reloading from creating new pools in dev
  if (!(global as any).prisma) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    (global as any).prisma = new PrismaClient({ adapter });
  }
  prisma = (global as any).prisma;
}

export { prisma };

export async function getData(): Promise<DataStore> {
  const [
    users, exhibitions, homePageInfos, stageEvents, exhibitors,
    products, purchaseConversions, venueMaps, vouchers, voucherScans,
    favourites, actionLogs, notifications, notificationSettings, pushSubscriptions,
    voucherCollections, aboutUs, exhibitionRegistrations
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.exhibition.findMany(),
    prisma.homePageInfo.findMany(),
    prisma.stageEvent.findMany(),
    prisma.exhibitor.findMany(),
    prisma.product.findMany(),
    prisma.purchaseConversion.findMany(),
    prisma.venueMap.findMany(),
    prisma.voucher.findMany(),
    prisma.voucherScan.findMany(),
    prisma.favourite.findMany(),
    prisma.actionLog.findMany(),
    prisma.notification.findMany(),
    prisma.notificationSetting.findMany(),
    prisma.pushSubscription.findMany(),
    prisma.voucherCollection.findMany(),
    prisma.aboutUs.findMany(),
    prisma.exhibitionRegistration.findMany(),
  ]);

  return {
    users: users.map(u => ({
      ...u,
      role: u.role as UserRole,
      provider: u.provider as AuthProvider,
      createdAt: u.createdAt.toISOString()
    })),
    exhibitions: (() => {
      const mapped = exhibitions.map(e => ({
        ...e,
        eventPeriodFrom: e.eventPeriodFrom.toISOString(),
        eventPeriodTo: e.eventPeriodTo.toISOString(),
        createdAt: e.createdAt.toISOString()
      }));
      const active = mapped.filter(e => e.enabled !== false);
      const disabled = mapped.filter(e => e.enabled === false);
      active.sort((a, b) => new Date(a.eventPeriodFrom).getTime() - new Date(b.eventPeriodFrom).getTime());
      disabled.sort((a, b) => new Date(b.eventPeriodTo).getTime() - new Date(a.eventPeriodTo).getTime());
      return [...active, ...disabled];
    })(),
    homePageInfos: homePageInfos.map(h => ({
      ...h,
      type: h.type as HomeInfoType,
      displayFrom: h.displayFrom ? h.displayFrom.toISOString() : '',
      displayTo: h.displayTo ? h.displayTo.toISOString() : '',
      createdAt: h.createdAt.toISOString()
    })),
    stageEvents: stageEvents.map(s => ({
      ...s,
      periodFrom: s.periodFrom.toISOString(),
      periodTo: s.periodTo.toISOString(),
      createdAt: s.createdAt.toISOString()
    })),
    exhibitors: exhibitors.map(e => ({
      ...e,
      createdAt: e.createdAt.toISOString()
    })),
    products: products.map(p => ({
      ...p,
      createdAt: p.createdAt.toISOString()
    })),
    purchaseConversions: purchaseConversions,
    venueMaps: venueMaps.map(v => ({
      ...v,
      uploadedAt: v.uploadedAt.toISOString()
    })),
    vouchers: vouchers.map(v => ({
      ...v,
      scanItems: (v.scanItems as any) ?? null,
      displayFrom: v.displayFrom ? v.displayFrom.toISOString() : '',
      displayTo: v.displayTo ? v.displayTo.toISOString() : '',
      createdAt: v.createdAt.toISOString()
    })),
    voucherScans: voucherScans.map(v => ({
      ...v,
      scannedAt: v.scannedAt.toISOString()
    })),
    voucherCollections: voucherCollections.map(v => ({
      ...v,
      collectedAt: v.collectedAt.toISOString()
    })),
    aboutUs: aboutUs.map(a => ({
      ...a,
      updatedAt: a.updatedAt.toISOString()
    })),
    favourites: favourites.map(f => ({
      ...f,
      type: f.type as FavouriteType,
      createdAt: f.createdAt.toISOString()
    })),
    actionLogs: actionLogs.map(a => ({
      ...a,
      action: a.action as ActionType,
      createdAt: a.createdAt.toISOString()
    })),
    notifications: notifications.map(n => ({
      ...n,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString()
    })),
    notificationSettings: notificationSettings.map(n => ({
      ...n,
      createdAt: n.createdAt.toISOString()
    })),
    pushSubscriptions: pushSubscriptions.map(p => ({
      ...p,
      createdAt: p.createdAt.toISOString()
    })),
    exhibitionRegistrations: exhibitionRegistrations.map(r => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    })),
  };
}

export async function saveData(data: DataStore): Promise<void> {
  // Sync logic to replicate in-memory changes back into Postgres via upsert/delete

  // 1. Users
  const userIds = data.users.map(u => u.id);
  await Promise.all([
    ...data.users.map(u => prisma.user.upsert({
      where: { id: u.id },
      update: {
        name: u.name,
        email: u.email,
        contact: u.contact,
        passwordHash: u.passwordHash,
        role: u.role,
        provider: u.provider,
        profilePic: u.profilePic,
        dob: u.dob,
        occupation: u.occupation,
        citizenship: u.citizenship,
        createdAt: new Date(u.createdAt)
      },
      create: {
        id: u.id,
        name: u.name,
        email: u.email,
        contact: u.contact,
        passwordHash: u.passwordHash,
        role: u.role,
        provider: u.provider,
        profilePic: u.profilePic,
        dob: u.dob,
        occupation: u.occupation,
        citizenship: u.citizenship,
        createdAt: new Date(u.createdAt)
      }
    })),
    prisma.user.deleteMany({
      where: { id: { notIn: userIds } }
    })
  ]);

  // 2. Exhibitions
  const exhibitionIds = data.exhibitions.map(e => e.id);
  await Promise.all([
    ...data.exhibitions.map(e => prisma.exhibition.upsert({
      where: { id: e.id },
      update: {
        title: e.title,
        description: e.description,
        eventPeriodFrom: new Date(e.eventPeriodFrom),
        eventPeriodTo: new Date(e.eventPeriodTo),
        details: e.details,
        enabled: e.enabled !== false,
        logoUrl: e.logoUrl || null,
        scanId: e.scanId || null,
        createdBy: e.createdBy,
        createdAt: new Date(e.createdAt)
      },
      create: {
        id: e.id,
        title: e.title,
        description: e.description,
        eventPeriodFrom: new Date(e.eventPeriodFrom),
        eventPeriodTo: new Date(e.eventPeriodTo),
        details: e.details,
        enabled: e.enabled !== false,
        logoUrl: e.logoUrl || null,
        scanId: e.scanId || null,
        createdBy: e.createdBy,
        createdAt: new Date(e.createdAt)
      }
    })),
    prisma.exhibition.deleteMany({
      where: { id: { notIn: exhibitionIds } }
    })
  ]);

  // 3. HomePageInfos
  const homeIds = data.homePageInfos.map(h => h.id);
  await Promise.all([
    ...data.homePageInfos.map(h => prisma.homePageInfo.upsert({
      where: { id: h.id },
      update: {
        exhibitionId: h.exhibitionId,
        title: h.title,
        type: h.type,
        description: h.description,
        displayFrom: h.displayFrom ? new Date(h.displayFrom) : null,
        displayTo: h.displayTo ? new Date(h.displayTo) : null,
        details: h.details,
        createdAt: new Date(h.createdAt)
      },
      create: {
        id: h.id,
        exhibitionId: h.exhibitionId,
        title: h.title,
        type: h.type,
        description: h.description,
        displayFrom: h.displayFrom ? new Date(h.displayFrom) : null,
        displayTo: h.displayTo ? new Date(h.displayTo) : null,
        details: h.details,
        createdAt: new Date(h.createdAt)
      }
    })),
    prisma.homePageInfo.deleteMany({
      where: { id: { notIn: homeIds } }
    })
  ]);

  // 4. StageEvents
  const stageIds = data.stageEvents.map(s => s.id);
  await Promise.all([
    ...data.stageEvents.map(s => prisma.stageEvent.upsert({
      where: { id: s.id },
      update: {
        exhibitionId: s.exhibitionId,
        title: s.title,
        periodFrom: new Date(s.periodFrom),
        periodTo: new Date(s.periodTo),
        stageNumber: s.stageNumber,
        speakerNames: s.speakerNames,
        details: s.details,
        createdAt: new Date(s.createdAt)
      },
      create: {
        id: s.id,
        exhibitionId: s.exhibitionId,
        title: s.title,
        periodFrom: new Date(s.periodFrom),
        periodTo: new Date(s.periodTo),
        stageNumber: s.stageNumber,
        speakerNames: s.speakerNames,
        details: s.details,
        createdAt: new Date(s.createdAt)
      }
    })),
    prisma.stageEvent.deleteMany({
      where: { id: { notIn: stageIds } }
    })
  ]);

  // 5. Exhibitors
  const exhibIds = data.exhibitors.map(e => e.id);
  await Promise.all([
    ...data.exhibitors.map(e => prisma.exhibitor.upsert({
      where: { id: e.id },
      update: {
        exhibitionId: e.exhibitionId,
        name: e.name,
        description: e.description,
        boothNumber: e.boothNumber,
        imageUrl: e.imageUrl,
        details: e.details,
        allowedUserIds: e.allowedUserIds,
        createdAt: new Date(e.createdAt),
        hasTrophy: typeof e.hasTrophy === 'boolean' ? (e.hasTrophy ? 'gold' : 'none') : (e.hasTrophy ?? 'none')
      },
      create: {
        id: e.id,
        exhibitionId: e.exhibitionId,
        name: e.name,
        description: e.description,
        boothNumber: e.boothNumber,
        imageUrl: e.imageUrl,
        details: e.details,
        allowedUserIds: e.allowedUserIds,
        createdAt: new Date(e.createdAt),
        hasTrophy: typeof e.hasTrophy === 'boolean' ? (e.hasTrophy ? 'gold' : 'none') : (e.hasTrophy ?? 'none')
      }
    })),
    prisma.exhibitor.deleteMany({
      where: { id: { notIn: exhibIds } }
    })
  ]);

  // 6. Products
  const prodIds = data.products.map(p => p.id);
  await Promise.all([
    ...data.products.map(p => prisma.product.upsert({
      where: { id: p.id },
      update: {
        exhibitorId: p.exhibitorId,
        title: p.title,
        imageUrl: p.imageUrl,
        description: p.description,
        details: p.details,
        createdAt: new Date(p.createdAt)
      },
      create: {
        id: p.id,
        exhibitorId: p.exhibitorId,
        title: p.title,
        imageUrl: p.imageUrl,
        description: p.description,
        details: p.details,
        createdAt: new Date(p.createdAt)
      }
    })),
    prisma.product.deleteMany({
      where: { id: { notIn: prodIds } }
    })
  ]);

  // 7. PurchaseConversions
  const conversionIds = data.purchaseConversions.map(c => c.id);
  await Promise.all([
    ...data.purchaseConversions.map(c => prisma.purchaseConversion.upsert({
      where: { id: c.id },
      update: {
        productId: c.productId,
        date: c.date,
        value: c.value
      },
      create: {
        id: c.id,
        productId: c.productId,
        date: c.date,
        value: c.value
      }
    })),
    prisma.purchaseConversion.deleteMany({
      where: { id: { notIn: conversionIds } }
    })
  ]);

  // 8. VenueMaps
  const venueIds = data.venueMaps.map(v => v.id);
  await Promise.all([
    ...data.venueMaps.map(v => prisma.venueMap.upsert({
      where: { id: v.id },
      update: {
        exhibitionId: v.exhibitionId,
        imageUrl: v.imageUrl,
        uploadedAt: new Date(v.uploadedAt)
      },
      create: {
        id: v.id,
        exhibitionId: v.exhibitionId,
        imageUrl: v.imageUrl,
        uploadedAt: new Date(v.uploadedAt)
      }
    })),
    prisma.venueMap.deleteMany({
      where: { id: { notIn: venueIds } }
    })
  ]);

  // 9. Vouchers
  const voucherIds = data.vouchers.map(v => v.id);
  await Promise.all([
    ...data.vouchers.map(v => prisma.voucher.upsert({
      where: { id: v.id },
      update: {
        exhibitionId: v.exhibitionId,
        title: v.title,
        description: v.description,
        details: v.details,
        requiredScanIds: v.requiredScanIds,
        scanItems: (v.scanItems as any) ?? null,
        displayFrom: v.displayFrom ? new Date(v.displayFrom) : null,
        displayTo: v.displayTo ? new Date(v.displayTo) : null,
        createdAt: new Date(v.createdAt)
      },
      create: {
        id: v.id,
        exhibitionId: v.exhibitionId,
        title: v.title,
        description: v.description,
        details: v.details,
        requiredScanIds: v.requiredScanIds,
        scanItems: (v.scanItems as any) ?? null,
        displayFrom: v.displayFrom ? new Date(v.displayFrom) : null,
        displayTo: v.displayTo ? new Date(v.displayTo) : null,
        createdAt: new Date(v.createdAt)
      }
    })),
    prisma.voucher.deleteMany({
      where: { id: { notIn: voucherIds } }
    })
  ]);

  // 10. VoucherScans
  const scanIds = data.voucherScans.map(v => v.id);
  await Promise.all([
    ...data.voucherScans.map(v => prisma.voucherScan.upsert({
      where: { id: v.id },
      update: {
        voucherId: v.voucherId,
        userId: v.userId,
        scanId: v.scanId,
        scannedAt: new Date(v.scannedAt)
      },
      create: {
        id: v.id,
        voucherId: v.voucherId,
        userId: v.userId,
        scanId: v.scanId,
        scannedAt: new Date(v.scannedAt)
      }
    })),
    prisma.voucherScan.deleteMany({
      where: { id: { notIn: scanIds } }
    })
  ]);

  // 11. Favourites
  const favIds = data.favourites.map(f => f.id);
  await Promise.all([
    ...data.favourites.map(f => prisma.favourite.upsert({
      where: { id: f.id },
      update: {
        userId: f.userId,
        type: f.type,
        targetId: f.targetId,
        createdAt: new Date(f.createdAt)
      },
      create: {
        id: f.id,
        userId: f.userId,
        type: f.type,
        targetId: f.targetId,
        createdAt: new Date(f.createdAt)
      }
    })),
    prisma.favourite.deleteMany({
      where: { id: { notIn: favIds } }
    })
  ]);

  // 12. ActionLogs
  const logIds = data.actionLogs.map(l => l.id);
  await Promise.all([
    ...data.actionLogs.map(l => prisma.actionLog.upsert({
      where: { id: l.id },
      update: {
        userId: l.userId,
        action: l.action,
        details: l.details,
        createdAt: new Date(l.createdAt)
      },
      create: {
        id: l.id,
        userId: l.userId,
        action: l.action,
        details: l.details,
        createdAt: new Date(l.createdAt)
      }
    })),
    prisma.actionLog.deleteMany({
      where: { id: { notIn: logIds } }
    })
  ]);

  // 13. Notifications
  const notifIds = data.notifications.map(n => n.id);
  await Promise.all([
    ...data.notifications.map(n => prisma.notification.upsert({
      where: { id: n.id },
      update: {
        userId: n.userId,
        title: n.title,
        body: n.body,
        readAt: n.readAt ? new Date(n.readAt) : null,
        createdAt: new Date(n.createdAt)
      },
      create: {
        id: n.id,
        userId: n.userId,
        title: n.title,
        body: n.body,
        readAt: n.readAt ? new Date(n.readAt) : null,
        createdAt: new Date(n.createdAt)
      }
    })),
    prisma.notification.deleteMany({
      where: { id: { notIn: notifIds } }
    })
  ]);

  // 14. NotificationSettings
  const settingIds = data.notificationSettings.map(s => s.id);
  await Promise.all([
    ...data.notificationSettings.map(s => prisma.notificationSetting.upsert({
      where: { id: s.id },
      update: {
        userId: s.userId,
        hoursBeforeEvent: s.hoursBeforeEvent,
        createdAt: new Date(s.createdAt)
      },
      create: {
        id: s.id,
        userId: s.userId,
        hoursBeforeEvent: s.hoursBeforeEvent,
        createdAt: new Date(s.createdAt)
      }
    })),
    prisma.notificationSetting.deleteMany({
      where: { id: { notIn: settingIds } }
    })
  ]);

  // 15. PushSubscriptions
  const subIds = data.pushSubscriptions.map(p => p.id);
  await Promise.all([
    ...data.pushSubscriptions.map(p => prisma.pushSubscription.upsert({
      where: { id: p.id },
      update: {
        userId: p.userId,
        endpoint: p.endpoint,
        keys: p.keys,
        createdAt: new Date(p.createdAt)
      },
      create: {
        id: p.id,
        userId: p.userId,
        endpoint: p.endpoint,
        keys: p.keys,
        createdAt: new Date(p.createdAt)
      }
    })),
    prisma.pushSubscription.deleteMany({
      where: { id: { notIn: subIds } }
    })
  ]);

  // 16. VoucherCollections
  const collectionIds = data.voucherCollections.map(c => c.id);
  await Promise.all([
    ...data.voucherCollections.map(c => prisma.voucherCollection.upsert({
      where: { id: c.id },
      update: {
        voucherId: c.voucherId,
        userId: c.userId,
        collectedAt: new Date(c.collectedAt),
        giftedBy: c.giftedBy || null
      },
      create: {
        id: c.id,
        voucherId: c.voucherId,
        userId: c.userId,
        collectedAt: new Date(c.collectedAt),
        giftedBy: c.giftedBy || null
      }
    })),
    prisma.voucherCollection.deleteMany({
      where: { id: { notIn: collectionIds } }
    })
  ]);

  // 17. AboutUs
  if (data.aboutUs) {
    const aboutUsIds = data.aboutUs.map(a => a.id);
    await Promise.all([
      ...data.aboutUs.map(a => prisma.aboutUs.upsert({
        where: { id: a.id },
        update: {
          exhibitionId: a.exhibitionId,
          content: a.content
        },
        create: {
          id: a.id,
          exhibitionId: a.exhibitionId,
          content: a.content
        }
      })),
      prisma.aboutUs.deleteMany({
        where: { id: { notIn: aboutUsIds } }
      })
    ]);
  }

  // 18. ExhibitionRegistrations
  if (data.exhibitionRegistrations) {
    const regIds = data.exhibitionRegistrations.map(r => r.id);
    await Promise.all([
      ...data.exhibitionRegistrations.map(r => prisma.exhibitionRegistration.upsert({
        where: { id: r.id },
        update: {
          exhibitionId: r.exhibitionId,
          userId: r.userId,
          adultsCount: r.adultsCount,
          childrenCount: r.childrenCount,
          updatedAt: new Date()
        },
        create: {
          id: r.id,
          exhibitionId: r.exhibitionId,
          userId: r.userId,
          adultsCount: r.adultsCount,
          childrenCount: r.childrenCount
        }
      })),
      prisma.exhibitionRegistration.deleteMany({
        where: { id: { notIn: regIds } }
      })
    ]);
  }

  // Invalidate all caches on save/write mutations
  const keys = ['home', 'stages', 'exhibitors', 'vouchers', 'favourites', 'notifications', 'users', 'about-us'];
  await Promise.all(keys.map(k => invalidateCache(k)));
}

export async function invalidateCache(key: string): Promise<void> {
  const newVersion = Date.now().toString();
  try {
    await prisma.dbVersion.upsert({
      where: { key },
      update: { version: newVersion },
      create: { key, version: newVersion }
    });
  } catch (err) {
    console.error(`Failed to invalidate cache key ${key}:`, err);
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
