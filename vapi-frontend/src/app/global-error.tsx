'use client';

/**
 * Root error boundary. This replaces the ENTIRE root layout when it triggers,
 * so per Next.js App Router requirements it must render its own lowercase
 * html and body elements.
 *
 * It is also styled inline on purpose: when the root layout has crashed we
 * cannot rely on globals.css or font variables being present.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100svh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#09090b',
          color: '#fafafa',
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <main style={{ textAlign: 'center', padding: '0 16px', maxWidth: 420 }}>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              margin: '0 0 8px',
            }}
          >
            Application error
          </h1>
          <p style={{ fontSize: 14, color: '#a1a1aa', margin: '0 0 8px' }}>
            A critical error occurred and the console could not be rendered.
            Reload the page or try again in a moment.
          </p>
          {error.digest ? (
            <p
              style={{
                fontSize: 12,
                color: '#71717a',
                fontFamily: 'ui-monospace, monospace',
                margin: '0 0 20px',
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            onClick={reset}
            style={{
              appearance: 'none',
              border: '1px solid #27272a',
              borderRadius: 8,
              backgroundColor: '#18181b',
              color: '#fafafa',
              fontSize: 14,
              fontWeight: 500,
              padding: '8px 16px',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
