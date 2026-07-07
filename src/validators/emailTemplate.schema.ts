import { z } from 'zod';

export const createEmailTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(300),
  html: z.string().min(1, 'Template body is required'),
  text: z.string().optional(),
});

export const updateEmailTemplateSchema = createEmailTemplateSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type CreateEmailTemplateInput = z.infer<typeof createEmailTemplateSchema>;
export type UpdateEmailTemplateInput = z.infer<typeof updateEmailTemplateSchema>;
