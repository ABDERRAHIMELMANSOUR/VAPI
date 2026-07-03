/**
 * Domain types mirroring the VoxCRM backend API contracts.
 */

export type CallStatus =
  | 'QUEUED'
  | 'RINGING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'NO_ANSWER'
  | 'CANCELED';

export type CallDirection = 'INBOUND' | 'OUTBOUND';

export type LlmProvider = 'openai' | 'anthropic';

export interface User {
  id: string;
  email: string;
  name?: string | null;
  createdAt?: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  firstMessage: string;
  sttProvider: string;
  llmProvider: string;
  llmModel: string;
  ttsProvider: string;
  voiceId: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface AgentInput {
  name: string;
  description?: string;
  systemPrompt: string;
  firstMessage?: string;
  llmProvider?: LlmProvider;
  llmModel?: string;
  voiceId?: string;
  temperature?: number;
  maxTokens?: number;
  isActive?: boolean;
}

export interface TranscriptTurn {
  role: 'assistant' | 'user' | 'system';
  text: string;
  at?: string;
}

export interface Call {
  id: string;
  direction: CallDirection;
  status: CallStatus;
  fromNumber: string | null;
  toNumber: string | null;
  twilioCallSid: string | null;
  durationSec: number | null;
  recordingUrl: string | null;
  transcript: TranscriptTurn[];
  summary: string | null;
  summaryEmailed: boolean;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  agentId: string | null;
  agent?: { id: string; name: string } | null;
  leadId: string | null;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Error envelope returned by the backend. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}
