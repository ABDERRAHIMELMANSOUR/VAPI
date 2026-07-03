import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';
import { isProduction } from '../config/env';
import { createLogger } from '../utils/logger';

const log = createLogger('http');

/** 404 handler for unmatched routes. Must be registered after all routes. */
export const notFoundHandler: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

/**
 * Global error handler. Normalizes ApiError, Zod, and Prisma errors into a
 * consistent JSON envelope and logs unexpected failures with a stack trace.
 * Must be the LAST middleware registered.
 */
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // `next` is required for Express to treat this as an error handler.
  _next: NextFunction,
) => {
  const normalized = normalizeError(err);

  const logMeta = {
    method: req.method,
    path: req.originalUrl,
    statusCode: normalized.statusCode,
    code: normalized.code,
  };

  if (normalized.statusCode >= 500) {
    log.error(normalized.message, { ...logMeta, stack: (err as Error)?.stack });
  } else {
    log.warn(normalized.message, logMeta);
  }

  const body: Record<string, unknown> = {
    error: {
      code: normalized.code,
      message: normalized.message,
    },
  };
  if (normalized.details !== undefined) {
    (body.error as Record<string, unknown>).details = normalized.details;
  }
  // Never leak internal stack traces to clients in production.
  if (!isProduction && normalized.statusCode >= 500 && err instanceof Error) {
    (body.error as Record<string, unknown>).stack = err.stack;
  }

  res.status(normalized.statusCode).json(body);
};

function normalizeError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({
      field: i.path.join('.') || '(root)',
      message: i.message,
    }));
    return ApiError.badRequest('Validation failed', details);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return mapPrismaError(err);
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return ApiError.badRequest('Invalid database query parameters');
  }

  if (err instanceof Error) {
    // Unknown / programmer error — surface as 500 without leaking the message
    // in production.
    return new ApiError(500, isProduction ? 'Internal server error' : err.message, {
      code: 'INTERNAL',
      isOperational: false,
    });
  }

  return ApiError.internal();
}

function mapPrismaError(err: Prisma.PrismaClientKnownRequestError): ApiError {
  switch (err.code) {
    case 'P2002': {
      const target = (err.meta?.target as string[] | undefined)?.join(', ');
      return ApiError.conflict(
        `A record with this ${target ?? 'value'} already exists`,
        err.meta,
      );
    }
    case 'P2025':
      return ApiError.notFound('The requested record does not exist');
    case 'P2003':
      return ApiError.badRequest('Related record not found (foreign key constraint failed)');
    default:
      return new ApiError(500, 'Database error', {
        code: `PRISMA_${err.code}`,
        isOperational: false,
      });
  }
}
