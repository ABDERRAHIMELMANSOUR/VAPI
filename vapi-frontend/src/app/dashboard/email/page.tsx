'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  Mail,
  MoreHorizontal,
  Plus,
  Send,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
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
import { CreateEmailCampaignDialog } from '@/components/email/create-campaign-dialog';
import { CampaignStatusBadge } from '@/components/shared/campaign-status-badge';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { EmailCampaign, EmailTemplate } from '@/lib/types';

export default function EmailCampaignsPage() {
  const [campaigns, setCampaigns] = useState<EmailCampaign[] | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loading = campaigns === null && error === null;

  const loadTemplates = useCallback(async () => {
    try {
      const res = await api.emailTemplates.list();
      setTemplates(res.items);
    } catch {
      // Templates are non-critical; ignore failures here.
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const camps = await api.emailCampaigns.list();
      setCampaigns(camps.items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    }
  }, []);

  useEffect(() => {
    void load();
    void loadTemplates();
  }, [load, loadTemplates]);

  async function queue(id: string) {
    setBusyId(id);
    try {
      await api.emailCampaigns.queue(id);
      toast.success('Campaign queued for sending');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to queue campaign');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await api.emailCampaigns.remove(id);
      toast.success('Campaign deleted');
      setCampaigns((prev) => prev?.filter((c) => c.id !== id) ?? prev);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete campaign');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Email campaigns</h2>
          <p className="text-sm text-muted-foreground">
            Compose templates, upload contacts, and track delivery.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" aria-hidden />
          New campaign
        </Button>
      </div>

      {error ? (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {error}
        </div>
      ) : loading ? (
        <Skeleton className="h-64 w-full" />
      ) : campaigns && campaigns.length === 0 ? (
        <Card className="border-dashed border-border bg-transparent">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-10 items-center justify-center rounded-md border border-border bg-card">
              <Mail className="size-5 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No email campaigns yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Create a campaign, upload your contact list, and send a marketing
                blast.
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)} variant="secondary" size="sm">
              <Plus className="size-4" aria-hidden />
              New campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-card py-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Campaign</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="w-40">Delivery</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-32 text-right">Created</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns?.map((c) => {
                  const pct =
                    c.totalRecipients > 0
                      ? Math.round(((c.sentCount + c.failedCount) / c.totalRecipients) * 100)
                      : 0;
                  const canSend = c.status === 'DRAFT' || c.status === 'PAUSED';
                  return (
                    <TableRow key={c.id} className="border-border hover:bg-transparent">
                      <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                      <TableCell className="max-w-56 truncate text-sm text-muted-foreground">
                        {c.subject}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-foreground/70"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {c.sentCount}/{c.totalRecipients}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <CampaignStatusBadge status={c.status} />
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatDate(c.createdAt)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground"
                              aria-label={`Actions for ${c.name}`}
                            >
                              {busyId === c.id ? (
                                <Loader2 className="size-4 animate-spin" aria-hidden />
                              ) : (
                                <MoreHorizontal className="size-4" aria-hidden />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canSend ? (
                              <DropdownMenuItem onSelect={() => void queue(c.id)}>
                                <Send className="size-4" aria-hidden />
                                Send now
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem variant="destructive" onSelect={() => void remove(c.id)}>
                              <Trash2 className="size-4" aria-hidden />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <CreateEmailCampaignDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        templates={templates}
        onCreated={() => void load()}
        onTemplatesChanged={() => void loadTemplates()}
      />
    </div>
  );
}
