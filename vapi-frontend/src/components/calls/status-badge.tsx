import { cn } from '@/lib/utils';
import type { CallStatus } from '@/lib/types';

const STATUS_STYLES: Record<CallStatus, { label: string; className: string; dot: string }> = {
  COMPLETED: {
    label: 'Completed',
    className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
    dot: 'bg-emerald-400',
  },
  IN_PROGRESS: {
    label: 'In progress',
    className: 'border-sky-500/20 bg-sky-500/10 text-sky-400',
    dot: 'bg-sky-400',
  },
  RINGING: {
    label: 'Ringing',
    className: 'border-sky-500/20 bg-sky-500/10 text-sky-400',
    dot: 'bg-sky-400',
  },
  QUEUED: {
    label: 'Queued',
    className: 'border-border bg-muted/60 text-muted-foreground',
    dot: 'bg-zinc-400',
  },
  FAILED: {
    label: 'Failed',
    className: 'border-red-500/20 bg-red-500/10 text-red-400',
    dot: 'bg-red-400',
  },
  NO_ANSWER: {
    label: 'No answer',
    className: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
    dot: 'bg-amber-400',
  },
  CANCELED: {
    label: 'Canceled',
    className: 'border-border bg-muted/60 text-muted-foreground',
    dot: 'bg-zinc-400',
  },
};

/** Subtle tinted pill with a status dot, in the restrained Linear style. */
export function StatusBadge({ status }: { status: CallStatus }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.QUEUED;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
        style.className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', style.dot)} aria-hidden />
      {style.label}
    </span>
  );
}
