import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type infer as ZodInfer } from 'zod';
import { ApiError } from '../utils/ApiError';

type RequestPart = 'body' | 'query' | 'params';

/**
 * Builds middleware that validates + coerces a part of the request against a
 * Zod schema. On success the parsed value replaces the raw one so downstream
 * handlers receive typed, sanitized data. On failure it raises a 400 with a
 * structured list of field issues.
 */
export function validate(schema: ZodTypeAny, part: RequestPart = 'body'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      return next(zodToApiError(result.error));
    }
    // Express 5 exposes `query` (and sometimes `params`) as getter-only
    // properties, so a plain assignment throws. Re-define the property to hold
    // the parsed, coerced value that downstream handlers will read.
    Object.defineProperty(req, part, {
      value: result.data,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    return next();
  };
}

/** Type helper to infer the validated body type from a schema. */
export type Validated<T extends ZodTypeAny> = ZodInfer<T>;

function zodToApiError(error: ZodError): ApiError {
  const details = error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
    code: issue.code,
  }));
  return ApiError.badRequest('Validation failed', details);
}
