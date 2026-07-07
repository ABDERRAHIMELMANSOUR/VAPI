import { NextResponse } from 'next/server';
import { BACKEND_API_URL } from '@/lib/config';

// Must run per-request: a static evaluation at build time would bake in (or
// fail on) the builder's network conditions instead of the runtime's.
export const dynamic = 'force-dynamic';

/**
 * GET /api/backend-health — connectivity diagnostic for the BFF proxy.
 *
 * Reports which backend URL this running container resolved and whether a
 * server-side fetch to its /api/health succeeds. Contains no secrets: the
 * backend URL is public and no credentials are involved.
 */
export async function GET(): Promise<NextResponse> {
  const startedAt = Date.now();
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const body = (await res.json().catch(() => null)) as unknown;
    return NextResponse.json({
      target: BACKEND_API_URL,
      reachable: res.ok,
      upstreamStatus: res.status,
      latencyMs: Date.now() - startedAt,
      upstream: body,
    });
  } catch (err) {
    return NextResponse.json(
      {
        target: BACKEND_API_URL,
        reachable: false,
        latencyMs: Date.now() - startedAt,
        error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
        cause:
          err instanceof Error && err.cause instanceof Error
            ? `${(err.cause as NodeJS.ErrnoException).code ?? err.cause.name}: ${err.cause.message}`
            : undefined,
      },
      { status: 502 },
    );
  }
}
