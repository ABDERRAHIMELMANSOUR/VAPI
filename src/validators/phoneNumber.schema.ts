import { z } from 'zod';

// E.164: leading + and 7-15 digits.
const e164 = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, 'Must be a valid E.164 phone number, e.g. +14155552671');

/** Import a Twilio number by supplying the number + account credentials. */
export const importPhoneNumberSchema = z.object({
  number: e164,
  twilioAccountSid: z
    .string()
    .trim()
    .regex(/^AC[a-zA-Z0-9]{32}$/, 'Twilio Account SID must start with AC followed by 32 characters'),
  twilioAuthToken: z.string().trim().min(16, 'Twilio Auth Token looks too short'),
  friendlyName: z.string().max(120).optional(),
  agentId: z.string().min(1).optional(),
});

export const updatePhoneNumberSchema = z
  .object({
    friendlyName: z.string().max(120).nullable().optional(),
    agentId: z.string().min(1).nullable().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const listPhoneNumbersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sort: z.enum(['asc', 'desc']).default('desc'),
});

export type ImportPhoneNumberInput = z.infer<typeof importPhoneNumberSchema>;
export type UpdatePhoneNumberInput = z.infer<typeof updatePhoneNumberSchema>;
export type ListPhoneNumbersQuery = z.infer<typeof listPhoneNumbersQuerySchema>;
