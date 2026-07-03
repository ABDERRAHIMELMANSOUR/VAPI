import type { Server as HttpServer } from 'http';
import type { IncomingMessage } from 'http';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { createLogger } from '../utils/logger';
import { createSttStream, type SttStream } from './providers/stt';
import { synthesizeToMulawFrames } from './providers/tts';
import { llmService } from './LLMService';
import { enqueuePostCallSummary } from '../workers/postCall.worker';
import type { ChatMessage, TranscriptTurn, TwilioStreamEvent } from '../types';

const log = createLogger('VoiceOrchestrator');

/** WebSocket path Twilio Media Streams connects to (referenced by the TwiML). */
export const VOICE_STREAM_PATH = '/voice/stream';

/**
 * Per-connection state for one Twilio Media Streams call. Owns the STT stream,
 * the running LLM/TTS turn, and the transcript accumulated so far.
 */
class CallSession {
  streamSid = '';
  callSid = '';
  callId = '';
  agentId?: string;
  userId?: string;

  systemPrompt = '';
  firstMessage = '';
  llmModel?: string;
  temperature?: number;
  maxTokens?: number;
  voiceId?: string;

  readonly history: ChatMessage[] = [];
  readonly transcript: TranscriptTurn[] = [];

  stt: SttStream | null = null;

  /** True while the agent is actively streaming audio to the caller. */
  speaking = false;
  /** Aborts the in-flight TTS/LLM turn when the caller barges in. */
  private turnAbort: AbortController | null = null;
  /** Buffers interim user speech between finalized transcripts. */
  interimBuffer = '';
  startedAt = Date.now();
  closed = false;

  beginTurn(): AbortController {
    this.turnAbort = new AbortController();
    this.speaking = true;
    return this.turnAbort;
  }

  endTurn(): void {
    this.speaking = false;
    this.turnAbort = null;
  }

  interrupt(): void {
    this.turnAbort?.abort();
    this.speaking = false;
  }

  get abortSignal(): AbortSignal | undefined {
    return this.turnAbort?.signal;
  }
}

/**
 * Orchestrates the realtime voice pipeline for Twilio Media Streams:
 *   Twilio inbound audio → Deepgram STT → LLM (agent prompt) → ElevenLabs TTS →
 *   Twilio outbound audio, with barge-in interruption handling.
 */
export class VoiceOrchestrator {
  private wss: WebSocketServer | null = null;

  /** Attach the Media Streams WebSocket server to the shared HTTP server. */
  attach(server: HttpServer): void {
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (req, socket, head) => {
      const { pathname } = new URL(req.url ?? '', `http://${req.headers.host}`);
      if (pathname !== VOICE_STREAM_PATH) return; // let other WS servers handle it
      this.wss!.handleUpgrade(req, socket, head, (ws) => {
        this.wss!.emit('connection', ws, req);
      });
    });

    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    log.info(`Voice Media Streams WebSocket listening on ${VOICE_STREAM_PATH}`);
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const session = new CallSession();
    const query = new URL(req.url ?? '', `http://${req.headers.host}`).searchParams;
    log.info('Twilio Media Stream connected', { from: req.socket.remoteAddress });

    ws.on('message', (raw: RawData) => {
      let event: TwilioStreamEvent;
      try {
        event = JSON.parse(raw.toString()) as TwilioStreamEvent;
      } catch {
        return;
      }
      this.routeEvent(ws, session, event, query).catch((err) => {
        log.error('Error handling stream event', {
          event: (event as { event?: string }).event,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    });

    ws.on('close', () => {
      void this.finalizeCall(session);
    });
    ws.on('error', (err: Error) => log.error('Media stream socket error', { error: err.message }));
  }

  private async routeEvent(
    ws: WebSocket,
    session: CallSession,
    event: TwilioStreamEvent,
    query: URLSearchParams,
  ): Promise<void> {
    switch (event.event) {
      case 'connected':
        return; // protocol handshake, nothing to do
      case 'start':
        return this.onStart(ws, session, event, query);
      case 'media':
        return this.onMedia(session, event);
      case 'mark':
        return; // playback checkpoint acknowledgement
      case 'stop':
        session.closed = true;
        ws.close();
        return;
      default:
        return;
    }
  }

  // ── Call lifecycle ──────────────────────────────────────────────────────────

  private async onStart(
    ws: WebSocket,
    session: CallSession,
    event: Extract<TwilioStreamEvent, { event: 'start' }>,
    query: URLSearchParams,
  ): Promise<void> {
    session.streamSid = event.streamSid;
    session.callSid = event.start.callSid;

    const params = event.start.customParameters ?? {};
    session.agentId = params.agentId ?? query.get('agentId') ?? undefined;
    session.userId = params.userId ?? query.get('userId') ?? undefined;

    await this.loadAgentAndCall(session, params);

    // Open the STT stream; wire transcripts + VAD into the pipeline.
    session.stt = createSttStream({
      onSpeechStarted: () => this.onCallerSpeechStarted(ws, session),
      onTranscript: (result) => {
        if (!result.isFinal) {
          session.interimBuffer = result.text;
          return;
        }
        session.interimBuffer = '';
        void this.onFinalTranscript(ws, session, result.text);
      },
      onError: (err) => log.warn('STT error', { error: err.message }),
    });

    // Greet the caller with the agent's opening line.
    if (session.firstMessage) {
      this.recordTurn(session, 'assistant', session.firstMessage);
      await this.speak(ws, session, session.firstMessage);
    }
  }

  private async loadAgentAndCall(
    session: CallSession,
    params: Record<string, string>,
  ): Promise<void> {
    let agent = null;
    if (session.agentId) {
      agent = await prisma.agent.findUnique({ where: { id: session.agentId } });
    }

    if (agent) {
      session.systemPrompt = agent.systemPrompt;
      session.firstMessage = agent.firstMessage;
      session.llmModel = agent.llmModel;
      session.temperature = agent.temperature;
      session.maxTokens = agent.maxTokens;
      session.voiceId = agent.voiceId;
      session.userId = session.userId ?? agent.userId;
    } else {
      // Sensible defaults so a call still works without a configured agent.
      session.systemPrompt =
        'You are a helpful, concise voice assistant. Keep replies short and natural for speech.';
      session.firstMessage = 'Hello! Thanks for calling. How can I help you today?';
      log.warn('No agent found for call; using default assistant', {
        agentId: session.agentId,
      });
    }

    if (!session.userId) {
      log.warn('Call has no owning user; transcript will not be persisted');
      return;
    }

    // Upsert the Call row keyed on the Twilio call SID.
    const call = await prisma.call.upsert({
      where: { twilioCallSid: session.callSid },
      update: { status: 'IN_PROGRESS', streamSid: session.streamSid, startedAt: new Date() },
      create: {
        twilioCallSid: session.callSid,
        streamSid: session.streamSid,
        status: 'IN_PROGRESS',
        direction: 'INBOUND',
        fromNumber: params.from,
        toNumber: params.to,
        startedAt: new Date(),
        userId: session.userId,
        agentId: session.agentId ?? null,
      },
    });
    session.callId = call.id;
    session.startedAt = Date.now();
  }

  private async onMedia(
    session: CallSession,
    event: Extract<TwilioStreamEvent, { event: 'media' }>,
  ): Promise<void> {
    if (event.media.track && event.media.track !== 'inbound') return;
    const audio = Buffer.from(event.media.payload, 'base64');
    session.stt?.send(audio);
  }

  // ── Interruption (barge-in) ─────────────────────────────────────────────────

  private onCallerSpeechStarted(ws: WebSocket, session: CallSession): void {
    if (!session.speaking) return;
    log.debug('Barge-in detected — interrupting agent playback');
    session.interrupt();
    // Flush any audio Twilio has already buffered so the agent goes silent now.
    this.sendClear(ws, session);
  }

  // ── Turn handling: STT → LLM → TTS ──────────────────────────────────────────

  private async onFinalTranscript(
    ws: WebSocket,
    session: CallSession,
    text: string,
  ): Promise<void> {
    const userText = text.trim();
    if (userText.length === 0) return;
    log.debug('Caller said', { text: userText });
    this.recordTurn(session, 'user', userText);
    session.history.push({ role: 'user', content: userText });

    const abort = session.beginTurn();
    let assistantText = '';
    let sentenceBuffer = '';

    try {
      for await (const chunk of llmService.stream({
        systemPrompt: session.systemPrompt,
        messages: session.history,
        model: session.llmModel,
        temperature: session.temperature,
        maxTokens: session.maxTokens,
      })) {
        if (abort.signal.aborted) break;
        assistantText += chunk;
        sentenceBuffer += chunk;

        // Speak each complete sentence as soon as it's ready for low latency.
        const boundary = this.lastSentenceBoundary(sentenceBuffer);
        if (boundary > 0) {
          const sentence = sentenceBuffer.slice(0, boundary).trim();
          sentenceBuffer = sentenceBuffer.slice(boundary);
          if (sentence) await this.streamSpeech(ws, session, sentence, abort.signal);
        }
      }

      // Flush any trailing text that had no terminal punctuation.
      const tail = sentenceBuffer.trim();
      if (tail && !abort.signal.aborted) {
        await this.streamSpeech(ws, session, tail, abort.signal);
      }
    } finally {
      session.endTurn();
    }

    if (assistantText.trim() && !abort.signal.aborted) {
      this.recordTurn(session, 'assistant', assistantText.trim());
      session.history.push({ role: 'assistant', content: assistantText.trim() });
      this.sendMark(ws, session, 'assistant-turn-complete');
    }
  }

  /** Speak a whole message (used for the greeting). */
  private async speak(ws: WebSocket, session: CallSession, text: string): Promise<void> {
    const abort = session.beginTurn();
    try {
      await this.streamSpeech(ws, session, text, abort.signal);
      this.sendMark(ws, session, 'greeting-complete');
    } finally {
      session.endTurn();
    }
  }

  /** Synthesize `text` and stream the resulting mu-law frames back to Twilio. */
  private async streamSpeech(
    ws: WebSocket,
    session: CallSession,
    text: string,
    signal: AbortSignal,
  ): Promise<void> {
    for await (const frame of synthesizeToMulawFrames(text, {
      voiceId: session.voiceId,
      signal,
    })) {
      if (signal.aborted || ws.readyState !== WebSocket.OPEN) return;
      this.sendMedia(ws, session, frame);
    }
  }

  // ── Twilio outbound protocol messages ───────────────────────────────────────

  private sendMedia(ws: WebSocket, session: CallSession, base64Payload: string): void {
    ws.send(
      JSON.stringify({
        event: 'media',
        streamSid: session.streamSid,
        media: { payload: base64Payload },
      }),
    );
  }

  private sendMark(ws: WebSocket, session: CallSession, name: string): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ event: 'mark', streamSid: session.streamSid, mark: { name } }));
  }

  private sendClear(ws: WebSocket, session: CallSession): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ event: 'clear', streamSid: session.streamSid }));
  }

  // ── Persistence + post-call workflow ────────────────────────────────────────

  private recordTurn(session: CallSession, role: TranscriptTurn['role'], text: string): void {
    session.transcript.push({ role, text, at: new Date().toISOString() });
  }

  private async finalizeCall(session: CallSession): Promise<void> {
    if (session.closed && !session.callId) return;
    session.closed = true;
    session.stt?.close();

    if (!session.callId) {
      log.info('Call ended (not persisted — no user/agent context)');
      return;
    }

    const durationSec = Math.round((Date.now() - session.startedAt) / 1000);
    try {
      await prisma.call.update({
        where: { id: session.callId },
        data: {
          status: 'COMPLETED',
          endedAt: new Date(),
          durationSec,
          transcript: session.transcript as unknown as Prisma.InputJsonValue,
        },
      });
      log.info('Call completed', { callId: session.callId, durationSec });

      // Fire-and-forget: generate the AI summary and email it. The status change
      // to COMPLETED is what triggers the post-call workflow.
      await enqueuePostCallSummary(session.callId);
    } catch (err) {
      log.error('Failed to finalize call', {
        callId: session.callId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Index just past the last sentence terminator, or 0 if none present. */
  private lastSentenceBoundary(text: string): number {
    const match = /[.!?…](?=\s|$)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = match.exec(text)) !== null) last = m.index + 1;
    return last;
  }

  /**
   * Build the TwiML that tells Twilio to open a Media Stream to this server.
   * Returned by the voice webhook when a call comes in.
   */
  static buildConnectTwiml(params: {
    agentId?: string;
    userId?: string;
    from?: string;
    to?: string;
  }): string {
    const wsBase = env.PUBLIC_BASE_URL.replace(/^http/, 'ws');
    const url = `${wsBase}${VOICE_STREAM_PATH}`;
    const custom = Object.entries(params)
      .filter(([, v]) => Boolean(v))
      .map(
        ([k, v]) =>
          `      <Parameter name="${k}" value="${escapeXml(String(v))}" />`,
      )
      .join('\n');

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      '  <Connect>',
      `    <Stream url="${escapeXml(url)}">`,
      custom,
      '    </Stream>',
      '  </Connect>',
      '</Response>',
    ]
      .filter(Boolean)
      .join('\n');
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const voiceOrchestrator = new VoiceOrchestrator();
