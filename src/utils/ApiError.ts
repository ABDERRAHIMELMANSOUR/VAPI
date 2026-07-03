/**
 * Operational error carrying an HTTP status code. Thrown by controllers/services
 * and translated into a JSON response by the global error handler.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  /** Operational errors are expected; non-operational ones indicate bugs. */
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    message: string,
    options: { code?: string; details?: unknown; isOperational?: boolean } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = options.code ?? defaultCodeForStatus(statusCode);
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message = 'Bad request', details?: unknown): ApiError {
    return new ApiError(400, message, { code: 'BAD_REQUEST', details });
  }

  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(401, message, { code: 'UNAUTHORIZED' });
  }

  static forbidden(message = 'Forbidden'): ApiError {
    return new ApiError(403, message, { code: 'FORBIDDEN' });
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(404, message, { code: 'NOT_FOUND' });
  }

  static conflict(message = 'Conflict', details?: unknown): ApiError {
    return new ApiError(409, message, { code: 'CONFLICT', details });
  }

  static internal(message = 'Internal server error'): ApiError {
    return new ApiError(500, message, { code: 'INTERNAL', isOperational: false });
  }
}

function defaultCodeForStatus(status: number): string {
  const map: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    500: 'INTERNAL',
  };
  return map[status] ?? 'ERROR';
}
