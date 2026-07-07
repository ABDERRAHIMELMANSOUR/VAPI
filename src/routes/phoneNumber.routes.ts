import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { idParamSchema } from '../validators/common.schema';
import {
  importPhoneNumberSchema,
  listPhoneNumbersQuerySchema,
  updatePhoneNumberSchema,
} from '../validators/phoneNumber.schema';
import {
  deletePhoneNumber,
  importPhoneNumber,
  listPhoneNumbers,
  updatePhoneNumber,
} from '../controllers/phoneNumber.controller';

export const phoneNumberRouter = Router();

phoneNumberRouter.use(requireAuth);

phoneNumberRouter.post(
  '/import',
  validate(importPhoneNumberSchema),
  asyncHandler(importPhoneNumber),
);
phoneNumberRouter.get(
  '/',
  validate(listPhoneNumbersQuerySchema, 'query'),
  asyncHandler(listPhoneNumbers),
);
phoneNumberRouter.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updatePhoneNumberSchema),
  asyncHandler(updatePhoneNumber),
);
phoneNumberRouter.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(deletePhoneNumber),
);
