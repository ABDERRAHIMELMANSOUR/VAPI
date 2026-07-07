'use client';

import { usePathname } from 'next/navigation';
import { ChevronDown, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';
import { initialsOf } from '@/lib/format';

const PAGE_TITLES: Array<{ prefix: string; title: string }> = [
  { prefix: '/dashboard/agents', title: 'Agents' },
  { prefix: '/dashboard/phone-numbers', title: 'Phone Numbers' },
  { prefix: '/dashboard/outbound', title: 'Outbound Campaigns' },
  { prefix: '/dashboard/calls', title: 'Calls' },
  { prefix: '/dashboard/email', title: 'Email Campaigns' },
  { prefix: '/dashboard', title: 'Overview' },
];

function titleForPath(pathname: string): string {
  return PAGE_TITLES.find((p) => pathname.startsWith(p.prefix))?.title ?? 'Dashboard';
}

export function Header() {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
      <h1 className="text-sm font-semibold tracking-tight text-foreground">
        {titleForPath(pathname)}
      </h1>

      {loading ? (
        <div className="flex items-center gap-2">
          <Skeleton className="size-7 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>
      ) : user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 px-2 text-muted-foreground hover:text-foreground"
            >
              <Avatar className="size-7 border border-border">
                <AvatarFallback className="bg-card text-xs font-medium">
                  {initialsOf(user.name || user.email)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline">
                {user.name || user.email}
              </span>
              <ChevronDown className="size-3.5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium text-foreground">
                {user.name ?? 'Workspace owner'}
              </p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                void logout();
              }}
            >
              <LogOut className="size-4" aria-hidden />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </header>
  );
}
