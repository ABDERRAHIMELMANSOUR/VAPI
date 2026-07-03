import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, AUTH_COOKIE_MAX_AGE, BACKEND_API_URL } from '@/lib/config';

/**
 * POST /api/auth/login
 * Forwards credentials to the backend, then stores the returned JWT in an
 * httpOnly cookie so it is invisible to client-side JavaScript. The user
 * object (never the token) is returned to the caller.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'UPSTREAM_UNREACHABLE',
          message: 'Could not reach the API server. Check BACKEND_API_URL.',
        },
      },
      { status: 502 },
    );
  }

  const data = (await upstream.json().catch(() => null)) as
    | { user?: unknown; token?: string; error?: unknown }
    | null;

  if (!upstream.ok || !data?.token) {
    return NextResponse.json(
      data ?? { error: { code: 'UPSTREAM_ERROR', message: 'Login failed' } },
      { status: upstream.ok ? 502 : upstream.status },
    );
  }

  const res = NextResponse.json({ user: data.user });
  res.cookies.set(AUTH_COOKIE, data.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE,
  });
  return res;
}
