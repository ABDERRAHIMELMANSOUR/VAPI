'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ListUpload } from '@/components/shared/list-upload';
import { api, ApiError } from '@/lib/api';
import { normalizePhone } from '@/lib/csv';
import type { Agent, PhoneNumber } from '@/lib/types';

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
  phoneNumbers: PhoneNumber[];
  onCreated: () => void;
}

const NONE = '__none__';

export function CreateOutboundCampaignDialog({
  open,
  onOpenChange,
  agents,
  phoneNumbers,
  onCreated,
}: CreateCampaignDialogProps) {
  const [name, setName] = useState('');
  const [agentId, setAgentId] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState(NONE);
  const [leads, setLeads] = useState<Array<{ phone: string; name?: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setAgentId(agents[0]?.id ?? '');
      setPhoneNumberId(NONE);
      setLeads([]);
      setError(null);
    }
  }, [open, agents]);

  async function submit(launch: boolean) {
    setError(null);
    if (!name.trim()) return setError('Give the campaign a name.');
    if (!agentId) return setError('Select an agent to run the calls.');
    if (leads.length === 0) return setError('Upload at least one lead with a phone number.');

    setSubmitting(true);
    try {
      const { campaign } = await api.voiceCampaigns.create({
        name: name.trim(),
        agentId,
        phoneNumberId: phoneNumberId === NONE ? undefined : phoneNumberId,
        leads: leads.map((l) => ({ phone: normalizePhone(l.phone), name: l.name })),
      });
      if (launch) {
        await api.voiceCampaigns.launch(campaign.id);
        toast.success('Campaign created and launched');
      } else {
        toast.success('Campaign saved as draft');
      }
      onOpenChange(false);
      onCreated();
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.details?.[0];
        setError(detail ? `${detail.field}: ${detail.message}` : err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-border bg-card sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="tracking-tight">New outbound campaign</DialogTitle>
          <DialogDescription>
            Pick an agent and caller ID, upload your lead list, and launch
            automated calls.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(true);
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="oc-name">Campaign name</Label>
            <Input
              id="oc-name"
              required
              placeholder="Q3 outreach"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Agent</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Caller ID</Label>
              <Select value={phoneNumberId} onValueChange={setPhoneNumberId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No caller ID</SelectItem>
                  {phoneNumbers.map((pn) => (
                    <SelectItem key={pn.id} value={pn.id}>
                      {pn.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ListUpload
            requires="phone"
            onChange={(rows) =>
              setLeads(
                rows
                  .filter((r): r is { phone: string; name?: string } => Boolean(r.phone))
                  .map((r) => ({ phone: r.phone, name: r.name })),
              )
            }
          />

          {agents.length === 0 ? (
            <p className="text-xs text-amber-400">
              Create an agent first — outbound campaigns need one to run the calls.
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void submit(false)}
              disabled={submitting}
            >
              Save draft
            </Button>
            <Button type="submit" disabled={submitting || agents.length === 0}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Launch campaign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
