import { z } from 'zod';
import { IslandCode } from './enums.js';

export const IslandSchema = z.object({ id: z.string(), code: IslandCode, name: z.string(), frenchName: z.string(), slug: z.string() });
export type Island = z.infer<typeof IslandSchema>;

export const LocalitySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  island: IslandCode,
  lat: z.number(),
  lng: z.number(),
});
export type Locality = z.infer<typeof LocalitySchema>;

export const SpecialitySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  group: z.string(),
  canPrescribe: z.boolean(),
});
export type Speciality = z.infer<typeof SpecialitySchema>;

export const HealthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string(),
  checks: z.object({ database: z.boolean(), redis: z.boolean() }),
  time: z.string(),
});
export type Health = z.infer<typeof HealthSchema>;
