import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * App Router 404. Having a custom not-found page keeps Next from falling back
 * to its internal pages-router error document during static generation.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="flex size-12 items-center justify-center rounded-md border border-border bg-card">
        <SearchX className="size-6 text-muted-foreground" aria-hidden />
      </div>
      <div className="space-y-1.5 text-center">
        <p className="font-mono text-xs text-muted-foreground">404</p>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Page not found
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The page you are looking for does not exist or may have been moved.
        </p>
      </div>
      <Button asChild variant="secondary" size="sm">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </main>
  );
}
