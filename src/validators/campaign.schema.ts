import { z } from 'zod';

const recipientSchema = z.object({
  email: z.string().email(),
  leadId: z.string().min(1).optional(),
});

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(300),
  fromEmail: z.string().email().optional(),
  html: z.string().min(1, 'html body is required'),
  text: z.string().optional(),
  scheduledAt: z.coerce.date().optional(),
  // Recipients may be supplied inline as emails, or referenced by lead tag.
  recipients: z.array(recipientSchema).default([]),
  /** Optional: pull recipients from leads carrying any of these tags. */
  fromLeadTags: z.array(z.string().min(1)).optional(),
});

export const updateCampaignSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    subject: z.string().min(1).max(300).optional(),
    fromEmail: z.string().email().optional(),
    html: z.string().min(1).optional(),
    text: z.string().optional(),
    scheduledAt: z.coerce.date().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const listCampaignsQuerySchema = z.object({
  status: z
    .enum(['DRAFT', 'QUEUED', 'SENDING', 'SENT', 'PAUSED', 'FAILED'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type ListCampaignsQuery = z.infer<typeof listCampaignsQuerySchema>;
