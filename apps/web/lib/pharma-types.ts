/** Shapes of /v1/pharma (Twabibu Pharma). */
import type { Availability, Order, OrderStatus, ShareResponse } from './pharmacy-types';

export type PharmaRole = 'OWNER' | 'ADMIN' | 'PHARMACIST' | 'PHARMACY_STAFF';

export interface PharmaMembership {
  organizationId: string;
  organizationName: string;
  slug: string;
  role: PharmaRole;
  verified: boolean;
}

export interface PharmaMe {
  userId: string;
  email: string | null;
  memberships: PharmaMembership[];
}

export interface PharmaDashboard {
  verified: boolean;
  prescriptionsWaiting: number;
  openOrders: Partial<Record<OrderStatus, number>>;
  todayOrders: number;
  todayRevenueKmf: number;
  duties: { startsAt: string; endsAt: string; onDutyNow: boolean; source: string }[];
  placements: { slot: string; island: string; startsAt: string; endsAt: string; active: boolean }[];
}

export interface InboxItem {
  id: string;
  status: 'SENT' | 'ANSWERED' | 'ACCEPTED' | 'DECLINED';
  sentAt: string;
  answeredAt: string | null;
  response: ShareResponse | null;
  prescription: {
    id: string;
    code: string | null;
    status: string;
    signedAt: string | null;
    expiresAt: string | null;
    prescriber: string;
    notes: string | null;
    lines: { id: string; label: string; drugId: string | null; posologyText: string; quantity: number | null; durationDays: number | null; substitutable: boolean; controlled: boolean }[];
  };
  patient: { name: string; birthDate: string | null };
}

export interface PharmaOrder extends Order {
  next: OrderStatus[];
  patient: { name: string } | null;
}

export interface PharmaProduct {
  id: string;
  name: string;
  category: string;
  priceKmf: number;
  availability: Availability;
  prescriptionOnly: boolean;
  controlled: boolean;
  drugId: string | null;
  drug: { slug: string; dci: string } | null;
  updatedAt: string;
}

export interface PharmaProfile {
  name: string;
  slug: string;
  phone: string | null;
  email: string | null;
  description: string | null;
  verified: boolean;
  services: string[];
  paymentMethods: string[];
  deliveryZones: { localityId: string; feeKmf: number; locality: string }[];
}
