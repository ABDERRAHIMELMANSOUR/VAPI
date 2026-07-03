import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, BACKEND_API_URL } from '@/lib/config';

/**
 * Authenticated catch-all BFF proxy.
 *
 * The browser calls /api/backend/<path>; this handler attaches the JWT from
 * the httpOnly cookie as a Bearer token and forwards the request to the
 * backend's /api/<path>. Status codes and JSON bodies pass through verbatim,
 * so the client sees the backend's own error envelopes.
 */
async function proxy(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await context.params;
  const token = (await cookies()).get(AUTH_COOKIE)?.value;

  if (!token) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    );
  }

  const target = new URL(`${BACKEND_API_URL}/api/${path.join('/')}`);
  req.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.append(key, value);
  });

  const init: RequestInit = {
    method: req.method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const body = await req.text();
    if (body.length > 0) init.body = body;
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
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

  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
    },
  });
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
};
