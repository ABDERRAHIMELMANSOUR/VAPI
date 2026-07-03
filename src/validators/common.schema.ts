import { z } from 'zod';

/** Standard list pagination + sort query params. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

/** Route param schema for `:id` (cuid). */
export const idParamSchema = z.object({
  id: z.string().min(1, 'id is required'),
});

export type IdParam = z.infer<typeof idParamSchema>;
