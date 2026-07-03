import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { getPrincipal } from '../middleware/auth';
import { param } from '../utils/http';
import { VoiceOrchestrator } from '../services/VoiceOrchestrator';
import { enqueuePostCallSummary } from '../workers/postCall.worker';
import { createLogger } from '../utils/logger';

const logger = createLogger('callController');
import type {
  CreateCallInput,
  ListCallsQuery,
  UpdateCallInput,
} from '../validators/call.schema';

/** POST /api/calls — log a call record. */
export async function createCall(req: Request, res: Response): Promise<void> {
  const { userId } = getPrincipal(req);
  const input = req.body as CreateCallInput;

  if (input.agentId) await assertAgentOwned(userId, input.agentId);
  if (input.leadId) await assertLeadOwned(userId, input.leadId);

  const call = await prisma.call.create({
    data: {
      userId,
      agentId: input.agentId ?? null,
      leadId: input.leadId ?? null,
      direction: input.direction,
      status: input.status,
      fromNumber: input.fromNumber,
      toNumber: input.toNumber,
      twilioCallSid: input.twilioCallSid,
      durationSec: input.durationSec,
      recordingUrl: input.recordingUrl,
      transcript: input.transcript as unknown as Prisma.InputJsonValue,
    },
  });

  // Logging a call directly as COMPLETED should still trigger the workflow.
  if (call.status === 'COMPLETED') await enqueuePostCallSummary(call.id);

  res.status(201).json({ call });
}

/** GET /api/calls — list the caller's calls with optional filters. */
export async function listCalls(req: Request, res: Response): Promise<void> {
  const { userId } = getPrincipal(req);
  const { status, agentId, page, limit, sort } = req.query as unknown as ListCallsQuery;

  const where: Prisma.CallWhereInput = {
    userId,
    ...(status ? { status } : {}),
    ...(agentId ? { agentId } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.call.findMany({
      where,
      orderBy: { createdAt: sort },
      skip: (page - 1) * limit,
      take: limit,
      include: { agent: { select: { id: true, name: true } } },
    }),
    prisma.call.count({ where }),
  ]);

  res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
}

/** GET /api/calls/:id — fetch one call with full transcript. */
export async function getCall(req: Request, res: Response): Promise<void> {
  const call = await findOwnedCall(req);
  res.json({ call });
}

/** PUT /api/calls/:id — update call metadata/status. */
export async function updateCall(req: Request, res: Response): Promise<void> {
  const existing = await findOwnedCall(req);
  const input = req.body as UpdateCallInput;

  if (input.leadId) {
    await assertLeadOwned(existing.userId, input.leadId);
  }

  const data: Prisma.CallUpdateInput = {};
  if (input.status !== undefined) data.status = input.status;
  if (input.durationSec !== undefined) data.durationSec = input.durationSec;
  if (input.recordingUrl !== undefined) data.recordingUrl = input.recordingUrl;
  if (input.summary !== undefined) data.summary = input.summary;
  if (input.transcript !== undefined) {
    data.transcript = input.transcript as unknown as Prisma.InputJsonValue;
  }
  if (input.leadId !== undefined) {
    data.lead = input.leadId ? { connect: { id: input.leadId } } : { disconnect: true };
  }
  // Mark completion time when transitioning into COMPLETED.
  if (input.status === 'COMPLETED' && existing.status !== 'COMPLETED') {
    data.endedAt = new Date();
  }

  const call = await prisma.call.update({ where: { id: existing.id }, data });

  // Trigger the post-call summary/email workflow on the transition to COMPLETED.
  if (input.status === 'COMPLETED' && existing.status !== 'COMPLETED') {
    await enqueuePostCallSummary(call.id);
  }

  res.json({ call });
}

/** DELETE /api/calls/:id — delete a call log. */
export async function deleteCall(req: Request, res: Response): Promise<void> {
  const call = await findOwnedCall(req);
  await prisma.call.delete({ where: { id: call.id } });
  res.status(204).send();
}

/**
 * POST /voice/incoming — public Twilio voice webhook.
 * Returns TwiML instructing Twilio to open a Media Stream to this server.
 */
export async function twilioIncomingCall(req: Request, res: Response): Promise<void> {
  // Twilio posts application/x-www-form-urlencoded; agentId is supplied via the
  // configured webhook URL query string or a form field.
  const agentId =
    (req.query.agentId as string | undefined) ??
    (req.body?.agentId as string | undefined);

  let userId: string | undefined;
  if (agentId) {
    try {
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: { userId: true, isActive: true },
      });
      if (agent && agent.isActive) userId = agent.userId;
    } catch (err) {
      // A telephony webhook must always answer with valid TwiML — never let a
      // DB hiccup drop the call. Fall back to the orchestrator's default agent.
      logger.warn('Agent lookup failed during incoming call; using default agent', {
        agentId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const twiml = VoiceOrchestrator.buildConnectTwiml({
    agentId,
    userId,
    from: (req.body?.From as string | undefined) ?? undefined,
    to: (req.body?.To as string | undefined) ?? undefined,
  });

  res.set('Content-Type', 'text/xml').send(twiml);
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function findOwnedCall(req: Request) {
  const { userId } = getPrincipal(req);
  const call = await prisma.call.findFirst({
    where: { id: param(req, 'id'), userId },
    include: { agent: { select: { id: true, name: true } }, lead: true },
  });
  if (!call) throw ApiError.notFound('Call not found');
  return call;
}

async function assertAgentOwned(userId: string, agentId: string): Promise<void> {
  const agent = await prisma.agent.findFirst({ where: { id: agentId, userId } });
  if (!agent) throw ApiError.badRequest(`Agent ${agentId} not found`);
}

async function assertLeadOwned(userId: string, leadId: string): Promise<void> {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, userId } });
  if (!lead) throw ApiError.badRequest(`Lead ${leadId} not found`);
}
