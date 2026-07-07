'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { ListUpload } from '@/components/shared/list-upload';
import { api, ApiError } from '@/lib/api';
import type { EmailTemplate } from '@/lib/types';

interface CreateEmailCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: EmailTemplate[];
  onCreated: () => void;
  onTemplatesChanged: () => void;
}

const NO_TEMPLATE = '__none__';

const DEFAULT_HTML =
  '<h1>Hello {{name}}</h1>\n<p>Thanks for being a customer. We have news to share...</p>';

export function CreateEmailCampaignDialog({
  open,
  onOpenChange,
  templates,
  onCreated,
  onTemplatesChanged,
}: CreateEmailCampaignDialogProps) {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [html, setHtml] = useState(DEFAULT_HTML);
  const [templateId, setTemplateId] = useState(NO_TEMPLATE);
  const [recipients, setRecipients] = useState<Array<{ email: string; name?: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setSubject('');
      setFromEmail('');
      setHtml(DEFAULT_HTML);
      setTemplateId(NO_TEMPLATE);
      setRecipients([]);
      setError(null);
    }
  }, [open]);

  function applyTemplate(id: string) {
    setTemplateId(id);
    if (id === NO_TEMPLATE) return;
    const tpl = templates.find((t) => t.id === id);
    if (tpl) {
      setSubject(tpl.subject);
      setHtml(tpl.html);
    }
  }

  async function saveAsTemplate() {
    if (!name.trim() || !subject.trim() || !html.trim()) {
      setError('Add a name, subject and body before saving a template.');
      return;
    }
    setSavingTemplate(true);
    try {
      await api.emailTemplates.create({ name: name.trim(), subject: subject.trim(), html });
      toast.success('Saved as template');
      onTemplatesChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  }

  async function submit(queue: boolean) {
    setError(null);
    if (!name.trim()) return setError('Give the campaign a name.');
    if (!subject.trim()) return setError('Add a subject line.');
    if (!html.trim()) return setError('Add an email body.');
    if (recipients.length === 0) return setError('Upload at least one contact with an email.');

    setSubmitting(true);
    try {
      const { campaign } = await api.emailCampaigns.create({
        name: name.trim(),
        subject: subject.trim(),
        fromEmail: fromEmail.trim() || undefined,
        html,
        recipients: recipients.map((r) => ({ email: r.email })),
      });
      if (queue) {
        await api.emailCampaigns.queue(campaign.id);
        toast.success('Campaign created and queued for sending');
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
      <DialogContent className="max-h-[88vh] overflow-y-auto border-border bg-card sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="tracking-tight">New email campaign</DialogTitle>
          <DialogDescription>
            Compose your email, upload contacts, and send a marketing blast.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(true);
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ec-name">Campaign name</Label>
              <Input
                id="ec-name"
                required
                placeholder="July newsletter"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Start from template</Label>
              <Select value={templateId} onValueChange={applyTemplate}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Blank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEMPLATE}>Blank</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ec-subject">Subject</Label>
              <Input
                id="ec-subject"
                required
                placeholder="Big news from our team"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ec-from">From (optional)</Label>
              <Input
                id="ec-from"
                type="email"
                placeholder="team@yourdomain.com"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ec-html">Email body (HTML)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => void saveAsTemplate()}
                disabled={savingTemplate}
              >
                {savingTemplate ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Save className="size-3.5" aria-hidden />
                )}
                Save as template
              </Button>
            </div>
            <Textarea
              id="ec-html"
              required
              rows={8}
              className="resize-y font-mono text-xs leading-relaxed"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
            />
          </div>

          <ListUpload
            requires="email"
            onChange={(rows) =>
              setRecipients(
                rows
                  .filter((r): r is { email: string; name?: string } => Boolean(r.email))
                  .map((r) => ({ email: r.email, name: r.name })),
              )
            }
          />

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
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Create &amp; send
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
