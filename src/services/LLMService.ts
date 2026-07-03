import { providers } from '../config/providers';
import { createLogger } from '../utils/logger';
import type { ChatMessage, LLMCompletionOptions, TranscriptTurn } from '../types';

const log = createLogger('LLMService');

/**
 * Provider-agnostic LLM client supporting OpenAI and Anthropic. Exposes both a
 * buffered `complete()` and a token-`stream()` used by the voice pipeline.
 *
 * When the selected provider has no API key, it returns a deterministic local
 * response so the pipeline stays fully functional offline.
 */
export class LLMService {
  private readonly provider = providers.llm.provider;

  get configured(): boolean {
    return providers.llm.configured;
  }

  /** Buffered completion — returns the full assistant message as a string. */
  async complete(options: LLMCompletionOptions): Promise<string> {
    if (!this.configured) return this.stubResponse(options);
    try {
      if (this.provider === 'openai') return await this.completeOpenAI(options);
      return await this.completeAnthropic(options);
    } catch (err) {
      log.error('LLM completion failed, falling back to stub', {
        error: err instanceof Error ? err.message : String(err),
      });
      return this.stubResponse(options);
    }
  }

  /**
   * Streaming completion. Yields incremental text chunks as they arrive so the
   * orchestrator can begin TTS before the full response is generated. Falls back
   * to yielding the stubbed response in sentence-sized chunks when unconfigured.
   */
  async *stream(options: LLMCompletionOptions): AsyncGenerator<string, void, unknown> {
    if (!this.configured) {
      for (const chunk of this.chunk(this.stubResponse(options))) yield chunk;
      return;
    }
    try {
      const iterator =
        this.provider === 'openai'
          ? this.streamOpenAI(options)
          : this.streamAnthropic(options);
      for await (const piece of iterator) yield piece;
    } catch (err) {
      log.error('LLM stream failed, falling back to stub', {
        error: err instanceof Error ? err.message : String(err),
      });
      for (const chunk of this.chunk(this.stubResponse(options))) yield chunk;
    }
  }

  /** Produce a concise post-call summary from a transcript. */
  async summarizeTranscript(
    transcript: TranscriptTurn[],
    agentContext?: string,
  ): Promise<string> {
    const dialogue = transcript
      .filter((t) => t.role !== 'system')
      .map((t) => `${t.role === 'assistant' ? 'Agent' : 'Caller'}: ${t.text}`)
      .join('\n');

    if (dialogue.trim().length === 0) {
      return 'No conversation took place during this call.';
    }

    const systemPrompt =
      'You are an assistant that writes concise, professional post-call summaries. ' +
      'Summarize the conversation in 3-5 sentences, capturing the caller intent, key ' +
      'facts exchanged, any commitments made, and clear next steps.' +
      (agentContext ? ` Agent context: ${agentContext}` : '');

    return this.complete({
      systemPrompt,
      messages: [{ role: 'user', content: `Call transcript:\n${dialogue}` }],
      temperature: 0.3,
      maxTokens: 400,
    });
  }

  // ── OpenAI ────────────────────────────────────────────────────────────────

  private async completeOpenAI(options: LLMCompletionOptions): Promise<string> {
    const res = await fetch(`${providers.llm.openai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${providers.llm.openai.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model ?? providers.llm.openai.model,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1024,
        messages: this.toOpenAIMessages(options),
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0]?.message?.content ?? '';
  }

  private async *streamOpenAI(
    options: LLMCompletionOptions,
  ): AsyncGenerator<string, void, unknown> {
    const res = await fetch(`${providers.llm.openai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${providers.llm.openai.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model ?? providers.llm.openai.model,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1024,
        stream: true,
        messages: this.toOpenAIMessages(options),
      }),
    });
    if (!res.ok || !res.body) throw new Error(`OpenAI stream ${res.status}`);

    for await (const event of parseSSE(res.body)) {
      if (event === '[DONE]') return;
      try {
        const json = JSON.parse(event) as {
          choices: Array<{ delta?: { content?: string } }>;
        };
        const delta = json.choices[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // Ignore keep-alive / partial frames.
      }
    }
  }

  private toOpenAIMessages(options: LLMCompletionOptions): ChatMessage[] {
    return [{ role: 'system', content: options.systemPrompt }, ...options.messages];
  }

  // ── Anthropic ─────────────────────────────────────────────────────────────

  private async completeAnthropic(options: LLMCompletionOptions): Promise<string> {
    const res = await fetch(`${providers.llm.anthropic.baseUrl}/messages`, {
      method: 'POST',
      headers: this.anthropicHeaders(),
      body: JSON.stringify({
        model: options.model ?? providers.llm.anthropic.model,
        system: options.systemPrompt,
        max_tokens: options.maxTokens ?? 1024,
        temperature: options.temperature ?? 0.7,
        messages: options.messages,
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
    return data.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');
  }

  private async *streamAnthropic(
    options: LLMCompletionOptions,
  ): AsyncGenerator<string, void, unknown> {
    const res = await fetch(`${providers.llm.anthropic.baseUrl}/messages`, {
      method: 'POST',
      headers: this.anthropicHeaders(),
      body: JSON.stringify({
        model: options.model ?? providers.llm.anthropic.model,
        system: options.systemPrompt,
        max_tokens: options.maxTokens ?? 1024,
        temperature: options.temperature ?? 0.7,
        stream: true,
        messages: options.messages,
      }),
    });
    if (!res.ok || !res.body) throw new Error(`Anthropic stream ${res.status}`);

    for await (const event of parseSSE(res.body)) {
      try {
        const json = JSON.parse(event) as {
          type: string;
          delta?: { type: string; text?: string };
        };
        if (json.type === 'content_block_delta' && json.delta?.text) {
          yield json.delta.text;
        }
      } catch {
        // Ignore non-JSON SSE control frames.
      }
    }
  }

  private anthropicHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': providers.llm.anthropic.apiKey ?? '',
      'anthropic-version': providers.llm.anthropic.version,
    };
  }

  // ── Offline stub ──────────────────────────────────────────────────────────

  private stubResponse(options: LLMCompletionOptions): string {
    const lastUser = [...options.messages].reverse().find((m) => m.role === 'user');
    const userText = lastUser?.content?.trim() ?? '';
    if (userText.length === 0) {
      return "I'm here and ready to help. What can I do for you?";
    }
    if (/summary|summarize|transcript/i.test(options.systemPrompt)) {
      return (
        'Summary (offline mode): The caller and the agent exchanged messages. ' +
        'Configure an LLM API key to generate a full AI summary.'
      );
    }
    return (
      `I understand you said: "${truncate(userText, 160)}". ` +
      "I'm currently running in offline mode, but I've noted your request and " +
      'will follow up. Is there anything else I can help you with?'
    );
  }

  private chunk(text: string): string[] {
    return text.match(/[^.!?]+[.!?]?\s*/g) ?? [text];
  }
}

// ── Shared SSE parser ─────────────────────────────────────────────────────────

/** Parse a `text/event-stream` body into successive `data:` payload strings. */
async function* parseSSE(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (line.startsWith('data:')) {
          yield line.slice('data:'.length).trim();
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export const llmService = new LLMService();
