import { z } from 'zod';
import { dateKeySchema, isoDateTimeSchema, uuidSchema } from './common.js';

export const SlotSchema = z.object({ startsAt: isoDateTimeSchema, endsAt: isoDateTimeSchema, remainingCapacity: z.number().int().min(1) });
export type SlotDto = z.infer<typeof SlotSchema>;

export const AvailabilityDaySchema = z.object({ date: dateKeySchema, slots: z.array(SlotSchema) });
export type AvailabilityDay = z.infer<typeof AvailabilityDaySchema>;

export const AvailabilityQuerySchema = z.object({
  practiceId: uuidSchema.optional(),
  motiveId: uuidSchema,
  from: dateKeySchema,
  to: dateKeySchema,
});
export type AvailabilityQuery = z.infer<typeof AvailabilityQuerySchema>;

export const SlotLockRequestSchema = z.object({ agendaId: uuidSchema, motiveId: uuidSchema, startsAt: isoDateTimeSchema });
export type SlotLockRequest = z.infer<typeof SlotLockRequestSchema>;
