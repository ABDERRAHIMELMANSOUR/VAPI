'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, Loader2, MoreHorizontal, Phone, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ImportTwilioDialog } from '@/components/phone-numbers/import-dialog';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Agent, PhoneNumber } from '@/lib/types';

export default function PhoneNumbersPage() {
  const [numbers, setNumbers] = useState<PhoneNumber[] | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loading = numbers === null && error === null;

  const load = useCallback(async () => {
    try {
      const [nums, ags] = await Promise.all([api.phoneNumbers.list(), api.agents.list(1, 100)]);
      setNumbers(nums.items);
      setAgents(ags.items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load phone numbers');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.phoneNumbers.remove(id);
      toast.success('Phone number released');
      setNumbers((prev) => prev?.filter((n) => n.id !== id) ?? prev);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to release number');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Phone numbers</h2>
          <p className="text-sm text-muted-foreground">
            Import Twilio numbers and bind them to agents for inbound calls.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Import Twilio
        </Button>
      </div>

      {error ? (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {error}
        </div>
      ) : loading ? (
        <Skeleton className="h-64 w-full" />
      ) : numbers && numbers.length === 0 ? (
        <Card className="border-dashed border-border bg-transparent">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-10 items-center justify-center rounded-md border border-border bg-card">
              <Phone className="size-5 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No phone numbers yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Import a Twilio number to receive inbound calls or run outbound
                campaigns.
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)} variant="secondary" size="sm">
              <Plus className="size-4" aria-hidden />
              Import Twilio
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-card py-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Number</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Inbound agent</TableHead>
                  <TableHead className="w-28">Capabilities</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-32 text-right">Imported</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {numbers?.map((n) => (
                  <TableRow key={n.id} className="border-border hover:bg-transparent">
                    <TableCell className="font-mono text-sm text-foreground">{n.number}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {n.friendlyName ?? '—'}
                    </TableCell>
                    <TableCell>
                      {n.agent ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                          <Bot className="size-3.5 text-muted-foreground" aria-hidden />
                          {n.agent.name}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground/60">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {n.capabilities?.voice ? (
                          <Badge variant="outline" className="border-border font-normal text-muted-foreground">
                            Voice
                          </Badge>
                        ) : null}
                        {n.capabilities?.sms ? (
                          <Badge variant="outline" className="border-border font-normal text-muted-foreground">
                            SMS
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          n.status === 'ACTIVE'
                            ? 'inline-flex items-center gap-1.5 text-xs text-emerald-400'
                            : 'inline-flex items-center gap-1.5 text-xs text-muted-foreground'
                        }
                      >
                        <span
                          className={
                            n.status === 'ACTIVE'
                              ? 'size-1.5 rounded-full bg-emerald-400'
                              : 'size-1.5 rounded-full bg-zinc-500'
                          }
                          aria-hidden
                        />
                        {n.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatDate(n.createdAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground"
                            aria-label={`Actions for ${n.number}`}
                          >
                            {deletingId === n.id ? (
                              <Loader2 className="size-4 animate-spin" aria-hidden />
                            ) : (
                              <MoreHorizontal className="size-4" aria-hidden />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => void handleDelete(n.id)}
                          >
                            <Trash2 className="size-4" aria-hidden />
                            Release number
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ImportTwilioDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agents={agents}
        onImported={() => void load()}
      />
    </div>
  );
}
