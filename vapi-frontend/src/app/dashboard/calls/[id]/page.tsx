'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  FileText,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AudioPlayer, type AudioPlayerHandle } from '@/components/calls/audio-player';
import { TranscriptThread } from '@/components/calls/transcript-thread';
import { AnalysisPanel } from '@/components/calls/analysis-panel';
import { StatusBadge } from '@/components/calls/status-badge';
import { api } from '@/lib/api';
import { formatDate, formatDuration } from '@/lib/format';
import type { Call } from '@/lib/types';

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export default function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [call, setCall] = useState<Call | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const playerRef = useRef<AudioPlayerHandle>(null);

  const loading = call === null && error === null;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { call: data } = await api.calls.get(id);
        if (!cancelled) setCall(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load call');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSeek = useCallback((seconds: number) => {
    playerRef.current?.seek(seconds);
  }, []);

  if (error) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {error}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!call) return null;

  const inbound = call.direction === 'INBOUND';
  const duration = call.durationSec ?? 0;

  return (
    <div className="space-y-5">
      <BackLink />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md border border-border bg-card">
            {inbound ? (
              <ArrowDownLeft className="size-5 text-muted-foreground" aria-hidden />
            ) : (
              <ArrowUpRight className="size-5 text-muted-foreground" aria-hidden />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {inbound ? 'Inbound call' : 'Outbound call'}
              </h2>
              <StatusBadge status={call.status} />
            </div>
            <p className="font-mono text-xs text-muted-foreground">{call.id}</p>
          </div>
        </div>
      </div>

      {/* Metadata strip */}
      <Card className="border-border bg-card py-0">
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-6">
          <Meta label="Assistant" value={call.agent?.name ?? 'Unassigned'} />
          <Meta label="Customer" value={inbound ? call.fromNumber ?? '—' : call.toNumber ?? '—'} />
          <Meta label="Type" value={inbound ? 'Inbound' : 'Outbound'} />
          <Meta label="Duration" value={formatDuration(call.durationSec)} />
          <Meta label="Started" value={formatDate(call.startedAt ?? call.createdAt)} />
          <Meta
            label="Ended reason"
            value={call.endedReason ? call.endedReason.replace(/_/g, ' ') : '—'}
          />
        </CardContent>
      </Card>

      {/* Audio player */}
      <AudioPlayer
        ref={playerRef}
        recordingUrl={call.recordingUrl}
        durationSec={duration}
        seed={call.id}
        onTimeUpdate={setCurrentTime}
      />

      {/* Transcript + analysis */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border bg-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold tracking-tight">
              Conversation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TranscriptThread
              turns={Array.isArray(call.transcript) ? call.transcript : []}
              durationSec={duration}
              currentTime={currentTime}
              onSeek={handleSeek}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <FileText className="size-4 text-muted-foreground" aria-hidden />
              <CardTitle className="text-base font-semibold tracking-tight">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {call.summary ? (
                <p className="text-sm leading-relaxed text-muted-foreground">{call.summary}</p>
              ) : (
                <p className="rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground/70">
                  No summary yet. Summaries are generated when a call completes.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base font-semibold tracking-tight">Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <AnalysisPanel analysis={call.analysis} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
      <Link href="/dashboard/calls">
        <ArrowLeft className="size-4" aria-hidden />
        Back to calls
      </Link>
    </Button>
  );
}
