import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { getPrincipal } from '../middleware/auth';
import { param } from '../utils/http';
import type {
  CreateEmailTemplateInput,
  UpdateEmailTemplateInput,
} from '../validators/emailTemplate.schema';

/** POST /api/email-templates — save a reusable email template. */
export async function createEmailTemplate(req: Request, res: Response): Promise<void> {
  const { userId } = getPrincipal(req);
  const input = req.body as CreateEmailTemplateInput;
  const template = await prisma.emailTemplate.create({
    data: {
      userId,
      name: input.name,
      subject: input.subject,
      html: input.html,
      text: input.text,
    },
  });
  res.status(201).json({ template });
}

/** GET /api/email-templates — list saved templates. */
export async function listEmailTemplates(req: Request, res: Response): Promise<void> {
  const { userId } = getPrincipal(req);
  const templates = await prisma.emailTemplate.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
  res.json({ items: templates, total: templates.length });
}

/** PUT /api/email-templates/:id — update a template. */
export async function updateEmailTemplate(req: Request, res: Response): Promise<void> {
  const { userId } = getPrincipal(req);
  await findOwned(userId, param(req, 'id'));
  const input = req.body as UpdateEmailTemplateInput;

  const data: Prisma.EmailTemplateUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.subject !== undefined) data.subject = input.subject;
  if (input.html !== undefined) data.html = input.html;
  if (input.text !== undefined) data.text = input.text;

  const template = await prisma.emailTemplate.update({
    where: { id: param(req, 'id') },
    data,
  });
  res.json({ template });
}

/** DELETE /api/email-templates/:id — delete a template. */
export async function deleteEmailTemplate(req: Request, res: Response): Promise<void> {
  const { userId } = getPrincipal(req);
  await findOwned(userId, param(req, 'id'));
  await prisma.emailTemplate.delete({ where: { id: param(req, 'id') } });
  res.status(204).send();
}

async function findOwned(userId: string, id: string) {
  const template = await prisma.emailTemplate.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!template) throw ApiError.notFound('Template not found');
  return template;
}
