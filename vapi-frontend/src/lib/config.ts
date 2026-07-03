/**
 * Server-side configuration. BACKEND_API_URL is intentionally NOT prefixed
 * with NEXT_PUBLIC_: the browser never talks to the backend directly. All
 * requests flow through Next.js route handlers (the BFF proxy), which attach
 * the httpOnly auth cookie's JWT. This keeps the token out of client-side
 * JavaScript entirely and avoids CORS.
 *
 * Local dev:   http://localhost:8080
 * Production:  your Railway deployment, e.g. https://voxcrm.up.railway.app
 */
export const BACKEND_API_URL = (
  process.env.BACKEND_API_URL ?? 'http://localhost:8080'
).replace(/\/+$/, '');

/** Name of the httpOnly cookie carrying the backend JWT. */
export const AUTH_COOKIE = 'vox_token';

/** Cookie lifetime — matches the backend's JWT_EXPIRES_IN default (7 days). */
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
