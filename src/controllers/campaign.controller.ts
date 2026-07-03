import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { getPrincipal } from '../middleware/auth';
import { param } from '../utils/http';
import { providers } from '../config/providers';
import { enqueueCampaign } from '../workers/campaign.worker';
import type {
  CreateCampaignInput,
  ListCampaignsQuery,
  UpdateCampaignInput,
} from '../validators/campaign.schema';

/** POST /api/campaigns — create a draft campaign with its recipient list. */
export async function createCampaign(req: Request, res: Response): Promise<void> {
  const { userId } = getPrincipal(req);
  const input = req.body as CreateCampaignInput;

  const recipients = await resolveRecipients(userId, input);
  if (recipients.length === 0) {
    throw ApiError.badRequest(
      'A campaign needs at least one recipient (via `recipients` or `fromLeadTags`)',
    );
  }

  const campaign = await prisma.emailCampaign.create({
    data: {
      userId,
      name: input.name,
      subject: input.subject,
      fromEmail: input.fromEmail ?? providers.email.from,
      html: input.html,
      text: input.text,
      scheduledAt: input.scheduledAt,
      status: 'DRAFT',
      totalRecipients: recipients.length,
      recipients: {
        create: recipients.map((r) => ({
          email: r.email,
          leadId: r.leadId ?? null,
          status: 'PENDING',
        })),
      },
    },
    include: { _count: { select: { recipients: true } } },
  });

  res.status(201).json({ campaign });
}

/** GET /api/campaigns — list the caller's campaigns. */
export async function listCampaigns(req: Request, res: Response): Promise<void> {
  const { userId } = getPrincipal(req);
  const { status, page, limit, sort } = req.query as unknown as ListCampaignsQuery;

  const where: Prisma.EmailCampaignWhereInput = {
    userId,
    ...(status ? { status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.emailCampaign.findMany({
      where,
      orderBy: { createdAt: sort },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.emailCampaign.count({ where }),
  ]);

  res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
}

/** GET /api/campaigns/:id — fetch a campaign. */
export async function getCampaign(req: Request, res: Response): Promise<void> {
  const campaign = await findOwnedCampaign(req);
  res.json({ campaign });
}

/** PUT /api/campaigns/:id — edit a campaign (only while not yet sending/sent). */
export async function updateCampaign(req: Request, res: Response): Promise<void> {
  const existing = await findOwnedCampaign(req);
  if (existing.status === 'SENDING' || existing.status === 'SENT') {
    throw ApiError.conflict(`Cannot edit a campaign that is ${existing.status}`);
  }
  const input = req.body as UpdateCampaignInput;

  const campaign = await prisma.emailCampaign.update({
    where: { id: existing.id },
    data: {
      name: input.name,
      subject: input.subject,
      fromEmail: input.fromEmail,
      html: input.html,
      text: input.text,
      scheduledAt: input.scheduledAt,
    },
  });
  res.json({ campaign });
}

/**
 * POST /api/campaigns/:id/queue — mark the campaign QUEUED and hand it to the
 * background worker for delivery (respecting `scheduledAt` if in the future).
 */
export async function queueCampaign(req: Request, res: Response): Promise<void> {
  const existing = await findOwnedCampaign(req);
  if (existing.status === 'SENDING' || existing.status === 'SENT') {
    throw ApiError.conflict(`Campaign is already ${existing.status}`);
  }
  if (existing.totalRecipients === 0) {
    throw ApiError.badRequest('Campaign has no recipients');
  }

  const campaign = await prisma.emailCampaign.update({
    where: { id: existing.id },
    data: { status: 'QUEUED' },
  });

  const delayMs =
    existing.scheduledAt && existing.scheduledAt.getTime() > Date.now()
      ? existing.scheduledAt.getTime() - Date.now()
      : 0;

  const jobId = await enqueueCampaign(campaign.id);
  res.status(202).json({
    campaign,
    job: { id: jobId, delayMs, scheduledAt: existing.scheduledAt },
  });
}

/** GET /api/campaigns/:id/status — delivery progress + recipient breakdown. */
export async function getCampaignStatus(req: Request, res: Response): Promise<void> {
  const campaign = await findOwnedCampaign(req);

  const grouped = await prisma.campaignRecipient.groupBy({
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
    totalRecipients: campaign.totalRecipients,
    sentCount: campaign.sentCount,
    failedCount: campaign.failedCount,
    breakdown,
  });
}

/** DELETE /api/campaigns/:id — delete a campaign and its recipients. */
export async function deleteCampaign(req: Request, res: Response): Promise<void> {
  const campaign = await findOwnedCampaign(req);
  if (campaign.status === 'SENDING') {
    throw ApiError.conflict('Cannot delete a campaign while it is sending');
  }
  await prisma.emailCampaign.delete({ where: { id: campaign.id } });
  res.status(204).send();
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function findOwnedCampaign(req: Request) {
  const { userId } = getPrincipal(req);
  const campaign = await prisma.emailCampaign.findFirst({
    where: { id: param(req, 'id'), userId },
  });
  if (!campaign) throw ApiError.notFound('Campaign not found');
  return campaign;
}

/** Merge inline recipients with leads matched by tag, de-duplicated by email. */
async function resolveRecipients(
  userId: string,
  input: CreateCampaignInput,
): Promise<Array<{ email: string; leadId?: string }>> {
  const byEmail = new Map<string, { email: string; leadId?: string }>();

  for (const r of input.recipients) {
    byEmail.set(r.email.toLowerCase(), { email: r.email, leadId: r.leadId });
  }

  if (input.fromLeadTags && input.fromLeadTags.length > 0) {
    const leads = await prisma.lead.findMany({
      where: { userId, tags: { hasSome: input.fromLeadTags } },
      select: { id: true, email: true },
    });
    for (const lead of leads) {
      byEmail.set(lead.email.toLowerCase(), { email: lead.email, leadId: lead.id });
    }
  }

  return [...byEmail.values()];
}
