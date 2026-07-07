/**
 * Server-side configuration. The browser NEVER talks to the backend directly:
 * all requests flow through Next.js route handlers (the BFF proxy), which
 * attach the httpOnly cookie's JWT. BACKEND_API_URL is therefore read on the
 * server only — no NEXT_PUBLIC_ prefix is required (the NEXT_PUBLIC_ variant
 * is accepted as an alias in case the variable was created under that name).
 *
 * Resolution order (first candidate that is a valid http/https URL wins;
 * malformed values — e.g. missing scheme, stray quotes/spaces — are skipped
 * rather than breaking every proxied request):
 *   1. BACKEND_API_URL
 *   2. NEXT_PUBLIC_BACKEND_API_URL
 *   3. Production fallback (live Railway backend)
 *   4. http://localhost:8080 (local development)
 */
const PRODUCTION_BACKEND_FALLBACK = 'https://vapi-production-49e8.up.railway.app';

function sanitizeCandidate(raw: string | undefined): string | null {
  if (!raw) return null;
  // Strip whitespace and accidental wrapping quotes from dashboard copy/paste.
  const cleaned = raw.trim().replace(/^['"]+|['"]+$/g, '').replace(/\/+$/, '');
  if (cleaned.length === 0) return null;
  try {
    const url = new URL(cleaned);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return cleaned;
  } catch {
    return null;
  }
}

function resolveBackendUrl(): string {
  const candidates = [
    process.env.BACKEND_API_URL,
    process.env.NEXT_PUBLIC_BACKEND_API_URL,
  ];
  for (const candidate of candidates) {
    const valid = sanitizeCandidate(candidate);
    if (valid) return valid;
  }
  return process.env.NODE_ENV === 'production'
    ? PRODUCTION_BACKEND_FALLBACK
    : 'http://localhost:8080';
}

export const BACKEND_API_URL = resolveBackendUrl();

/** Name of the httpOnly cookie carrying the backend JWT. */
export const AUTH_COOKIE = 'vox_token';

/** Cookie lifetime — matches the backend's JWT_EXPIRES_IN default (7 days). */
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
