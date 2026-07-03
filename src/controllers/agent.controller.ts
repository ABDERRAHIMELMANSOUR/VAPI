import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { getPrincipal } from '../middleware/auth';
import { param } from '../utils/http';
import type { PaginationQuery } from '../validators/common.schema';
import type { CreateAgentInput, UpdateAgentInput } from '../validators/agent.schema';

/** POST /api/agents — create a voice agent. */
export async function createAgent(req: Request, res: Response): Promise<void> {
  const { userId } = getPrincipal(req);
  const input = req.body as CreateAgentInput;

  const agent = await prisma.agent.create({
    data: {
      userId,
      name: input.name,
      description: input.description,
      systemPrompt: input.systemPrompt,
      ...(input.firstMessage ? { firstMessage: input.firstMessage } : {}),
      sttProvider: input.sttProvider,
      llmProvider: input.llmProvider,
      llmModel: input.llmModel,
      ttsProvider: input.ttsProvider,
      voiceId: input.voiceId,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      config: input.config as Prisma.InputJsonValue,
      isActive: input.isActive,
    },
  });
  res.status(201).json({ agent });
}

/** GET /api/agents — list the caller's agents (paginated). */
export async function listAgents(req: Request, res: Response): Promise<void> {
  const { userId } = getPrincipal(req);
  const { page, limit, sort } = req.query as unknown as PaginationQuery;

  const where: Prisma.AgentWhereInput = { userId };
  const [items, total] = await Promise.all([
    prisma.agent.findMany({
      where,
      orderBy: { createdAt: sort },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.agent.count({ where }),
  ]);

  res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
}

/** GET /api/agents/:id — fetch one agent owned by the caller. */
export async function getAgent(req: Request, res: Response): Promise<void> {
  const agent = await findOwnedAgent(req);
  res.json({ agent });
}

/** PUT /api/agents/:id — update an agent. */
export async function updateAgent(req: Request, res: Response): Promise<void> {
  await findOwnedAgent(req); // authorize
  const input = req.body as UpdateAgentInput;

  const data: Prisma.AgentUpdateInput = { ...input } as Prisma.AgentUpdateInput;
  if (input.config !== undefined) {
    data.config = input.config as Prisma.InputJsonValue;
  }

  const agent = await prisma.agent.update({
    where: { id: param(req, 'id') },
    data,
  });
  res.json({ agent });
}

/** DELETE /api/agents/:id — delete an agent. */
export async function deleteAgent(req: Request, res: Response): Promise<void> {
  await findOwnedAgent(req); // authorize
  await prisma.agent.delete({ where: { id: param(req, 'id') } });
  res.status(204).send();
}

/** Load an agent and assert the caller owns it, else 404 (avoid leaking existence). */
async function findOwnedAgent(req: Request) {
  const { userId } = getPrincipal(req);
  const agent = await prisma.agent.findFirst({
    where: { id: param(req, 'id'), userId },
  });
  if (!agent) throw ApiError.notFound('Agent not found');
  return agent;
}
