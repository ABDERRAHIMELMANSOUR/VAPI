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

export interface CallAnalysis {
  sentiment?: 'positive' | 'neutral' | 'negative';
  successEvaluation?: 'success' | 'partial' | 'unresolved';
  topics?: string[];
  keyPoints?: string[];
  actionItems?: string[];
  turnCount?: number;
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
  analysis: CallAnalysis | null;
  endedReason: string | null;
  cost: number | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  agentId: string | null;
  agent?: { id: string; name: string } | null;
  leadId: string | null;
  campaignId: string | null;
}

export type PhoneNumberStatus = 'ACTIVE' | 'INACTIVE';

export interface PhoneNumber {
  id: string;
  number: string;
  friendlyName: string | null;
  provider: string;
  status: PhoneNumberStatus;
  twilioSid: string | null;
  twilioAccountSid: string | null;
  capabilities: { voice?: boolean; sms?: boolean };
  agentId: string | null;
  agent?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportPhoneNumberInput {
  number: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  friendlyName?: string;
  agentId?: string;
}

export type CampaignStatus = 'DRAFT' | 'QUEUED' | 'SENDING' | 'SENT' | 'PAUSED' | 'FAILED';

export interface VoiceCampaignLead {
  id: string;
  phone: string;
  name: string | null;
  status: CallStatus;
  callId: string | null;
  error: string | null;
  createdAt: string;
}

export interface VoiceCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  totalLeads: number;
  completedCalls: number;
  failedCalls: number;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  agentId: string;
  agent?: { id: string; name: string } | null;
  phoneNumberId: string | null;
  phoneNumber?: { id: string; number: string } | null;
  leads?: VoiceCampaignLead[];
}

export interface VoiceCampaignInput {
  name: string;
  agentId: string;
  phoneNumberId?: string;
  leads: Array<{ phone: string; name?: string }>;
}

export interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  fromEmail: string;
  html: string;
  text: string | null;
  status: CampaignStatus;
  scheduledAt: string | null;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmailCampaignInput {
  name: string;
  subject: string;
  fromEmail?: string;
  html: string;
  text?: string;
  recipients: Array<{ email: string; leadId?: string }>;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html: string;
  text: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplateInput {
  name: string;
  subject: string;
  html: string;
  text?: string;
}

export interface CampaignStatusReport {
  id: string;
  status: CampaignStatus;
  breakdown: Record<string, number>;
  totalRecipients?: number;
  sentCount?: number;
  failedCount?: number;
  totalLeads?: number;
  completedCalls?: number;
  failedCalls?: number;
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
