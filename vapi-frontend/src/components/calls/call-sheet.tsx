'use client';

import {
  ArrowDownLeft,
  ArrowUpRight,
  Bot,
  FileText,
  MessageSquare,
  User,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { StatusBadge } from '@/components/calls/status-badge';
import { formatDate, formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Call, TranscriptTurn } from '@/lib/types';

interface CallSheetProps {
  call: Call | null;
  onOpenChange: (open: boolean) => void;
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}

function TranscriptBubble({ turn }: { turn: TranscriptTurn }) {
  const isAssistant = turn.role === 'assistant';
  return (
    <div className="flex gap-2.5">
      <div
        className={cn(
          'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border',
          isAssistant
            ? 'border-border bg-card text-foreground'
            : 'border-border bg-background text-muted-foreground',
        )}
      >
        {isAssistant ? (
          <Bot className="size-3.5" aria-hidden />
        ) : (
          <User className="size-3.5" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-foreground">
            {isAssistant ? 'Agent' : 'Caller'}
          </span>
          {turn.at ? (
            <span className="text-[11px] text-muted-foreground/70">
              {formatDate(turn.at)}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
          {turn.text}
        </p>
      </div>
    </div>
  );
}

/** Right-hand drawer with call metadata, AI summary and the full transcript. */
export function CallSheet({ call, onOpenChange }: CallSheetProps) {
  // transcript is persisted as JSON on the backend; guard the shape defensively.
  const transcript = (Array.isArray(call?.transcript) ? call.transcript : []).filter(
    (t) => t.role !== 'system',
  );

  return (
    <Sheet open={call !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto border-border bg-card sm:max-w-lg">
        {call ? (
          <>
            <SheetHeader className="space-y-3 border-b border-border">
              <div className="flex items-center gap-2">
                {call.direction === 'INBOUND' ? (
                  <ArrowDownLeft className="size-4 text-muted-foreground" aria-hidden />
                ) : (
                  <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden />
                )}
                <SheetTitle className="tracking-tight">
                  {call.direction === 'INBOUND' ? 'Inbound call' : 'Outbound call'}
                </SheetTitle>
                <StatusBadge status={call.status} />
              </div>
              <SheetDescription className="font-mono text-xs">
                {call.id}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 p-4">
              <section className="rounded-md border border-border bg-background px-3 py-2">
                <MetaRow label="From" value={call.fromNumber ?? '—'} />
                <MetaRow label="To" value={call.toNumber ?? '—'} />
                <MetaRow label="Agent" value={call.agent?.name ?? 'Unassigned'} />
                <MetaRow label="Duration" value={formatDuration(call.durationSec)} />
                <MetaRow label="Started" value={formatDate(call.startedAt ?? call.createdAt)} />
                <MetaRow label="Ended" value={formatDate(call.endedAt)} />
              </section>

              <section>
                <div className="mb-2 flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" aria-hidden />
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    AI summary
                  </h3>
                </div>
                {call.summary ? (
                  <p className="rounded-md border border-border bg-background px-3 py-2.5 text-sm leading-relaxed text-muted-foreground">
                    {call.summary}
                  </p>
                ) : (
                  <p className="rounded-md border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground/70">
                    No summary yet. Summaries are generated automatically when a
                    call completes.
                  </p>
                )}
                {call.summaryEmailed ? (
                  <p className="mt-1.5 text-xs text-muted-foreground/70">
                    Summary emailed to the contact.
                  </p>
                ) : null}
              </section>

              <Separator className="bg-border" />

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <MessageSquare className="size-4 text-muted-foreground" aria-hidden />
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    Transcript
                  </h3>
                  <span className="text-xs text-muted-foreground/70">
                    {transcript.length} turns
                  </span>
                </div>
                {transcript.length > 0 ? (
                  <div className="space-y-4">
                    {transcript.map((turn, index) => (
                      <TranscriptBubble key={`${index}-${turn.at ?? ''}`} turn={turn} />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground/70">
                    No transcript recorded for this call.
                  </p>
                )}
              </section>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
