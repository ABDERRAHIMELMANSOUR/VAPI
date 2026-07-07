import { CheckCircle2, CircleDashed, CircleSlash, Minus, Smile, Frown, Meh } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CallAnalysis } from '@/lib/types';

const SENTIMENT = {
  positive: { label: 'Positive', icon: Smile, className: 'text-emerald-400' },
  neutral: { label: 'Neutral', icon: Meh, className: 'text-muted-foreground' },
  negative: { label: 'Negative', icon: Frown, className: 'text-red-400' },
} as const;

const SUCCESS = {
  success: { label: 'Successful', icon: CheckCircle2, className: 'text-emerald-400' },
  partial: { label: 'Partial', icon: CircleDashed, className: 'text-amber-400' },
  unresolved: { label: 'Unresolved', icon: CircleSlash, className: 'text-red-400' },
} as const;

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function AnalysisPanel({ analysis }: { analysis: CallAnalysis | null }) {
  const sentiment = analysis?.sentiment ? SENTIMENT[analysis.sentiment] : null;
  const success = analysis?.successEvaluation ? SUCCESS[analysis.successEvaluation] : null;
  const topics = analysis?.topics ?? [];
  const keyPoints = analysis?.keyPoints ?? [];
  const actionItems = analysis?.actionItems ?? [];

  const empty = !sentiment && !success && topics.length === 0 && keyPoints.length === 0;

  if (empty) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground/70">
        Analysis is generated automatically once the call completes.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="divide-y divide-border rounded-lg border border-border bg-background px-3">
        <Row label="Sentiment">
          {sentiment ? (
            <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', sentiment.className)}>
              <sentiment.icon className="size-4" aria-hidden />
              {sentiment.label}
            </span>
          ) : (
            <Minus className="size-4 text-muted-foreground/50" aria-hidden />
          )}
        </Row>
        <Row label="Outcome">
          {success ? (
            <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', success.className)}>
              <success.icon className="size-4" aria-hidden />
              {success.label}
            </span>
          ) : (
            <Minus className="size-4 text-muted-foreground/50" aria-hidden />
          )}
        </Row>
        {typeof analysis?.turnCount === 'number' ? (
          <Row label="Turns">
            <span className="font-mono text-sm text-foreground">{analysis.turnCount}</span>
          </Row>
        ) : null}
      </div>

      {topics.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Topics</p>
          <div className="flex flex-wrap gap-1.5">
            {topics.map((t) => (
              <Badge key={t} variant="outline" className="border-border font-normal text-muted-foreground">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {keyPoints.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Key points</p>
          <ul className="space-y-1">
            {keyPoints.map((point, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {actionItems.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Action items</p>
          <ul className="space-y-1">
            {actionItems.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
