import { prisma } from '../config/prisma';
import { createQueue } from '../queue/Queue';
import { llmService } from '../services/LLMService';
import { emailService } from '../services/EmailService';
import { createLogger } from '../utils/logger';
import type { TranscriptTurn } from '../types';

const log = createLogger('postCallWorker');

interface PostCallJob {
  callId: string;
}

const queue = createQueue<PostCallJob>('post-call', 3);

/**
 * Enqueue the post-call workflow for a completed call. Idempotent-friendly: the
 * processor re-checks state and skips work that's already done.
 */
export async function enqueuePostCallSummary(callId: string): Promise<string> {
  return queue.add({ callId }, { attempts: 3 });
}

/**
 * Register the worker that runs when a call completes:
 *   1. Load the call + transcript.
 *   2. Ask the LLM for a concise summary.
 *   3. Persist the summary on the call.
 *   4. Email the summary to the lead (or the owning user as fallback).
 */
export function registerPostCallWorker(): void {
  queue.process(async ({ callId }) => {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: { agent: true, user: true, lead: true },
    });

    if (!call) {
      log.warn('Post-call job skipped: call not found', { callId });
      return;
    }
    if (call.status !== 'COMPLETED') {
      log.debug('Post-call job skipped: call not completed', { callId, status: call.status });
      return;
    }
    if (call.summaryEmailed) {
      log.debug('Post-call job skipped: already summarized + emailed', { callId });
      return;
    }

    const transcript = normalizeTranscript(call.transcript);

    // 1-2. Generate the summary.
    const summary = await llmService.summarizeTranscript(
      transcript,
      call.agent ? `${call.agent.name}: ${call.agent.description ?? ''}` : undefined,
    );

    // 3. Persist it.
    await prisma.call.update({
      where: { id: call.id },
      data: { summary },
    });
    log.info('Call summary generated', { callId });

    // 4. Email it to the best available recipient.
    const recipient = call.lead?.email ?? call.user.email;
    if (!recipient) {
      log.warn('No recipient email available for call summary', { callId });
      return;
    }

    await emailService.send({
      to: recipient,
      subject: `Call summary — ${formatWhen(call.endedAt ?? call.createdAt)}`,
      html: renderSummaryEmail({
        agentName: call.agent?.name ?? 'AI Voice Agent',
        durationSec: call.durationSec ?? 0,
        summary,
        transcript,
        leadName: call.lead?.name ?? null,
      }),
    });

    await prisma.call.update({
      where: { id: call.id },
      data: { summaryEmailed: true },
    });
    log.info('Call summary emailed', { callId, recipient });
  });

  log.info('Post-call worker registered');
}

function normalizeTranscript(value: unknown): TranscriptTurn[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (t): t is TranscriptTurn =>
      Boolean(t) && typeof (t as TranscriptTurn).text === 'string',
  );
}

function renderSummaryEmail(data: {
  agentName: string;
  durationSec: number;
  summary: string;
  transcript: TranscriptTurn[];
  leadName: string | null;
}): string {
  const rows = data.transcript
    .filter((t) => t.role !== 'system')
    .map(
      (t) =>
        `<tr><td style="padding:4px 8px;font-weight:600;color:${
          t.role === 'assistant' ? '#2563eb' : '#111827'
        }">${t.role === 'assistant' ? 'Agent' : 'Caller'}</td>` +
        `<td style="padding:4px 8px">${escapeHtml(t.text)}</td></tr>`,
    )
    .join('');

  const minutes = Math.floor(data.durationSec / 60);
  const seconds = data.durationSec % 60;

  return `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827">
    <h2 style="margin-bottom:4px">Call Summary</h2>
    <p style="color:#6b7280;margin-top:0">
      ${escapeHtml(data.agentName)}${data.leadName ? ` · ${escapeHtml(data.leadName)}` : ''} ·
      Duration ${minutes}m ${seconds}s
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0;line-height:1.5">${escapeHtml(data.summary)}</p>
    </div>
    <h3 style="margin-bottom:8px">Transcript</h3>
    <table style="border-collapse:collapse;width:100%;font-size:14px">${rows}</table>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Sent automatically by VoxCRM.</p>
  </div>`;
}

function formatWhen(date: Date): string {
  return new Date(date).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
