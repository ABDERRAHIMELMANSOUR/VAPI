/**
 * Server-side configuration. The browser NEVER talks to the backend directly:
 * all requests flow through Next.js route handlers (the BFF proxy), which
 * attach the httpOnly cookie's JWT. BACKEND_API_URL is therefore read on the
 * server only — no NEXT_PUBLIC_ prefix is required (the NEXT_PUBLIC_ variant
 * is still accepted as an alias in case the variable was created under that
 * name in the deploy environment).
 *
 * Resolution order:
 *   1. BACKEND_API_URL              (preferred; set per environment)
 *   2. NEXT_PUBLIC_BACKEND_API_URL  (alias, read server-side)
 *   3. Production fallback          (live Railway backend)
 *   4. http://localhost:8080        (local development)
 */
const PRODUCTION_BACKEND_FALLBACK = 'https://vapi-production-49e8.up.railway.app';

export const BACKEND_API_URL = (
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_BACKEND_API_URL ??
  (process.env.NODE_ENV === 'production'
    ? PRODUCTION_BACKEND_FALLBACK
    : 'http://localhost:8080')
).replace(/\/+$/, '');

/** Name of the httpOnly cookie carrying the backend JWT. */
export const AUTH_COOKIE = 'vox_token';

/** Cookie lifetime — matches the backend's JWT_EXPIRES_IN default (7 days). */
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
