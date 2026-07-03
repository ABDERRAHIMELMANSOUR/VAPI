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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { api, ApiError } from '@/lib/api';
import type { Agent, AgentInput, LlmProvider } from '@/lib/types';

const MODEL_PRESETS: Record<LlmProvider, string[]> = {
  anthropic: ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini'],
};

const VOICE_PRESETS: Array<{ id: string; label: string }> = [
  { id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel (ElevenLabs)' },
  { id: 'pNInz6obpgDQGcFmaJgB', label: 'Adam (ElevenLabs)' },
  { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Bella (ElevenLabs)' },
];

interface FormState {
  name: string;
  description: string;
  systemPrompt: string;
  firstMessage: string;
  llmProvider: LlmProvider;
  llmModel: string;
  voiceId: string;
  temperature: string;
  maxTokens: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  systemPrompt: '',
  firstMessage: 'Hello! How can I help you today?',
  llmProvider: 'anthropic',
  llmModel: 'claude-opus-4-8',
  voiceId: VOICE_PRESETS[0].id,
  temperature: '0.7',
  maxTokens: '1024',
  isActive: true,
};

function formFromAgent(agent: Agent): FormState {
  return {
    name: agent.name,
    description: agent.description ?? '',
    systemPrompt: agent.systemPrompt,
    firstMessage: agent.firstMessage,
    llmProvider: (agent.llmProvider as LlmProvider) || 'anthropic',
    llmModel: agent.llmModel,
    voiceId: agent.voiceId,
    temperature: String(agent.temperature),
    maxTokens: String(agent.maxTokens),
    isActive: agent.isActive,
  };
}

interface AgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided the dialog edits this agent; otherwise it creates one. */
  agent: Agent | null;
  onSaved: () => void;
}

export function AgentDialog({ open, onOpenChange, agent, onSaved }: AgentDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(agent ? formFromAgent(agent) : EMPTY_FORM);
      setError(null);
    }
  }, [open, agent]);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const temperature = Number(form.temperature);
    const maxTokens = Number(form.maxTokens);
    if (Number.isNaN(temperature) || temperature < 0 || temperature > 2) {
      setError('Temperature must be a number between 0 and 2.');
      return;
    }
    if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 8192) {
      setError('Max tokens must be an integer between 1 and 8192.');
      return;
    }

    const input: AgentInput = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      systemPrompt: form.systemPrompt.trim(),
      firstMessage: form.firstMessage.trim() || undefined,
      llmProvider: form.llmProvider,
      llmModel: form.llmModel.trim(),
      voiceId: form.voiceId.trim(),
      temperature,
      maxTokens,
      isActive: form.isActive,
    };

    setSubmitting(true);
    try {
      if (agent) {
        await api.agents.update(agent.id, input);
        toast.success('Agent updated');
      } else {
        await api.agents.create(input);
        toast.success('Agent created');
      }
      onOpenChange(false);
      onSaved();
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
      <DialogContent className="max-h-[85vh] overflow-y-auto border-border bg-card sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="tracking-tight">
            {agent ? 'Edit agent' : 'New agent'}
          </DialogTitle>
          <DialogDescription>
            {agent
              ? 'Update the prompt, model and voice configuration.'
              : 'Configure the prompt, model and voice for a new voice agent.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Name</Label>
              <Input
                id="agent-name"
                required
                maxLength={120}
                placeholder="Support Assistant"
                value={form.name}
                onChange={(e) => patch('name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-description">Description</Label>
              <Input
                id="agent-description"
                placeholder="Handles inbound support calls"
                value={form.description}
                onChange={(e) => patch('description', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-prompt">System prompt</Label>
            <Textarea
              id="agent-prompt"
              required
              rows={6}
              placeholder="You are a helpful, concise voice assistant for Acme Inc..."
              className="resize-y font-mono text-xs leading-relaxed"
              value={form.systemPrompt}
              onChange={(e) => patch('systemPrompt', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Defines the agent&apos;s persona and rules. Sent as the system
              message on every turn.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-first-message">First message</Label>
            <Input
              id="agent-first-message"
              placeholder="Hello! How can I help you today?"
              value={form.firstMessage}
              onChange={(e) => patch('firstMessage', e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={form.llmProvider}
                onValueChange={(value) => {
                  const provider = value as LlmProvider;
                  patch('llmProvider', provider);
                  patch('llmModel', MODEL_PRESETS[provider][0]);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Select
                value={form.llmModel}
                onValueChange={(value) => patch('llmModel', value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_PRESETS[form.llmProvider].map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Voice</Label>
              <Select
                value={form.voiceId}
                onValueChange={(value) => patch('voiceId', value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select voice" />
                </SelectTrigger>
                <SelectContent>
                  {VOICE_PRESETS.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.label}
                    </SelectItem>
                  ))}
                  {!VOICE_PRESETS.some((v) => v.id === form.voiceId) ? (
                    <SelectItem value={form.voiceId}>{form.voiceId}</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agent-temperature">Temperature</Label>
                <Input
                  id="agent-temperature"
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={form.temperature}
                  onChange={(e) => patch('temperature', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-max-tokens">Max tokens</Label>
                <Input
                  id="agent-max-tokens"
                  type="number"
                  min={1}
                  max={8192}
                  step={1}
                  value={form.maxTokens}
                  onChange={(e) => patch('maxTokens', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-foreground">Active</p>
              <p className="text-xs text-muted-foreground">
                Inactive agents stop answering new calls.
              </p>
            </div>
            <Switch
              checked={form.isActive}
              onCheckedChange={(checked) => patch('isActive', checked)}
              aria-label="Toggle agent active state"
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {agent ? 'Save changes' : 'Create agent'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
