import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { idParamSchema, paginationSchema } from '../validators/common.schema';
import { createAgentSchema, updateAgentSchema } from '../validators/agent.schema';
import {
  createAgent,
  deleteAgent,
  getAgent,
  listAgents,
  updateAgent,
} from '../controllers/agent.controller';

export const agentRouter = Router();

agentRouter.use(requireAuth);

agentRouter.post('/', validate(createAgentSchema), asyncHandler(createAgent));
agentRouter.get('/', validate(paginationSchema, 'query'), asyncHandler(listAgents));
agentRouter.get('/:id', validate(idParamSchema, 'params'), asyncHandler(getAgent));
agentRouter.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateAgentSchema),
  asyncHandler(updateAgent),
);
agentRouter.delete('/:id', validate(idParamSchema, 'params'), asyncHandler(deleteAgent));
