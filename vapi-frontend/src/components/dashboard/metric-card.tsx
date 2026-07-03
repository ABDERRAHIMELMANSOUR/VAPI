import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  loading?: boolean;
}

/** Compact KPI tile used on the overview grid. */
export function MetricCard({ label, value, hint, icon: Icon, loading }: MetricCardProps) {
  return (
    <Card className="border-border bg-card py-0">
      <CardContent className="flex items-start justify-between p-5">
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="h-7 w-20" />
          ) : (
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {value}
            </p>
          )}
          {hint && !loading ? (
            <p className="text-xs text-muted-foreground/80">{hint}</p>
          ) : null}
        </div>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
        </div>
      </CardContent>
    </Card>
  );
}
