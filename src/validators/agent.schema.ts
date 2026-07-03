import { z } from 'zod';

const providerConfig = z.record(z.string(), z.unknown());

export const createAgentSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  systemPrompt: z.string().min(1, 'systemPrompt is required').max(20000),
  firstMessage: z.string().min(1).max(2000).optional(),

  sttProvider: z.enum(['deepgram', 'whisper']).default('deepgram'),
  llmProvider: z.enum(['openai', 'anthropic']).default('anthropic'),
  llmModel: z.string().min(1).default('claude-opus-4-8'),
  ttsProvider: z.enum(['elevenlabs', 'cartesia']).default('elevenlabs'),
  voiceId: z.string().min(1).default('21m00Tcm4TlvDq8ikWAM'),

  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(8192).default(1024),

  config: providerConfig.default({}),
  isActive: z.boolean().default(true),
});

// PUT/PATCH: every field optional but at least one must be present.
export const updateAgentSchema = createAgentSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
