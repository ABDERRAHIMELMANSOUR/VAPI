import { providers } from '../../config/providers';
import { createLogger } from '../../utils/logger';

const log = createLogger('TTS');

/** 20ms of 8kHz mu-law audio = 160 bytes; matches Twilio's frame cadence. */
const FRAME_BYTES = 160;
/** mu-law encoded digital silence. */
const MULAW_SILENCE = 0xff;

export interface SynthesizeOptions {
  voiceId?: string;
  /** Aborts the synthesis mid-stream (used for barge-in / interruption). */
  signal?: AbortSignal;
}

/**
 * Convert text to speech and yield Twilio-ready base64 mu-law frames (8kHz).
 *
 * Uses ElevenLabs streaming when configured; otherwise yields silence frames
 * sized to the utterance so downstream playback + marks still function offline.
 */
export async function* synthesizeToMulawFrames(
  text: string,
  options: SynthesizeOptions = {},
): AsyncGenerator<string, void, unknown> {
  const clean = text.trim();
  if (clean.length === 0) return;

  if (!providers.elevenlabs.configured) {
    yield* synthesizeStub(clean, options.signal);
    return;
  }

  const voiceId = options.voiceId ?? providers.elevenlabs.voiceId;
  const url =
    `${providers.elevenlabs.baseUrl}/text-to-speech/${voiceId}/stream` +
    `?output_format=${providers.elevenlabs.outputFormat}&optimize_streaming_latency=3`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': providers.elevenlabs.apiKey ?? '',
        Accept: 'audio/basic',
      },
      body: JSON.stringify({
        text: clean,
        model_id: providers.elevenlabs.model,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
      signal: options.signal,
    });
  } catch (err) {
    if (options.signal?.aborted) return;
    log.error('ElevenLabs request failed, using stub', {
      error: err instanceof Error ? err.message : String(err),
    });
    yield* synthesizeStub(clean, options.signal);
    return;
  }

  if (!res.ok || !res.body) {
    log.error(`ElevenLabs ${res.status}, using stub`);
    yield* synthesizeStub(clean, options.signal);
    return;
  }

  // Re-frame the raw mu-law byte stream into fixed 160-byte Twilio frames.
  const reader = res.body.getReader();
  let carry = Buffer.alloc(0);
  try {
    for (;;) {
      if (options.signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      carry = Buffer.concat([carry, Buffer.from(value)]);
      while (carry.length >= FRAME_BYTES) {
        if (options.signal?.aborted) return;
        const frame = carry.subarray(0, FRAME_BYTES);
        carry = carry.subarray(FRAME_BYTES);
        yield frame.toString('base64');
      }
    }
    if (carry.length > 0 && !options.signal?.aborted) {
      const padded = Buffer.alloc(FRAME_BYTES, MULAW_SILENCE);
      carry.copy(padded);
      yield padded.toString('base64');
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Offline stub: emit silence frames proportional to the utterance length
 * (~85ms per word). This produces realistic playback timing and lets Twilio
 * marks fire so turn-taking + interruption behave correctly without a TTS key.
 */
async function* synthesizeStub(
  text: string,
  signal?: AbortSignal,
): AsyncGenerator<string, void, unknown> {
  const words = text.split(/\s+/).filter(Boolean).length || 1;
  const durationMs = Math.min(15000, words * 85);
  const frameCount = Math.max(1, Math.round(durationMs / 20));
  const frame = Buffer.alloc(FRAME_BYTES, MULAW_SILENCE).toString('base64');

  for (let i = 0; i < frameCount; i += 1) {
    if (signal?.aborted) return;
    yield frame;
    // Pace frames roughly in real time so barge-in has a window to interrupt.
    if (i % 5 === 4) await delay(100, signal);
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    t.unref?.();
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    });
  });
}
