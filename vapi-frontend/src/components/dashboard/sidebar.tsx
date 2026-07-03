'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AudioWaveform,
  Bot,
  LayoutDashboard,
  Phone,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard, exact: true },
  { label: 'Agents', href: '/dashboard/agents', icon: Bot },
  { label: 'Calls', href: '/dashboard/calls', icon: Phone },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-sidebar md:flex">
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <div className="flex size-7 items-center justify-center rounded-md border border-border bg-card">
          <AudioWaveform className="size-3.5 text-foreground" aria-hidden />
        </div>
        <span className="text-sm font-semibold tracking-tight text-foreground">
          VoxCRM
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-3" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
              )}
            >
              <item.icon className="size-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">Voice AI Console</p>
        <p className="text-xs text-muted-foreground/60">v1.0.0</p>
      </div>
    </aside>
  );
}
