'use client';

import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
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
import { api, ApiError } from '@/lib/api';
import type { Agent } from '@/lib/types';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
  onImported: () => void;
}

const NONE = '__none__';

export function ImportTwilioDialog({ open, onOpenChange, agents, onImported }: ImportDialogProps) {
  const [number, setNumber] = useState('');
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [friendlyName, setFriendlyName] = useState('');
  const [agentId, setAgentId] = useState<string>(NONE);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setNumber('');
      setAccountSid('');
      setAuthToken('');
      setFriendlyName('');
      setAgentId(NONE);
      setError(null);
    }
  }, [open]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.phoneNumbers.import({
        number: number.trim(),
        twilioAccountSid: accountSid.trim(),
        twilioAuthToken: authToken.trim(),
        friendlyName: friendlyName.trim() || undefined,
        agentId: agentId === NONE ? undefined : agentId,
      });
      toast.success(
        result.verified
          ? 'Phone number imported and verified with Twilio'
          : 'Phone number imported (Twilio verification skipped)',
      );
      onOpenChange(false);
      onImported();
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
      <DialogContent className="border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="tracking-tight">Import a Twilio number</DialogTitle>
          <DialogDescription>
            Enter a number you own in Twilio along with your account credentials.
            We verify ownership before binding it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tw-number">Twilio phone number</Label>
            <Input
              id="tw-number"
              required
              placeholder="+14155552671"
              autoComplete="off"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">E.164 format, including the country code.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tw-sid">Twilio Account SID</Label>
            <Input
              id="tw-sid"
              required
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              autoComplete="off"
              className="font-mono text-xs"
              value={accountSid}
              onChange={(e) => setAccountSid(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tw-token">Twilio Auth Token</Label>
            <Input
              id="tw-token"
              required
              type="password"
              placeholder="Your Twilio auth token"
              autoComplete="off"
              className="font-mono text-xs"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tw-friendly">Label (optional)</Label>
              <Input
                id="tw-friendly"
                placeholder="Main line"
                value={friendlyName}
                onChange={(e) => setFriendlyName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Inbound agent (optional)</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No agent</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-xs text-muted-foreground">
              Credentials are stored to place outbound calls and are never returned
              by the API. Use a scoped API key where possible.
            </p>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Import number
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
