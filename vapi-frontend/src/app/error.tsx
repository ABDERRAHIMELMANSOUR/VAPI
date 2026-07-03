'use client';

import { useEffect } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Segment-level error boundary. Renders inside the root layout, so the theme
 * and fonts still apply; only the failing route subtree is replaced.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the failure in the browser console for debugging/telemetry.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="flex size-12 items-center justify-center rounded-md border border-border bg-card">
        <TriangleAlert className="size-6 text-muted-foreground" aria-hidden />
      </div>
      <div className="space-y-1.5 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Something went wrong
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          An unexpected error occurred while rendering this page. You can try
          again; if the problem persists, contact support.
        </p>
        {error.digest ? (
          <p className="font-mono text-xs text-muted-foreground/70">
            Reference: {error.digest}
          </p>
        ) : null}
      </div>
      <Button onClick={reset} variant="secondary" size="sm">
        <RotateCcw className="size-4" aria-hidden />
        Try again
      </Button>
    </main>
  );
}
