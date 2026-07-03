/**
 * Lightweight, dependency-free JWT payload inspection.
 *
 * This does NOT verify the signature — verification happens on the backend,
 * which holds the secret. The middleware only needs the `exp` claim to decide
 * whether a redirect to /login is warranted before the backend is ever hit.
 * Runs in the Edge runtime (middleware), so it uses atob rather than Buffer.
 */

interface JwtPayload {
  sub?: string;
  email?: string;
  exp?: number;
  iat?: number;
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/** True when the token is structurally valid and not past its expiry. */
export function isTokenUsable(token: string | undefined): boolean {
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload) return false;
  if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
    return false;
  }
  return true;
}
