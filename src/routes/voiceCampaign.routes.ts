import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { idParamSchema } from '../validators/common.schema';
import {
  addLeadsSchema,
  createVoiceCampaignSchema,
  listVoiceCampaignsQuerySchema,
  updateVoiceCampaignSchema,
} from '../validators/voiceCampaign.schema';
import {
  addLeads,
  createVoiceCampaign,
  deleteVoiceCampaign,
  getVoiceCampaign,
  getVoiceCampaignStatus,
  launchVoiceCampaign,
  listVoiceCampaigns,
  updateVoiceCampaign,
} from '../controllers/voiceCampaign.controller';

export const voiceCampaignRouter = Router();

voiceCampaignRouter.use(requireAuth);

voiceCampaignRouter.post('/', validate(createVoiceCampaignSchema), asyncHandler(createVoiceCampaign));
voiceCampaignRouter.get(
  '/',
  validate(listVoiceCampaignsQuerySchema, 'query'),
  asyncHandler(listVoiceCampaigns),
);
voiceCampaignRouter.get('/:id', validate(idParamSchema, 'params'), asyncHandler(getVoiceCampaign));
voiceCampaignRouter.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateVoiceCampaignSchema),
  asyncHandler(updateVoiceCampaign),
);
voiceCampaignRouter.post(
  '/:id/leads',
  validate(idParamSchema, 'params'),
  validate(addLeadsSchema),
  asyncHandler(addLeads),
);
voiceCampaignRouter.post(
  '/:id/launch',
  validate(idParamSchema, 'params'),
  asyncHandler(launchVoiceCampaign),
);
voiceCampaignRouter.get(
  '/:id/status',
  validate(idParamSchema, 'params'),
  asyncHandler(getVoiceCampaignStatus),
);
voiceCampaignRouter.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(deleteVoiceCampaign),
);
