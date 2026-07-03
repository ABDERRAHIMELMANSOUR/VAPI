import type { Metadata } from 'next';
import { AuthProvider } from '@/context/auth-context';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';

export const metadata: Metadata = {
  title: 'Dashboard',
};

/**
 * Dashboard shell: fixed sidebar, sticky header, scrollable content column.
 * Access is enforced by the middleware before this layout ever renders.
 */
export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthProvider>
      <div className="min-h-svh bg-background">
        <Sidebar />
        <div className="flex min-h-svh flex-col md:pl-60">
          <Header />
          <main className="flex-1 px-6 py-6">{children}</main>
        </div>
      </div>
    </AuthProvider>
  );
}
