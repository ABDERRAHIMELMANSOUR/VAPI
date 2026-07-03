import { PrismaClient } from '@prisma/client';
import { isProduction } from './env';

/**
 * Single shared PrismaClient instance.
 *
 * In development the module can be re-evaluated on hot reload; caching the
 * instance on `globalThis` prevents exhausting the database connection pool
 * with a new client on every reload.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ['error', 'warn'] : ['error', 'warn', 'info'],
  });

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
