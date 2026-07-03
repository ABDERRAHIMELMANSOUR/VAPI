import { z } from 'zod';

const callStatus = z.enum([
  'QUEUED',
  'RINGING',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'NO_ANSWER',
  'CANCELED',
]);

const transcriptTurn = z.object({
  role: z.enum(['assistant', 'user', 'system']),
  text: z.string(),
  at: z.string().datetime().optional(),
});

/** Manually log a call (e.g. from an external telephony integration). */
export const createCallSchema = z.object({
  agentId: z.string().min(1).optional(),
  leadId: z.string().min(1).optional(),
  direction: z.enum(['INBOUND', 'OUTBOUND']).default('INBOUND'),
  status: callStatus.default('QUEUED'),
  fromNumber: z.string().max(40).optional(),
  toNumber: z.string().max(40).optional(),
  twilioCallSid: z.string().max(64).optional(),
  durationSec: z.number().int().min(0).optional(),
  recordingUrl: z.string().url().optional(),
  transcript: z.array(transcriptTurn).default([]),
});

export const updateCallSchema = z
  .object({
    status: callStatus.optional(),
    durationSec: z.number().int().min(0).optional(),
    recordingUrl: z.string().url().optional(),
    transcript: z.array(transcriptTurn).optional(),
    summary: z.string().max(20000).optional(),
    leadId: z.string().min(1).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

/** Query filters for listing calls. */
export const listCallsQuerySchema = z.object({
  status: callStatus.optional(),
  agentId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['asc', 'desc']).default('desc'),
});

/** Twilio inbound voice webhook payload (form-encoded, partial). */
export const twilioVoiceWebhookSchema = z.object({
  CallSid: z.string().optional(),
  From: z.string().optional(),
  To: z.string().optional(),
  agentId: z.string().optional(),
});

export type CreateCallInput = z.infer<typeof createCallSchema>;
export type UpdateCallInput = z.infer<typeof updateCallSchema>;
export type ListCallsQuery = z.infer<typeof listCallsQuerySchema>;
