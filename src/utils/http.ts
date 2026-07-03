import type { Request } from 'express';
import { ApiError } from './ApiError';

/**
 * Safely read a single route param as a string. Express 5 types params as
 * `string | string[]` (repeated segments); our routes only use single values,
 * so collapse arrays and reject empties.
 */
export function param(req: Request, name: string): string {
  const value = (req.params as Record<string, string | string[] | undefined>)[name];
  const resolved = Array.isArray(value) ? value[0] : value;
  if (!resolved) throw ApiError.badRequest(`Missing route parameter: ${name}`);
  return resolved;
}
