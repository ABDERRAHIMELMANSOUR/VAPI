import type { AuthPrincipal } from './index';

/**
 * Augment Express' Request so authenticated handlers can read `req.auth`
 * with full type-safety after the auth middleware has run.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPrincipal;
    }
  }
}

export {};
