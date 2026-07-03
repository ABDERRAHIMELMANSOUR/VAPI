import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { idParamSchema } from '../validators/common.schema';
import {
  createCallSchema,
  listCallsQuerySchema,
  updateCallSchema,
} from '../validators/call.schema';
import {
  createCall,
  deleteCall,
  getCall,
  listCalls,
  updateCall,
} from '../controllers/call.controller';

export const callRouter = Router();

callRouter.use(requireAuth);

callRouter.post('/', validate(createCallSchema), asyncHandler(createCall));
callRouter.get('/', validate(listCallsQuerySchema, 'query'), asyncHandler(listCalls));
callRouter.get('/:id', validate(idParamSchema, 'params'), asyncHandler(getCall));
callRouter.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateCallSchema),
  asyncHandler(updateCall),
);
callRouter.delete('/:id', validate(idParamSchema, 'params'), asyncHandler(deleteCall));
