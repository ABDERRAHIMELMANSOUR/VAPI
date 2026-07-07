import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { getPrincipal } from '../middleware/auth';
import { param } from '../utils/http';
import { enqueueVoiceCampaign } from '../workers/outboundCampaign.worker';
import type {
  AddLeadsInput,
  CreateVoiceCampaignInput,
  ListVoiceCampaignsQuery,
  UpdateVoiceCampaignInput,
} from '../validators/voiceCampaign.schema';

/** POST /api/voice-campaigns — create a draft outbound campaign with leads. */
export async function createVoiceCampaign(req: Request, res: Response): Promise<void> {
  const { userId } = getPrincipal(req);
  const input = req.body as CreateVoiceCampaignInput;

  await assertAgentOwned(userId, input.agentId);
  if (input.phoneNumberId) await assertPhoneOwned(userId, input.phoneNumberId);

  const leads = dedupeLeads(input.leads);

  const campaign = await prisma.voiceCampaign.create({
    data: {
      userId,
      name: input.name,
      agentId: input.agentId,
      phoneNumberId: input.phoneNumberId ?? null,
      scheduledAt: input.scheduledAt,
      status: 'DRAFT',
      totalLeads: leads.length,
      leads: {
        create: leads.map((l) => ({
          phone: l.phone,
          name: l.name,
          metadata: (l.metadata ?? {}) as Prisma.InputJsonValue,
          status: 'QUEUED',
        })),
      },
    },
    include: {
      agent: { select: { id: true, name: true } },
      phoneNumber: { select: { id: true, number: true } },
      _count: { select: { leads: true } },
    },
  });

  res.status(201).json({ campaign });
}

/** GET /api/voice-campaigns — list outbound campaigns. */
export async function listVoiceCampaigns(req: Request, res: Response): Promise<void> {
  const { userId } = getPrincipal(req);
  const { status, page, limit, sort } = req.query as unknown as ListVoiceCampaignsQuery;

  const where: Prisma.VoiceCampaignWhereInput = {
    userId,
    ...(status ? { status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.voiceCampaign.findMany({
      where,
      orderBy: { createdAt: sort },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        agent: { select: { id: true, name: true } },
        phoneNumber: { select: { id: true, number: true } },
      },
    }),
    prisma.voiceCampaign.count({ where }),
  ]);

  res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
}

/** GET /api/voice-campaigns/:id — fetch a campaign with recent leads. */
export async function getVoiceCampaign(req: Request, res: Response): Promise<void> {
  const { userId } = getPrincipal(req);
  const campaign = await prisma.voiceCampaign.findFirst({
    where: { id: param(req, 'id'), userId },
    include: {
      agent: { select: { id: true, name: true } },
      phoneNumber: { select: { id: true, number: true } },
      leads: { orderBy: { createdAt: 'asc' }, take: 500 },
    },
  });
  if (!campaign) throw ApiError.notFound('Campaign not found');
  res.json({ campaign });
}

/** PUT /api/voice-campaigns/:id — edit a campaign before it starts sending. */
export async function updateVoiceCampaign(req: Request, res: Response): Promise<void> {
  const { userId } = getPrincipal(req);
  const existing = await findOwned(userId, param(req, 'id'));
  if (existing.status === 'SENDING' || existing.status === 'SENT') {
    throw ApiError.conflict(`Cannot edit a campaign that is ${existing.status}`);
  }
  const input = req.body as UpdateVoiceCampaignInput;

  if (input.agentId) await assertAgentOwned(userId, input.agentId);
  if (input.phoneNumberId) await assertPhoneOwned(userId, input.phoneNumberId);

  const data: Prisma.VoiceCampaignUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.scheduledAt !== undefined) data.scheduledAt = input.scheduledAt;
  if (input.agentId !== undefined) data.agent = { connect: { id: input.agentId } };
  if (input.phoneNumberId !== undefined) {
    data.phoneNumber = input.phoneNumberId
      ? { connect: { id: input.phoneNumberId } }
      : { disconnect: true };
  }

  const campaign = await prisma.voiceCampaign.update({
    where: { id: existing.id },
    data,
    include: {
      agent: { select: { id: true, name: true } },
      phoneNumber: { select: { id: true, number: true } },
    },
  });
  res.json({ campaign });
}

/** POST /api/voice-campaigns/:id/leads — append more leads. */
export async function addLeads(req: Request, res: Response): Promise<void> {
  const { userId } = getPrincipal(req);
  const existing = await findOwned(userId, param(req, 'id'));
  const input = req.body as AddLeadsInput;
  const leads = dedupeLeads(input.leads);

  await prisma.voiceCampaignLead.createMany({
    data: leads.map((l) => ({
      campaignId: existing.id,
      phone: l.phone,
      name: l.name,
      metadata: (l.metadata ?? {}) as Prisma.InputJsonValue,
      status: 'QUEUED' as const,
    })),
  });

  const total = await prisma.voiceCampaignLead.count({ where: { campaignId: existing.id } });
  const campaign = await prisma.voiceCampaign.update({
    where: { id: existing.id },
    data: { totalLeads: total },
  });

  res.status(201).json({ campaign, added: leads.length });
}

/** POST /api/voice-campaigns/:id/launch — queue the campaign for dialing. */
export async function launchVoiceCampaign(req: Request, res: Response): Promise<void> {
  const { userId } = getPrincipal(req);
  const existing = await findOwned(userId, param(req, 'id'));

  if (existing.status === 'SENDING') throw ApiError.conflict('Campaign is already running');
  if (existing.totalLeads === 0) throw ApiError.badRequest('Campaign has no leads to call');

  const campaign = await prisma.voiceCampaign.update({
    where: { id: existing.id },
    data: { status: 'QUEUED' },
  });

  const jobId = await enqueueVoiceCampaign(campaign.id);
  res.status(202).json({ campaign, job: { id: jobId } });
}

/** GET /api/voice-campaigns/:id/status — progress + per-lead status breakdown. */
export async function getVoiceCampaignStatus(req: Request, res: Response): Promise<void> {
  const { userId } = getPrincipal(req);
  const campaign = await findOwned(userId, param(req, 'id'));

  const grouped = await prisma.voiceCampaignLead.groupBy({
    by: ['status'],
    where: { campaignId: campaign.id },
    _count: { _all: true },
  });
  const breakdown = grouped.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row._count._all;
    return acc;
  }, {});

  res.json({
    id: campaign.id,
    status: campaign.status,
    totalLeads: campaign.totalLeads,
    completedCalls: campaign.completedCalls,
    failedCalls: campaign.failedCalls,
    breakdown,
  });
}

/** DELETE /api/voice-campaigns/:id — delete a campaign and its leads. */
export async function deleteVoiceCampaign(req: Request, res: Response): Promise<void> {
  const { userId } = getPrincipal(req);
  const campaign = await findOwned(userId, param(req, 'id'));
  if (campaign.status === 'SENDING') {
    throw ApiError.conflict('Cannot delete a campaign while it is running');
  }
  await prisma.voiceCampaign.delete({ where: { id: campaign.id } });
  res.status(204).send();
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function findOwned(userId: string, id: string) {
  const campaign = await prisma.voiceCampaign.findFirst({ where: { id, userId } });
  if (!campaign) throw ApiError.notFound('Campaign not found');
  return campaign;
}

async function assertAgentOwned(userId: string, agentId: string): Promise<void> {
  const agent = await prisma.agent.findFirst({ where: { id: agentId, userId }, select: { id: true } });
  if (!agent) throw ApiError.badRequest(`Agent ${agentId} not found`);
}

async function assertPhoneOwned(userId: string, phoneNumberId: string): Promise<void> {
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, userId },
    select: { id: true },
  });
  if (!phone) throw ApiError.badRequest(`Phone number ${phoneNumberId} not found`);
}

function dedupeLeads<T extends { phone: string }>(leads: T[]): T[] {
  const byPhone = new Map<string, T>();
  for (const lead of leads) {
    const key = lead.phone.replace(/[^\d+]/g, '');
    if (!byPhone.has(key)) byPhone.set(key, lead);
  }
  return [...byPhone.values()];
}
