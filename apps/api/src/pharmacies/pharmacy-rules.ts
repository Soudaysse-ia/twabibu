import { toDateKey, toMinutesOfDay, weekdayOf } from '@twabibu/utils';

/**
 * Pharmacy rules (SPEC-15 §7). Pure functions, tested in pharmacy-rules.test.ts.
 * Twabibu records and notifies; the pharmacy sells and dispenses.
 */

export type OpeningHours = Partial<Record<'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat', [string, string][]>>;
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return h * 60 + m;
};

/** Open according to the posted hours, in Comoros time. */
export function isOpenAt(hours: OpeningHours | null | undefined, at: Date): boolean {
  const ranges = hours?.[DAY_KEYS[weekdayOf(toDateKey(at))]!] ?? [];
  const now = toMinutesOfDay(at);
  return ranges.some(([from, to]) => now >= toMinutes(from) && now < toMinutes(to));
}

/** Today's opening ranges as text: `08:00–12:30, 14:30–17:30`, or null when closed all day. */
export function hoursOn(hours: OpeningHours | null | undefined, at: Date): string | null {
  const ranges = hours?.[DAY_KEYS[weekdayOf(toDateKey(at))]!] ?? [];
  return ranges.length ? ranges.map(([a, b]) => `${a}–${b}`).join(', ') : null;
}

export interface DutyWindow {
  startsAt: Date;
  endsAt: Date;
}

export const onDutyAt = (d: DutyWindow, at: Date) => d.startsAt <= at && at < d.endsAt;
/** A duty overlapping the [from, to) window (a calendar day or a week). */
export const overlaps = (d: DutyWindow, from: Date, to: Date) => d.startsAt < to && d.endsAt > from;

export type OrderStatus = 'PENDING' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
export type OrderMode = 'PICKUP' | 'DELIVERY';

/** Status changes made by the pharmacy (SPEC-15 §4). */
export function nextStatuses(from: OrderStatus, mode: OrderMode): OrderStatus[] {
  switch (from) {
    case 'PENDING':
      return ['ACCEPTED', 'CANCELLED'];
    case 'ACCEPTED':
      return ['PREPARING', 'CANCELLED'];
    case 'PREPARING':
      return [mode === 'DELIVERY' ? 'OUT_FOR_DELIVERY' : 'READY', 'CANCELLED'];
    case 'READY':
    case 'OUT_FOR_DELIVERY':
      return ['DELIVERED'];
    default:
      return [];
  }
}

/** The patient may cancel until the pharmacy starts preparing. */
export const patientCanCancel = (s: OrderStatus) => s === 'PENDING' || s === 'ACCEPTED';

export interface ProductForCart {
  availability: 'IN_STOCK' | 'LOW' | 'OUT_OF_STOCK' | 'ON_ORDER';
  prescriptionOnly: boolean;
  controlled: boolean;
  drugId: string | null;
}

export type CartProblem = 'CONTROLLED' | 'OUT_OF_STOCK' | 'PRESCRIPTION_REQUIRED';

/**
 * Why a product cannot go in an online order, or null.
 * `prescribedDrugIds`: drugs of a valid prescription of the patient attached to the order.
 */
export function cartProblem(p: ProductForCart, prescribedDrugIds: ReadonlySet<string>): CartProblem | null {
  if (p.controlled) return 'CONTROLLED';
  if (p.availability === 'OUT_OF_STOCK') return 'OUT_OF_STOCK';
  if (p.prescriptionOnly && !(p.drugId && prescribedDrugIds.has(p.drugId))) return 'PRESCRIPTION_REQUIRED';
  return null;
}

export interface DeliveryZone {
  localityId: string;
  feeKmf: number;
}

/** Delivery fee for a locality, or null when the pharmacy does not deliver there. */
export function deliveryFee(zones: DeliveryZone[], localityId: string): number | null {
  return zones.find((z) => z.localityId === localityId)?.feeKmf ?? null;
}

/** A sponsored placement is shown only while active, always labelled « Partenaire ». */
export const placementActive = (p: { startsAt: Date; endsAt: Date }, at: Date) => p.startsAt <= at && at < p.endsAt;
