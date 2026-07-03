import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { hashPassword, verifyPassword } from '../utils/password';
import { getPrincipal, signToken } from '../middleware/auth';
import type { LoginInput, RegisterInput } from '../validators/auth.schema';

/** POST /api/auth/register — create a user and return an API token. */
export async function register(req: Request, res: Response): Promise<void> {
  const { email, name, password } = req.body as RegisterInput;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw ApiError.conflict('A user with this email already exists');

  const user = await prisma.user.create({
    data: { email, name, passwordHash: await hashPassword(password) },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  const token = signToken({ userId: user.id, email: user.email });
  res.status(201).json({ user, token });
}

/** POST /api/auth/login — verify credentials and return an API token. */
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as LoginInput;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw ApiError.unauthorized('Invalid email or password');

  const token = signToken({ userId: user.id, email: user.email });
  res.json({
    user: { id: user.id, email: user.email, name: user.name },
    token,
  });
}

/** GET /api/auth/me — return the authenticated user's profile. */
export async function me(req: Request, res: Response): Promise<void> {
  const { userId } = getPrincipal(req);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  if (!user) throw ApiError.notFound('User not found');
  res.json({ user });
}
