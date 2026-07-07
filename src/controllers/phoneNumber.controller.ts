import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { getPrincipal } from '../middleware/auth';
import { param } from '../utils/http';
import {
  TwilioAuthError,
  TwilioNotFoundError,
  twilioService,
} from '../services/TwilioService';
import type {
  ImportPhoneNumberInput,
  ListPhoneNumbersQuery,
  UpdatePhoneNumberInput,
} from '../validators/phoneNumber.schema';

// Never expose the stored Twilio auth token to API clients.
const PUBLIC_SELECT = {
  id: true,
  number: true,
  friendlyName: true,
  provider: true,
  status: true,
  twilioSid: true,
  twilioAccountSid: true,
  capabilities: true,
  agentId: true,
  createdAt: true,
  updatedAt: true,
  agent: { select: { id: true, name: true } },
} satisfies Prisma.PhoneNumberSelect;

/**
 * POST /api/phone-numbers/import — verify a Twilio number with the supplied
 * credentials and bind it to the workspace.
 */
export async function importPhoneNumber(req: Request, res: Response): Promise<void> {
  const { userId } = getPrincipal(req);
  const input = req.body as ImportPhoneNumberInput;

  if (input.agentId) await assertAgentOwned(userId, input.agentId);

  const existing = await prisma.phoneNumber.findUnique({
    where: { userId_number: { userId, number: input.number } },
    select: { id: true },
  });
  if (existing) {
    throw ApiError.conflict('That phone number is already imported into this workspace');
  }

  let verified;
  try {
    verified = await twilioService.verifyNumber(
      { accountSid: input.twilioAccountSid, authToken: input.twilioAuthToken },
      input.number,
    );
  } catch (err) {
    if (err instanceof TwilioAuthError) throw ApiError.badRequest(err.message);
    if (err instanceof TwilioNotFoundError) throw ApiError.badRequest(err.message);
    throw err;
  }

  const phoneNumber = await prisma.phoneNumber.create({
    data: {
      userId,
      number: verified.number,
      friendlyName: input.friendlyName ?? verified.friendlyName,
      provider: 'twilio',
      status: 'ACTIVE',
      twilioSid: verified.twilioSid,
      twilioAccountSid: input.twilioAccountSid,
      twilioAuthToken: input.twilioAuthToken,
      capabilities: verified.capabilities as unknown as Prisma.InputJsonValue,
      agentId: input.agentId ?? null,
    },
    select: PUBLIC_SELECT,
  });

  res.status(201).json({ phoneNumber, verified: verified.verified });
}

/** GET /api/phone-numbers — list imported numbers. */
export async function listPhoneNumbers(req: Request, res: Response): Promise<void> {
  const { userId } = getPrincipal(req);
  const { page, limit, sort } = req.query as unknown as ListPhoneNumbersQuery;

  const where: Prisma.PhoneNumberWhereInput = { userId };
  const [items, total] = await Promise.all([
    prisma.phoneNumber.findMany({
      where,
      orderBy: { createdAt: sort },
      skip: (page - 1) * limit,
      take: limit,
      select: PUBLIC_SELECT,
    }),
    prisma.phoneNumber.count({ where }),
  ]);

  res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
}

/** PUT /api/phone-numbers/:id — rename, (de)activate, or (re)bind an agent. */
export async function updatePhoneNumber(req: Request, res: Response): Promise<void> {
  const { userId } = getPrincipal(req);
  await findOwned(userId, param(req, 'id'));
  const input = req.body as UpdatePhoneNumberInput;

  if (input.agentId) await assertAgentOwned(userId, input.agentId);

  const data: Prisma.PhoneNumberUpdateInput = {};
  if (input.friendlyName !== undefined) data.friendlyName = input.friendlyName;
  if (input.status !== undefined) data.status = input.status;
  if (input.agentId !== undefined) {
    data.agent = input.agentId ? { connect: { id: input.agentId } } : { disconnect: true };
  }

  const phoneNumber = await prisma.phoneNumber.update({
    where: { id: param(req, 'id') },
    data,
    select: PUBLIC_SELECT,
  });
  res.json({ phoneNumber });
}

/** DELETE /api/phone-numbers/:id — release the number from the workspace. */
export async function deletePhoneNumber(req: Request, res: Response): Promise<void> {
  const { userId } = getPrincipal(req);
  await findOwned(userId, param(req, 'id'));
  await prisma.phoneNumber.delete({ where: { id: param(req, 'id') } });
  res.status(204).send();
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function findOwned(userId: string, id: string) {
  const found = await prisma.phoneNumber.findFirst({ where: { id, userId }, select: { id: true } });
  if (!found) throw ApiError.notFound('Phone number not found');
  return found;
}

async function assertAgentOwned(userId: string, agentId: string): Promise<void> {
  const agent = await prisma.agent.findFirst({ where: { id: agentId, userId }, select: { id: true } });
  if (!agent) throw ApiError.badRequest(`Agent ${agentId} not found`);
}
