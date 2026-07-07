'use client';

import { useMemo } from 'react';
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TranscriptTurn } from '@/lib/types';

interface TranscriptThreadProps {
  turns: TranscriptTurn[];
  /** Total call duration in seconds, used to clamp turn offsets. */
  durationSec: number;
  /** Current playback position in seconds. */
  currentTime: number;
  onSeek: (seconds: number) => void;
}

interface TimedTurn extends TranscriptTurn {
  offset: number;
}

function fmt(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

/**
 * Compute each turn's playback offset. Uses the `at` timestamps when available
 * (relative to the first turn); otherwise distributes turns evenly across the
 * call duration so the timeline stays usable.
 */
function withOffsets(turns: TranscriptTurn[], durationSec: number): TimedTurn[] {
  const dialogue = turns.filter((t) => t.role !== 'system');
  const times = dialogue.map((t) => (t.at ? new Date(t.at).getTime() : NaN));
  const base = times.find((t) => !Number.isNaN(t));

  return dialogue.map((turn, i) => {
    let offset: number;
    if (base && !Number.isNaN(times[i])) {
      offset = Math.max(0, (times[i] - base) / 1000);
    } else {
      offset = dialogue.length > 1 ? (i / (dialogue.length - 1)) * durationSec : 0;
    }
    return { ...turn, offset: Math.min(offset, durationSec) };
  });
}

export function TranscriptThread({
  turns,
  durationSec,
  currentTime,
  onSeek,
}: TranscriptThreadProps) {
  const timed = useMemo(() => withOffsets(turns, durationSec), [turns, durationSec]);

  // The active turn is the last one whose offset has been reached.
  const activeIndex = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < timed.length; i += 1) {
      if (timed[i].offset <= currentTime + 0.35) idx = i;
    }
    return idx;
  }, [timed, currentTime]);

  if (timed.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground/70">
        No transcript was recorded for this call.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {timed.map((turn, i) => {
        const isAssistant = turn.role === 'assistant';
        const active = i === activeIndex;
        return (
          <button
            key={`${i}-${turn.offset}`}
            type="button"
            onClick={() => onSeek(turn.offset)}
            className={cn(
              'flex w-full gap-2.5 rounded-lg border p-3 text-left transition-colors',
              active
                ? 'border-border bg-accent/60'
                : 'border-transparent hover:border-border hover:bg-accent/30',
            )}
          >
            <div
              className={cn(
                'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border',
                isAssistant
                  ? 'border-border bg-card text-foreground'
                  : 'border-border bg-background text-muted-foreground',
              )}
            >
              {isAssistant ? <Bot className="size-4" aria-hidden /> : <User className="size-4" aria-hidden />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {isAssistant ? 'Agent' : 'Customer'}
                </span>
                <span
                  className={cn(
                    'font-mono text-[11px]',
                    active ? 'text-foreground' : 'text-muted-foreground/60',
                  )}
                >
                  {fmt(turn.offset)}
                </span>
              </div>
              <p
                className={cn(
                  'mt-1 text-sm leading-relaxed',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {turn.text}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
