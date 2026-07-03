import { env } from './env';

/**
 * Resolved third-party provider configuration + capability flags.
 *
 * `configured` tells services whether real credentials are present. When false,
 * the service should transparently fall back to a local stub implementation.
 */
export const providers = {
  twilio: {
    accountSid: env.TWILIO_ACCOUNT_SID,
    authToken: env.TWILIO_AUTH_TOKEN,
    phoneNumber: env.TWILIO_PHONE_NUMBER,
    get configured(): boolean {
      return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN);
    },
  },

  deepgram: {
    apiKey: env.DEEPGRAM_API_KEY,
    model: env.DEEPGRAM_MODEL,
    // Twilio Media Streams deliver 8kHz mono mu-law audio.
    encoding: 'mulaw' as const,
    sampleRate: 8000,
    baseUrl: 'wss://api.deepgram.com/v1/listen',
    get configured(): boolean {
      return Boolean(env.DEEPGRAM_API_KEY);
    },
  },

  elevenlabs: {
    apiKey: env.ELEVENLABS_API_KEY,
    voiceId: env.ELEVENLABS_VOICE_ID,
    model: env.ELEVENLABS_MODEL,
    baseUrl: 'https://api.elevenlabs.io/v1',
    // Request 8kHz mu-law so the audio is Twilio-ready without transcoding.
    outputFormat: 'ulaw_8000' as const,
    get configured(): boolean {
      return Boolean(env.ELEVENLABS_API_KEY);
    },
  },

  llm: {
    provider: env.LLM_PROVIDER,
    openai: {
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
      baseUrl: 'https://api.openai.com/v1',
    },
    anthropic: {
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.ANTHROPIC_MODEL,
      baseUrl: 'https://api.anthropic.com/v1',
      version: '2023-06-01',
    },
    get configured(): boolean {
      if (env.LLM_PROVIDER === 'openai') return Boolean(env.OPENAI_API_KEY);
      return Boolean(env.ANTHROPIC_API_KEY);
    },
  },

  email: {
    provider: env.EMAIL_PROVIDER,
    from: env.EMAIL_FROM,
    resend: {
      apiKey: env.RESEND_API_KEY,
      baseUrl: 'https://api.resend.com',
    },
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  },

  queue: {
    redisUrl: env.REDIS_URL,
    get useRedis(): boolean {
      return Boolean(env.REDIS_URL);
    },
  },
};

export type Providers = typeof providers;
