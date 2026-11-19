import { z } from 'zod';

export const uuidSchema = z.uuid();
export const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
export const isoDateTimeSchema = z.iso.datetime();

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

export function pageOf<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), total: z.number().int(), page: z.number().int(), pageSize: z.number().int() });
}
