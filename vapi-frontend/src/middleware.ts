import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE } from '@/lib/config';
import { isTokenUsable } from '@/lib/jwt';

/**
 * Route guarding at the edge:
 *  - /dashboard/** requires a structurally valid, unexpired session token;
 *    otherwise the user is redirected to /login with a `next` return path.
 *  - /login redirects already-authenticated users straight to the dashboard.
 *
 * This is a UX gate only — real authorization happens on the backend, which
 * verifies the JWT signature on every request.
 */
export function middleware(req: NextRequest): NextResponse {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const authed = isTokenUsable(token);
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/dashboard') && !authed) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === '/login' && authed) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};
