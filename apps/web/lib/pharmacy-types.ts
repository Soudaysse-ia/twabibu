/** Shapes of the pharmacy routes (apps/api/src/pharmacies). */

export type IslandSlug = 'ngazidja' | 'ndzuani' | 'mwali';
export type Availability = 'IN_STOCK' | 'LOW' | 'OUT_OF_STOCK' | 'ON_ORDER';
export type OrderStatus = 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export interface PharmacyCard {
  id: string;
  slug: string;
  name: string;
  phone: string | null;
  address: string | null;
  locality: { name: string; slug: string } | null;
  island: { code: string; name: string; slug: IslandSlug } | null;
  lat: number | null;
  lng: number | null;
  openNow: boolean;
  hoursToday: string | null;
  onDutyUntil: string | null;
  partner: boolean;
  verified: boolean;
  delivers: boolean;
  services: string[];
  paymentMethods: string[];
}

export interface DutyPage {
  island: { code: string; name: string; frenchName: string; slug: IslandSlug };
  date: string;
  week: boolean;
  updatedAt: string | null;
  duties: { id: string; startsAt: string; endsAt: string; zone: string | null; source: string; onDutyNow: boolean; pharmacy: PharmacyCard }[];
  partners: PharmacyCard[];
}

export interface CatalogueProduct {
  id: string;
  name: string;
  category: 'medication' | 'parapharmacy' | 'equipment' | string;
  priceKmf: number;
  availability: Availability;
  prescriptionOnly: boolean;
  controlled: boolean;
  drug: { slug: string; dci: string } | null;
  updatedAt: string;
}

export interface PharmacyProfile extends PharmacyCard {
  description: string | null;
  pharmacistName: string | null;
  openingHours: Partial<Record<'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat', [string, string][]>>;
  deliveryZones: { localityId: string; locality: string; feeKmf: number }[];
  upcomingDuties: { startsAt: string; endsAt: string }[];
  products: CatalogueProduct[];
}

export interface DrugAvailability {
  drug: { slug: string; dci: string; strength: string; form: string; brandNames: string[]; prescriptionOnly: boolean; controlled: boolean; essential: boolean };
  offers: { productId: string; priceKmf: number; availability: Availability; updatedAt: string; pharmacy: PharmacyCard }[];
  inStockCount: number;
}

export interface Order {
  id: string;
  reference: string;
  status: OrderStatus;
  mode: 'PICKUP' | 'DELIVERY';
  paymentMode: 'AT_PICKUP' | 'CASH_ON_DELIVERY' | 'MOBILE_MONEY';
  subtotalKmf: number;
  deliveryFeeKmf: number;
  totalKmf: number;
  address: { line: string; localityId: string; locality: string; instructions?: string; phone: string } | null;
  courier: { name: string; phone: string } | null;
  prescriptionId: string | null;
  createdAt: string;
  pharmacy: { id: string; slug: string; name: string; phone: string | null; address: string };
  lines: { id: string; label: string; quantity: number; unitPriceKmf: number; totalKmf: number }[];
  events: { status: OrderStatus; note: string | null; at: string }[];
}

export interface ShareResponse {
  lines: { lineId: string; label: string; status: 'AVAILABLE' | 'SUBSTITUTE' | 'UNAVAILABLE'; productId: string | null; productName: string | null; unitPriceKmf: number | null; quantity: number; controlled: boolean }[];
  readyInMinutes: number | null;
  message: string | null;
  totalKmf: number;
}

export interface PrescriptionShare {
  id: string;
  status: 'SENT' | 'ANSWERED' | 'ACCEPTED' | 'DECLINED';
  sentAt: string;
  answeredAt: string | null;
  pharmacy: { id: string; name: string; slug: string; phone: string | null };
  response: ShareResponse | null;
  order: { id: string; status: OrderStatus } | null;
}
