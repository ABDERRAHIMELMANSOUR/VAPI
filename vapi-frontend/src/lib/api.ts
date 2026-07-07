'use client';

import type {
  Agent,
  AgentInput,
  ApiErrorBody,
  Call,
  CallStatus,
  CampaignStatusReport,
  EmailCampaign,
  EmailCampaignInput,
  EmailTemplate,
  EmailTemplateInput,
  ImportPhoneNumberInput,
  Paginated,
  PhoneNumber,
  User,
  VoiceCampaign,
  VoiceCampaignInput,
} from './types';

/**
 * Typed client for the dashboard. Every request goes to the same-origin BFF
 * proxy (/api/backend/*), which injects the JWT from the httpOnly cookie and
 * forwards to the Railway backend. The token is never exposed to this code.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Query = Record<string, string | number | boolean | undefined>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.size > 0 ? `?${params.toString()}` : '';

  const res = await fetch(`/api/backend/${path}${qs}`, {
    method: options.method ?? 'GET',
    headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  if (res.status === 401) {
    // Session expired or revoked: hand control back to the login screen.
    if (typeof window !== 'undefined') {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new ApiError(401, 'Session expired');
  }

  if (res.status === 204) {
    return undefined as T;
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    payload = undefined;
  }

  if (!res.ok) {
    const body = payload as ApiErrorBody | undefined;
    throw new ApiError(
      res.status,
      body?.error?.message ?? `Request failed (${res.status})`,
      body?.error?.code,
      body?.error?.details,
    );
  }

  return payload as T;
}

export interface ListCallsParams {
  page?: number;
  limit?: number;
  status?: CallStatus;
  agentId?: string;
  sort?: 'asc' | 'desc';
}

export const api = {
  auth: {
    me: () => request<{ user: User }>('auth/me'),
  },

  agents: {
    list: (page = 1, limit = 100) =>
      request<Paginated<Agent>>('agents', { query: { page, limit } }),
    create: (input: AgentInput) =>
      request<{ agent: Agent }>('agents', { method: 'POST', body: input }),
    update: (id: string, input: Partial<AgentInput>) =>
      request<{ agent: Agent }>(`agents/${id}`, { method: 'PUT', body: input }),
    remove: (id: string) => request<void>(`agents/${id}`, { method: 'DELETE' }),
  },

  calls: {
    list: (params: ListCallsParams = {}) =>
      request<Paginated<Call>>('calls', {
        query: {
          page: params.page,
          limit: params.limit,
          status: params.status,
          agentId: params.agentId,
          sort: params.sort,
        },
      }),
    get: (id: string) => request<{ call: Call }>(`calls/${id}`),
  },

  phoneNumbers: {
    list: (page = 1, limit = 50) =>
      request<Paginated<PhoneNumber>>('phone-numbers', { query: { page, limit } }),
    import: (input: ImportPhoneNumberInput) =>
      request<{ phoneNumber: PhoneNumber; verified: boolean }>('phone-numbers/import', {
        method: 'POST',
        body: input,
      }),
    update: (
      id: string,
      input: Partial<{ friendlyName: string | null; agentId: string | null; status: string }>,
    ) => request<{ phoneNumber: PhoneNumber }>(`phone-numbers/${id}`, { method: 'PUT', body: input }),
    remove: (id: string) => request<void>(`phone-numbers/${id}`, { method: 'DELETE' }),
  },

  voiceCampaigns: {
    list: (page = 1, limit = 50) =>
      request<Paginated<VoiceCampaign>>('voice-campaigns', { query: { page, limit } }),
    get: (id: string) => request<{ campaign: VoiceCampaign }>(`voice-campaigns/${id}`),
    create: (input: VoiceCampaignInput) =>
      request<{ campaign: VoiceCampaign }>('voice-campaigns', { method: 'POST', body: input }),
    launch: (id: string) =>
      request<{ campaign: VoiceCampaign }>(`voice-campaigns/${id}/launch`, { method: 'POST' }),
    status: (id: string) =>
      request<CampaignStatusReport>(`voice-campaigns/${id}/status`),
    remove: (id: string) => request<void>(`voice-campaigns/${id}`, { method: 'DELETE' }),
  },

  emailCampaigns: {
    list: (page = 1, limit = 50) =>
      request<Paginated<EmailCampaign>>('campaigns', { query: { page, limit } }),
    get: (id: string) => request<{ campaign: EmailCampaign }>(`campaigns/${id}`),
    create: (input: EmailCampaignInput) =>
      request<{ campaign: EmailCampaign }>('campaigns', { method: 'POST', body: input }),
    queue: (id: string) =>
      request<{ campaign: EmailCampaign }>(`campaigns/${id}/queue`, { method: 'POST' }),
    status: (id: string) => request<CampaignStatusReport>(`campaigns/${id}/status`),
    remove: (id: string) => request<void>(`campaigns/${id}`, { method: 'DELETE' }),
  },

  emailTemplates: {
    list: () => request<{ items: EmailTemplate[]; total: number }>('email-templates'),
    create: (input: EmailTemplateInput) =>
      request<{ template: EmailTemplate }>('email-templates', { method: 'POST', body: input }),
    remove: (id: string) => request<void>(`email-templates/${id}`, { method: 'DELETE' }),
  },
};
