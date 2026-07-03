import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { idParamSchema } from '../validators/common.schema';
import {
  createCampaignSchema,
  listCampaignsQuerySchema,
  updateCampaignSchema,
} from '../validators/campaign.schema';
import {
  createCampaign,
  deleteCampaign,
  getCampaign,
  getCampaignStatus,
  listCampaigns,
  queueCampaign,
  updateCampaign,
} from '../controllers/campaign.controller';

export const campaignRouter = Router();

campaignRouter.use(requireAuth);

campaignRouter.post('/', validate(createCampaignSchema), asyncHandler(createCampaign));
campaignRouter.get('/', validate(listCampaignsQuerySchema, 'query'), asyncHandler(listCampaigns));
campaignRouter.get('/:id', validate(idParamSchema, 'params'), asyncHandler(getCampaign));
campaignRouter.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateCampaignSchema),
  asyncHandler(updateCampaign),
);
campaignRouter.post(
  '/:id/queue',
  validate(idParamSchema, 'params'),
  asyncHandler(queueCampaign),
);
campaignRouter.get(
  '/:id/status',
  validate(idParamSchema, 'params'),
  asyncHandler(getCampaignStatus),
);
campaignRouter.delete('/:id', validate(idParamSchema, 'params'), asyncHandler(deleteCampaign));
