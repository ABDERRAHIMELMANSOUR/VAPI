'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Bot,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { AgentDialog } from '@/components/agents/agent-dialog';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Agent } from '@/lib/types';

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);

  const [deleting, setDeleting] = useState<Agent | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loading = agents === null && error === null;

  const load = useCallback(async () => {
    try {
      const result = await api.agents.list(1, 100);
      setAgents(result.items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(agent: Agent) {
    setEditing(agent);
    setDialogOpen(true);
  }

  async function toggleActive(agent: Agent, isActive: boolean) {
    // Optimistic flip with rollback on failure.
    setAgents((prev) =>
      prev?.map((a) => (a.id === agent.id ? { ...a, isActive } : a)) ?? prev,
    );
    try {
      await api.agents.update(agent.id, { isActive });
    } catch (err) {
      setAgents((prev) =>
        prev?.map((a) => (a.id === agent.id ? { ...a, isActive: !isActive } : a)) ?? prev,
      );
      toast.error(err instanceof ApiError ? err.message : 'Failed to update agent');
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.agents.remove(deleting.id);
      toast.success('Agent deleted');
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete agent');
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Voice agents
          </h2>
          <p className="text-sm text-muted-foreground">
            Prompts, models and voices for your AI assistants.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          New agent
        </Button>
      </div>

      {error ? (
        <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {error}
        </div>
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : agents && agents.length === 0 ? (
        <Card className="border-dashed border-border bg-transparent">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-10 items-center justify-center rounded-md border border-border bg-card">
              <Bot className="size-5 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No agents yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Create your first voice agent to start answering calls with AI.
              </p>
            </div>
            <Button onClick={openCreate} variant="secondary" size="sm">
              <Plus className="size-4" aria-hidden />
              Create agent
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents?.map((agent) => (
            <Card key={agent.id} className="border-border bg-card">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div className="min-w-0">
                  <CardTitle className="truncate text-base font-semibold tracking-tight">
                    {agent.name}
                  </CardTitle>
                  <CardDescription className="mt-1 line-clamp-2">
                    {agent.description || 'No description'}
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground"
                      aria-label={`Actions for ${agent.name}`}
                    >
                      <MoreHorizontal className="size-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => openEdit(agent)}>
                      <Pencil className="size-4" aria-hidden />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setDeleting(agent)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="line-clamp-3 rounded-md border border-border bg-background px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
                  {agent.systemPrompt}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="border-border font-normal text-muted-foreground">
                    {agent.llmModel}
                  </Badge>
                  <Badge variant="outline" className="border-border font-normal text-muted-foreground">
                    {agent.ttsProvider}
                  </Badge>
                  <Badge variant="outline" className="border-border font-mono text-[11px] font-normal text-muted-foreground">
                    temp {agent.temperature}
                  </Badge>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">
                    Updated {formatDate(agent.updatedAt)}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {agent.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <Switch
                      checked={agent.isActive}
                      onCheckedChange={(checked) => void toggleActive(agent, checked)}
                      aria-label={`Toggle ${agent.name}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AgentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agent={editing}
        onSaved={() => void load()}
      />

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="tracking-tight">Delete agent</DialogTitle>
            <DialogDescription>
              This permanently removes{' '}
              <span className="font-medium text-foreground">{deleting?.name}</span>.
              Existing call logs are kept, but they will no longer reference this
              agent.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)} disabled={deleteBusy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleteBusy}>
              {deleteBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
