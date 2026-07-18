// Core type definitions for ExhibitionExplorer

export type UserRole = 'VISITOR' | 'EXHIBITOR' | 'ADMIN' | 'REDEMPTOR';
export type AuthProvider = 'CREDENTIALS' | 'GOOGLE' | 'LINKEDIN' | 'APPLE';
export type HomeInfoType = 'EVENT_INFO' | 'ANNOUNCEMENT' | 'IMPORTANT_NOTICE';
export type FavouriteType = 'EXHIBITOR' | 'STAGE_EVENT';
export type ActionType = 'SCAN_QR' | 'SCAN_LINKRAY' | 'REDEEM_COUPON' | 'VIEW_EXHIBITOR' | 'VIEW_STAGE' | 'FAVOURITE_ADD' | 'FAVOURITE_REMOVE';

export interface User {
  id: string;
  name: string;
  email: string;
  contact: string;
  passwordHash: string;
  role: UserRole;
  provider: AuthProvider;
  profilePic?: string | null;
  dob?: string | null;
  occupation?: string | null;
  citizenship?: string | null;
  createdAt: string;
}

export interface Exhibition {
  id: string;
  title: string;
  description: string;
  eventPeriodFrom: string;
  eventPeriodTo: string;
  details: string;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
}

export interface HomePageInfo {
  id: string;
  exhibitionId: string;
  title: string;
  type: HomeInfoType;
  description: string;
  displayFrom: string;
  displayTo: string;
  details: string;
  createdAt: string;
}

export interface StageEvent {
  id: string;
  exhibitionId: string;
  title: string;
  periodFrom: string;
  periodTo: string;
  stageNumber: string;
  speakerNames: string[];
  details: string;
  createdAt: string;
}

export interface Exhibitor {
  id: string;
  exhibitionId: string;
  name: string;
  description: string;
  boothNumber: string;
  imageUrl: string;
  details: string;
  allowedUserIds: string[];
  createdAt: string;
  hasTrophy?: string;
}

export interface Product {
  id: string;
  exhibitorId: string;
  title: string;
  imageUrl: string;
  description: string;
  details: string;
  createdAt: string;
}

export interface PurchaseConversion {
  id: string;
  productId: string;
  date: string;
  value: number;
}

export interface VenueMap {
  id: string;
  exhibitionId: string;
  imageUrl: string;
  uploadedAt: string;
}

export interface Voucher {
  id: string;
  exhibitionId: string;
  title: string;
  description: string;
  details: string;
  requiredScanIds: string[];
  displayFrom?: string;
  displayTo?: string;
  createdAt: string;
}

export interface VoucherCollection {
  id: string;
  voucherId: string;
  userId: string;
  collectedAt: string;
  giftedBy?: string | null;
}

export interface VoucherScan {
  id: string;
  voucherId: string;
  userId: string;
  scanId: string;
  scannedAt: string;
}

export interface Favourite {
  id: string;
  userId: string;
  type: FavouriteType;
  targetId: string;
  createdAt: string;
}

export interface ActionLog {
  id: string;
  userId: string;
  action: ActionType;
  details: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationSetting {
  id: string;
  userId: string;
  hoursBeforeEvent: number;
  createdAt: string;
}

export interface PushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  keys: string;
  createdAt: string;
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Session user type
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Facility {
  id: string;
  exhibitionId: string;
  facilityName: string;
  areaNumber: string;
  periodFrom: string;
  periodTo: string;
  createdAt: string;
}

export interface FacilityBooking {
  id: string;
  facilityId: string;
  userId: string;
  bookingTime: string;
  createdAt: string;
}

export interface AboutUs {
  id: string;
  exhibitionId: string;
  content: string;
  updatedAt: string;
}
