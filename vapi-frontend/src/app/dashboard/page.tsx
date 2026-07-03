'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Bot, CheckCircle2, Clock, Phone, TriangleAlert } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MetricCard } from '@/components/dashboard/metric-card';
import {
  CallVolumeChart,
  StatusDistributionChart,
  type StatusPoint,
  type VolumePoint,
} from '@/components/dashboard/charts';
import { api } from '@/lib/api';
import { dayKey, dayLabel, formatDuration, formatNumber } from '@/lib/format';
import type { Call } from '@/lib/types';

const VOLUME_WINDOW_DAYS = 14;

interface OverviewData {
  totalCalls: number;
  completedCalls: number;
  activeCalls: number;
  totalAgents: number;
  recentCalls: Call[];
}

function buildVolumeSeries(calls: Call[]): VolumePoint[] {
  const buckets = new Map<string, { total: number; completed: number }>();
  const today = new Date();

  for (let i = VOLUME_WINDOW_DAYS - 1; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    buckets.set(dayKey(day), { total: 0, completed: 0 });
  }

  for (const call of calls) {
    const key = dayKey(new Date(call.createdAt));
    const bucket = buckets.get(key);
    if (!bucket) continue; // outside the window
    bucket.total += 1;
    if (call.status === 'COMPLETED') bucket.completed += 1;
  }

  return [...buckets.entries()].map(([key, value]) => ({
    label: dayLabel(key),
    total: value.total,
    completed: value.completed,
  }));
}

function buildStatusSeries(calls: Call[]): StatusPoint[] {
  const counts = new Map<string, number>();
  for (const call of calls) {
    counts.set(call.status, (counts.get(call.status) ?? 0) + 1);
  }
  const order = [
    'COMPLETED',
    'IN_PROGRESS',
    'RINGING',
    'QUEUED',
    'NO_ANSWER',
    'FAILED',
    'CANCELED',
  ];
  return order
    .filter((status) => (counts.get(status) ?? 0) > 0)
    .map((status) => ({
      label: status.replace(/_/g, ' ').toLowerCase(),
      count: counts.get(status) ?? 0,
    }));
}

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loading = data === null && error === null;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [allCalls, completed, active, agents, recent] = await Promise.all([
          api.calls.list({ page: 1, limit: 1 }),
          api.calls.list({ page: 1, limit: 1, status: 'COMPLETED' }),
          api.calls.list({ page: 1, limit: 1, status: 'IN_PROGRESS' }),
          api.agents.list(1, 1),
          api.calls.list({ page: 1, limit: 100, sort: 'desc' }),
        ]);
        if (cancelled) return;
        setData({
          totalCalls: allCalls.total,
          completedCalls: completed.total,
          activeCalls: active.total,
          totalAgents: agents.total,
          recentCalls: recent.items,
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load metrics');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const volumeSeries = useMemo(
    () => buildVolumeSeries(data?.recentCalls ?? []),
    [data?.recentCalls],
  );
  const statusSeries = useMemo(
    () => buildStatusSeries(data?.recentCalls ?? []),
    [data?.recentCalls],
  );

  const avgDuration = useMemo(() => {
    const durations = (data?.recentCalls ?? [])
      .map((c) => c.durationSec)
      .filter((d): d is number => d != null && d > 0);
    if (durations.length === 0) return null;
    return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  }, [data?.recentCalls]);

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        <TriangleAlert className="size-4 shrink-0" aria-hidden />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total calls"
          value={formatNumber(data?.totalCalls ?? 0)}
          hint="All time"
          icon={Phone}
          loading={loading}
        />
        <MetricCard
          label="Completed"
          value={formatNumber(data?.completedCalls ?? 0)}
          hint="Resolved conversations"
          icon={CheckCircle2}
          loading={loading}
        />
        <MetricCard
          label="Active now"
          value={formatNumber(data?.activeCalls ?? 0)}
          hint="Calls in progress"
          icon={Activity}
          loading={loading}
        />
        <MetricCard
          label="Agents"
          value={formatNumber(data?.totalAgents ?? 0)}
          hint={avgDuration != null ? `Avg call ${formatDuration(avgDuration)}` : 'Configured assistants'}
          icon={Bot}
          loading={loading}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="border-border bg-card xl:col-span-3">
          <CardHeader>
            <CardTitle className="text-base font-semibold tracking-tight">
              Call volume
            </CardTitle>
            <CardDescription>
              Daily calls over the last {VOLUME_WINDOW_DAYS} days
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <CallVolumeChart data={volumeSeries} />
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold tracking-tight">
              Status mix
            </CardTitle>
            <CardDescription>Distribution across recent calls</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : statusSeries.length > 0 ? (
              <StatusDistributionChart data={statusSeries} />
            ) : (
              <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
                <Clock className="size-5 text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  No call activity yet. Connect a phone number to your agent to
                  start receiving calls.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
