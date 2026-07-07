import { cn } from '@/lib/utils';
import type { CampaignStatus } from '@/lib/types';

const STYLES: Record<CampaignStatus, { label: string; className: string; dot: string }> = {
  DRAFT: { label: 'Draft', className: 'border-border bg-muted/60 text-muted-foreground', dot: 'bg-zinc-400' },
  QUEUED: { label: 'Queued', className: 'border-sky-500/20 bg-sky-500/10 text-sky-400', dot: 'bg-sky-400' },
  SENDING: { label: 'Sending', className: 'border-sky-500/20 bg-sky-500/10 text-sky-400', dot: 'bg-sky-400' },
  SENT: { label: 'Sent', className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400', dot: 'bg-emerald-400' },
  PAUSED: { label: 'Paused', className: 'border-amber-500/20 bg-amber-500/10 text-amber-400', dot: 'bg-amber-400' },
  FAILED: { label: 'Failed', className: 'border-red-500/20 bg-red-500/10 text-red-400', dot: 'bg-red-400' },
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const style = STYLES[status] ?? STYLES.DRAFT;
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
