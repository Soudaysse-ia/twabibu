import { z } from 'zod';

/** A place of consultation, edited in Twabibu Pro (SPEC-07 PRO-06): address, map pin, access, opening hours. */
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM');
/** Up to three ranges a day, e.g. [["08:00","12:00"],["14:00","17:30"]]. A missing day is closed. */
export const OpeningHoursSchema = z.partialRecord(z.enum(WEEKDAYS), z.array(z.tuple([time, time])).max(3));
export type OpeningHoursInput = z.infer<typeof OpeningHoursSchema>;

const text = (max: number) => z.string().trim().max(max);

export const AccessInfoSchema = z.object({
  floor: text(60).optional(),
  wheelchair: z.boolean().optional(),
  elevator: z.boolean().optional(),
  parking: z.boolean().optional(),
  notes: text(300).optional(),
});

/** Bounding box of Ngazidja, Ndzuani and Mwali: a pin outside is a typing or dragging mistake. */
export const COMOROS_BOUNDS = { minLat: -12.6, maxLat: -11.2, minLng: 43.0, maxLng: 44.7 } as const;

export const PracticeUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  addressLine: z.string().trim().min(3).max(200),
  localityId: z.uuid(),
  /** Free input (« 773 12 34 », « +269… »), normalised by the API. Null: no phone shown. */
  phone: z.string().trim().max(30).nullable(),
  /** Null: the pin goes to the centre of the locality. */
  position: z
    .object({
      lat: z.number().min(COMOROS_BOUNDS.minLat).max(COMOROS_BOUNDS.maxLat),
      lng: z.number().min(COMOROS_BOUNDS.minLng).max(COMOROS_BOUNDS.maxLng),
    })
    .nullable(),
  accessInfo: AccessInfoSchema,
  openingHours: OpeningHoursSchema,
});
export type PracticeUpdate = z.infer<typeof PracticeUpdateSchema>;
