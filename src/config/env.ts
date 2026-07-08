import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Central, validated environment configuration.
 *
 * Every provider key is optional: when a key is absent the corresponding
 * service degrades to a deterministic local stub instead of throwing, so the
 * server boots and the full request/pipeline flow can be exercised without any
 * external credentials.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  CORS_ORIGIN: z.string().default('*'),

  JWT_SECRET: z.string().min(16).default('dev-insecure-secret-change-me-please'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  PUBLIC_BASE_URL: z.string().url().optional(),

  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),

  // Twilio
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // Deepgram (STT)
  DEEPGRAM_API_KEY: z.string().optional(),
  DEEPGRAM_MODEL: z.string().default('nova-2'),

  // ElevenLabs (TTS)
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().default('21m00Tcm4TlvDq8ikWAM'),
  ELEVENLABS_MODEL: z.string().default('eleven_turbo_v2'),

  // LLM
  LLM_PROVIDER: z.enum(['openai', 'anthropic']).default('anthropic'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-opus-4-8'),

  // Email.
  // EMAIL_PROVIDER = "auto" (default) picks SMTP when SMTP_* creds are present,
  // else Resend when RESEND_API_KEY is set, else the console driver. Set it
  // explicitly to force a specific driver.
  EMAIL_PROVIDER: z.enum(['auto', 'resend', 'smtp', 'console']).default('auto'),
  EMAIL_FROM: z.string().default('no-reply@voxcrm.dev'),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  // Preferred name is SMTP_PASSWORD; SMTP_PASS is accepted as a legacy alias.
  SMTP_PASSWORD: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  // Preferred sender for SMTP; falls back to EMAIL_FROM when unset.
  SMTP_FROM: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast and loud on misconfiguration — never boot with invalid env.
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`\n❌ Invalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

/**
 * Resolve the public base URL. On Railway, RAILWAY_PUBLIC_DOMAIN is injected
 * automatically for the service's public domain, so Twilio TwiML/websocket
 * URLs work with zero configuration. Explicit PUBLIC_BASE_URL always wins.
 */
const publicBaseUrl =
  parsed.data.PUBLIC_BASE_URL ??
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${parsed.data.PORT}`);

export const env = { ...parsed.data, PUBLIC_BASE_URL: publicBaseUrl };

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

export type Env = typeof env;
