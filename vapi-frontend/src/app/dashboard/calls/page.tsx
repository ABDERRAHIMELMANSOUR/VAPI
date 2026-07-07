'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  Phone,
  TriangleAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/calls/status-badge';
import { api } from '@/lib/api';
import { formatDate, formatDuration, formatNumber } from '@/lib/format';
import type { Call, CallStatus, Paginated } from '@/lib/types';

const PAGE_SIZE = 15;

const STATUS_FILTERS: Array<{ value: CallStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'QUEUED', label: 'Queued' },
  { value: 'NO_ANSWER', label: 'No answer' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELED', label: 'Canceled' },
];

export default function CallsPage() {
  const router = useRouter();
  const [result, setResult] = useState<Paginated<Call> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<CallStatus | 'ALL'>('ALL');

  const loading = result === null && error === null;

  const load = useCallback(async () => {
    try {
      const data = await api.calls.list({
        page,
        limit: PAGE_SIZE,
        status: status === 'ALL' ? undefined : status,
        sort: 'desc',
      });
      setResult(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calls');
    }
  }, [page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = result?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Call history</h2>
          <p className="text-sm text-muted-foreground">
            {result ? `${formatNumber(result.total)} calls recorded` : 'Loading call log'}
          </p>
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as CallStatus | 'ALL');
            setPage(1);
            setResult(null);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((filter) => (
              <SelectItem key={filter.value} value={filter.value}>
                {filter.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {error}
        </div>
      ) : (
        <Card className="border-border bg-card py-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-32">Call ID</TableHead>
                  <TableHead>Assistant</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="w-28">Type</TableHead>
                  <TableHead className="w-24">Duration</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead className="w-28 text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i} className="border-border">
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : result && result.items.length === 0 ? (
                  <TableRow className="border-border hover:bg-transparent">
                    <TableCell colSpan={7}>
                      <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
                        <div className="flex size-10 items-center justify-center rounded-md border border-border bg-background">
                          <Phone className="size-5 text-muted-foreground" aria-hidden />
                        </div>
                        <p className="text-sm font-medium text-foreground">No calls found</p>
                        <p className="max-w-sm text-sm text-muted-foreground">
                          {status === 'ALL'
                            ? 'Calls appear here as soon as an agent answers or an outbound campaign runs.'
                            : 'No calls match this status filter.'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  result?.items.map((call) => {
                    const inbound = call.direction === 'INBOUND';
                    const customer = inbound ? call.fromNumber : call.toNumber;
                    return (
                      <TableRow
                        key={call.id}
                        onClick={() => router.push(`/dashboard/calls/${call.id}`)}
                        className="cursor-pointer border-border"
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            {call.summary ? (
                              <FileText className="size-3.5 text-muted-foreground" aria-label="Has summary" />
                            ) : null}
                            {call.id.slice(0, 10)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm font-medium text-foreground">
                          {call.agent?.name ?? '—'}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {customer ?? 'Unknown'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="border-border font-normal text-muted-foreground"
                          >
                            {inbound ? (
                              <ArrowDownLeft className="size-3" aria-hidden />
                            ) : (
                              <ArrowUpRight className="size-3" aria-hidden />
                            )}
                            {inbound ? 'Inbound' : 'Outbound'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {formatDuration(call.durationSec)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={call.status} />
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {formatDate(call.createdAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {result && result.items.length > 0 ? (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Page {result.page} of {Math.max(totalPages, 1)}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="size-4" aria-hidden />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
