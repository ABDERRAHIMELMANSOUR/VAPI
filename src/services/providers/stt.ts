import WebSocket from 'ws';
import { providers } from '../../config/providers';
import { createLogger } from '../../utils/logger';
import type { TranscriptionResult } from '../../types';

const log = createLogger('STT');

export interface SttStreamHandlers {
  /** Fired for both interim and final transcripts. */
  onTranscript: (result: TranscriptionResult) => void;
  /** Fired when the STT engine detects the caller has started speaking (VAD). */
  onSpeechStarted?: () => void;
  onError?: (err: Error) => void;
}

/** A live speech-to-text stream fed with raw decoded mu-law audio frames. */
export interface SttStream {
  /** Push a chunk of raw (decoded) 8kHz mu-law audio. */
  send(audio: Buffer): void;
  /** Signal end-of-audio and close the upstream connection. */
  close(): void;
}

/**
 * Open a Deepgram realtime transcription stream. When DEEPGRAM_API_KEY is not
 * configured, returns a stub stream that simulates a single caller utterance so
 * the rest of the pipeline can be exercised offline.
 */
export function createSttStream(handlers: SttStreamHandlers): SttStream {
  if (!providers.deepgram.configured) {
    return createStubSttStream(handlers);
  }
  return createDeepgramSttStream(handlers);
}

function createDeepgramSttStream(handlers: SttStreamHandlers): SttStream {
  const params = new URLSearchParams({
    encoding: providers.deepgram.encoding,
    sample_rate: String(providers.deepgram.sampleRate),
    model: providers.deepgram.model,
    channels: '1',
    interim_results: 'true',
    punctuate: 'true',
    smart_format: 'true',
    endpointing: '300',
    vad_events: 'true',
  });
  const url = `${providers.deepgram.baseUrl}?${params.toString()}`;

  const ws = new WebSocket(url, {
    headers: { Authorization: `Token ${providers.deepgram.apiKey}` },
  });

  const backlog: Buffer[] = [];
  let open = false;

  ws.on('open', () => {
    open = true;
    for (const chunk of backlog) ws.send(chunk);
    backlog.length = 0;
    log.debug('Deepgram stream open');
  });

  ws.on('message', (raw: WebSocket.RawData) => {
    try {
      const msg = JSON.parse(raw.toString()) as {
        type?: string;
        is_final?: boolean;
        speech_final?: boolean;
        channel?: { alternatives?: Array<{ transcript?: string }> };
      };
      if (msg.type === 'SpeechStarted') {
        handlers.onSpeechStarted?.();
        return;
      }
      const transcript = msg.channel?.alternatives?.[0]?.transcript ?? '';
      if (transcript.trim().length === 0) return;
      handlers.onTranscript({
        text: transcript,
        isFinal: Boolean(msg.is_final || msg.speech_final),
      });
    } catch (err) {
      log.warn('Failed to parse Deepgram message', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  ws.on('error', (err: Error) => {
    log.error('Deepgram stream error', { error: err.message });
    handlers.onError?.(err);
  });

  return {
    send(audio: Buffer): void {
      if (open && ws.readyState === WebSocket.OPEN) ws.send(audio);
      else backlog.push(audio);
    },
    close(): void {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          // Deepgram closes gracefully on this control message.
          ws.send(JSON.stringify({ type: 'CloseStream' }));
        }
        ws.close();
      } catch {
        /* already closed */
      }
    },
  };
}

/**
 * Offline stub. Cannot transcribe real audio, so it simulates the caller saying
 * one line ~1.5s after audio begins, letting the STT→LLM→TTS loop run without
 * credentials. Emits a VAD "speech started" first so barge-in logic is exercised.
 */
function createStubSttStream(handlers: SttStreamHandlers): SttStream {
  log.warn('DEEPGRAM_API_KEY missing — using simulated STT stub');
  let fired = false;
  let timer: NodeJS.Timeout | null = null;

  return {
    send(): void {
      if (fired) return;
      fired = true;
      timer = setTimeout(() => {
        handlers.onSpeechStarted?.();
        handlers.onTranscript({
          text: "Hi, I'd like to learn more about what you offer.",
          isFinal: true,
        });
      }, 1500);
      timer.unref?.();
    },
    close(): void {
      if (timer) clearTimeout(timer);
    },
  };
}
