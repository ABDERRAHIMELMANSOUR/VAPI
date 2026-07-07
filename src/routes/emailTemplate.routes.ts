import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { idParamSchema } from '../validators/common.schema';
import {
  createEmailTemplateSchema,
  updateEmailTemplateSchema,
} from '../validators/emailTemplate.schema';
import {
  createEmailTemplate,
  deleteEmailTemplate,
  listEmailTemplates,
  updateEmailTemplate,
} from '../controllers/emailTemplate.controller';

export const emailTemplateRouter = Router();

emailTemplateRouter.use(requireAuth);

emailTemplateRouter.post('/', validate(createEmailTemplateSchema), asyncHandler(createEmailTemplate));
emailTemplateRouter.get('/', asyncHandler(listEmailTemplates));
emailTemplateRouter.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateEmailTemplateSchema),
  asyncHandler(updateEmailTemplate),
);
emailTemplateRouter.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(deleteEmailTemplate),
);
