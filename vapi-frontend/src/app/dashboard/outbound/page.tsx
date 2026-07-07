'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  MoreHorizontal,
  PhoneOutgoing,
  Play,
  Plus,
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
import { CreateOutboundCampaignDialog } from '@/components/outbound/create-campaign-dialog';
import { CampaignStatusBadge } from '@/components/shared/campaign-status-badge';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Agent, PhoneNumber, VoiceCampaign } from '@/lib/types';

export default function OutboundCampaignsPage() {
  const [campaigns, setCampaigns] = useState<VoiceCampaign[] | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loading = campaigns === null && error === null;

  const load = useCallback(async () => {
    try {
      const [camps, ags, nums] = await Promise.all([
        api.voiceCampaigns.list(),
        api.agents.list(1, 100),
        api.phoneNumbers.list(),
      ]);
      setCampaigns(camps.items);
      setAgents(ags.items);
      setPhoneNumbers(nums.items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function launch(id: string) {
    setBusyId(id);
    try {
      await api.voiceCampaigns.launch(id);
      toast.success('Campaign launched');
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to launch campaign');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await api.voiceCampaigns.remove(id);
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
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Outbound campaigns
          </h2>
          <p className="text-sm text-muted-foreground">
            Upload lead lists and let an agent make automated calls.
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
              <PhoneOutgoing className="size-5 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No outbound campaigns yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Create a campaign, upload your leads, and launch automated calls.
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
                  <TableHead>Agent</TableHead>
                  <TableHead className="w-28 text-center">Leads</TableHead>
                  <TableHead className="w-40">Progress</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-32 text-right">Created</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns?.map((c) => {
                  const done = c.completedCalls + c.failedCalls;
                  const pct = c.totalLeads > 0 ? Math.round((done / c.totalLeads) * 100) : 0;
                  const canLaunch = c.status === 'DRAFT' || c.status === 'PAUSED';
                  return (
                    <TableRow key={c.id} className="border-border hover:bg-transparent">
                      <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.agent?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs text-muted-foreground">
                        {c.totalLeads}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-foreground/70"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{pct}%</span>
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
                            {canLaunch ? (
                              <DropdownMenuItem onSelect={() => void launch(c.id)}>
                                <Play className="size-4" aria-hidden />
                                Launch
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

      <CreateOutboundCampaignDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agents={agents}
        phoneNumbers={phoneNumbers}
        onCreated={() => void load()}
      />
    </div>
  );
}
