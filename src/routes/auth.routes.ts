import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { loginSchema, registerSchema } from '../validators/auth.schema';
import { login, me, register } from '../controllers/auth.controller';

export const authRouter = Router();

authRouter.post('/register', validate(registerSchema), asyncHandler(register));
authRouter.post('/login', validate(loginSchema), asyncHandler(login));
authRouter.get('/me', requireAuth, asyncHandler(me));
