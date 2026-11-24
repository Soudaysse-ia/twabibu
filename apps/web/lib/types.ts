/** Shapes returned by the API (see apps/api/src). To be generated from OpenAPI by ticket CLIENT-01. */

export interface SearchItem {
  id: string;
  slug: string;
  url: string;
  displayName: string;
  initials: string;
  photoUrl: string | null;
  verified: boolean;
  acceptsNewPatients: boolean;
  speciality: { slug: string; name: string };
  practice: { addressLine: string; locality: string; island: string; distanceKm: number | null; lat: number; lng: number } | null;
  languages: string[];
  priceFromKmf: number | null;
  motiveId: string | null;
  days: { date: string; slots: string[] }[];
  reason: string | null;
  nextAvailabilityAt: string | null;
}

export interface SearchFacets {
  languages: { code: string; name: string }[];
  paymentMethods: { code: string; name: string }[];
  insurances: string[];
}

export interface SearchResult {
  items: SearchItem[];
  total: number;
  page: number;
  pageSize: number;
  facets: SearchFacets;
}

export interface Motive {
  id: string;
  name: string;
  durationMinutes: number;
  priceKmf: number | null;
  instructions: string | null;
  newPatientsAllowed: boolean;
  cancellationDeadlineHours: number;
}

export interface Practice {
  id: string;
  name: string;
  addressLine: string;
  locality: { slug: string; name: string };
  island: { slug: string; name: string; frenchName: string };
  lat: number | null;
  lng: number | null;
  phone: string | null;
  accessInfo: { floor?: string; wheelchair?: boolean; elevator?: boolean; parking?: boolean; notes?: string };
  openingHours: Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', [string, string][]>>;
}

export interface Profile {
  id: string;
  slug: string;
  url: string;
  title: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
  initials: string;
  photoUrl: string | null;
  bio: string | null;
  verified: boolean;
  acceptsNewPatients: boolean;
  speciality: { slug: string; name: string };
  languages: { code: string; name: string }[];
  expertises: string[];
  paymentMethods: string[];
  insurances: string[];
  educations: { year: number; diploma: string; school: string }[];
  organization: { name: string; slug: string; type: string; phone: string | null };
  practices: Practice[];
  agenda: {
    id: string;
    practiceId: string;
    onlineBookingEnabled: boolean;
    requiresValidation: boolean;
    bookingHorizonDays: number;
    motives: Motive[];
  } | null;
  priceFromKmf: number | null;
}

export interface Me {
  id: string;
  kind: string;
  phone: string | null;
  email: string | null;
  profile: { civility: string | null; firstName: string; lastName: string; birthDate: string } | null;
  relatives: { id: string; firstName: string; lastName: string; birthDate: string; relationship: string; phone: string | null }[];
}

export interface PatientAppointment {
  id: string;
  agendaId: string;
  motiveId: string;
  status: 'PENDING_VALIDATION' | 'CONFIRMED' | 'ARRIVED' | 'IN_CONSULTATION' | 'DONE' | 'NO_SHOW' | 'CANCELLED_BY_PATIENT' | 'CANCELLED_BY_PRACTICE';
  startsAt: string;
  endsAt: string;
  motive: string;
  priceKmf: number | null;
  instructions: string | null;
  forName: string;
  forRelative: boolean;
  practitioner: { name: string; slug: string; speciality: string; url: string };
  practice: { name: string; addressLine: string; locality: string; island: string; phone: string | null; lat: number | null; lng: number | null };
  cancellation: { allowed: boolean; deadline: string };
}

export interface AvailabilityDays {
  agendaId: string;
  reason: string | null;
  days: { date: string; slots: { startsAt: string; endsAt: string }[] }[];
}

/** GET /v1/search/sitemap (SEARCH-08): « speciality × place » pages with results, and public profiles. */
export interface SitemapData {
  pages: { url: string; speciality: string; place: string; kind: 'LOCALITY' | 'ISLAND'; count: number }[];
  practitioners: { url: string; updatedAt: string }[];
}
