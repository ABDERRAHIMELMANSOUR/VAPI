/**
 * Shared domain types used across services, controllers and workers.
 * DB row shapes come from the generated Prisma client; these types describe
 * the in-memory / transport structures the app builds around them.
 */

/** A single turn in a call transcript, stored as JSON on Call.transcript. */
export interface TranscriptTurn {
  role: 'assistant' | 'user' | 'system';
  text: string;
  /** ISO timestamp of when the turn was finalized. */
  at: string;
}

/** Chat message passed to an LLM provider. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionOptions {
  systemPrompt: string;
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/** Streaming text chunk emitted by the LLM provider. */
export interface LLMStreamChunk {
  text: string;
  done: boolean;
}

/** Result of a speech-to-text transcription event. */
export interface TranscriptionResult {
  text: string;
  /** Whether the STT engine considers this a finalized (non-interim) result. */
  isFinal: boolean;
}

/** An outbound email message. */
export interface EmailMessage {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailSendResult {
  id: string;
  provider: string;
  accepted: boolean;
}

/** Authenticated principal attached to the request by the auth middleware. */
export interface AuthPrincipal {
  userId: string;
  email?: string;
}

/** Normalized inbound Twilio Media Streams websocket message. */
export type TwilioStreamEvent =
  | { event: 'connected'; protocol: string; version: string }
  | {
      event: 'start';
      streamSid: string;
      start: {
        streamSid: string;
        callSid: string;
        customParameters?: Record<string, string>;
        mediaFormat: { encoding: string; sampleRate: number; channels: number };
      };
    }
  | {
      event: 'media';
      streamSid: string;
      media: { track: string; chunk: string; timestamp: string; payload: string };
    }
  | { event: 'mark'; streamSid: string; mark: { name: string } }
  | { event: 'stop'; streamSid: string; stop: { callSid: string } };
