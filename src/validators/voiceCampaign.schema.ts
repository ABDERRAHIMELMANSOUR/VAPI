import { z } from 'zod';

const e164Loose = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{6,14}$/, 'Each lead phone must be a valid phone number');

const leadSchema = z.object({
  phone: e164Loose,
  name: z.string().max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createVoiceCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  agentId: z.string().min(1, 'An agent is required'),
  phoneNumberId: z.string().min(1).optional(),
  scheduledAt: z.coerce.date().optional(),
  leads: z.array(leadSchema).default([]),
});

export const updateVoiceCampaignSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    agentId: z.string().min(1).optional(),
    phoneNumberId: z.string().min(1).nullable().optional(),
    scheduledAt: z.coerce.date().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

/** Append leads to an existing campaign (e.g. a second CSV upload). */
export const addLeadsSchema = z.object({
  leads: z.array(leadSchema).min(1, 'Provide at least one lead'),
});

export const listVoiceCampaignsQuerySchema = z.object({
  status: z
    .enum(['DRAFT', 'QUEUED', 'SENDING', 'SENT', 'PAUSED', 'FAILED'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateVoiceCampaignInput = z.infer<typeof createVoiceCampaignSchema>;
export type UpdateVoiceCampaignInput = z.infer<typeof updateVoiceCampaignSchema>;
export type AddLeadsInput = z.infer<typeof addLeadsSchema>;
export type ListVoiceCampaignsQuery = z.infer<typeof listVoiceCampaignsQuerySchema>;
