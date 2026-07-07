import type { Metadata } from 'next';
// Geist ships its font files inside the npm package, so production builds are
// hermetic — no build-time fetch from Google Fonts (which can fail in CI/cloud
// builders and cascade into misleading prerender errors).
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'VoxCRM',
    template: '%s — VoxCRM',
  },
  description: 'Voice AI agents and email marketing, in one console.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Dark-only interface by design; the `dark` class activates the zinc theme.
    <html lang="en" className="dark">
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
