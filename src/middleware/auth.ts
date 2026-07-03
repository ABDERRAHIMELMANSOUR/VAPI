import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import type { AuthPrincipal } from '../types';

interface JwtPayload {
  sub: string;
  email?: string;
}

/** Sign a short-lived API token for a user. */
export function signToken(principal: AuthPrincipal): string {
  const payload: JwtPayload = { sub: principal.userId, email: principal.email };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  // Twilio websocket upgrades cannot send Authorization headers easily, so also
  // accept a token via query string for signed stream URLs.
  const queryToken = req.query.token;
  if (typeof queryToken === 'string' && queryToken.length > 0) return queryToken;
  return null;
}

/**
 * Verifies the Bearer token and attaches `req.auth`. Rejects with 401 when the
 * token is missing, malformed, or expired.
 */
export const requireAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) {
    return next(ApiError.unauthorized('Missing or malformed Authorization header'));
  }
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.auth = { userId: decoded.sub, email: decoded.email };
    return next();
  } catch {
    return next(ApiError.unauthorized('Invalid or expired token'));
  }
};

/** Verify a raw token string outside of the middleware pipeline (e.g. WS upgrade). */
export function verifyToken(token: string): AuthPrincipal {
  const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  return { userId: decoded.sub, email: decoded.email };
}

/** Convenience accessor that guarantees an authenticated principal is present. */
export function getPrincipal(req: Request): AuthPrincipal {
  if (!req.auth) throw ApiError.unauthorized();
  return req.auth;
}
