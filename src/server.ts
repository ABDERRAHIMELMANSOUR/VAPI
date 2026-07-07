import { createServer, type Server } from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/prisma';
import { voiceOrchestrator } from './services/VoiceOrchestrator';
import { registerPostCallWorker } from './workers/postCall.worker';
import { registerCampaignWorker } from './workers/campaign.worker';
import { registerOutboundCampaignWorker } from './workers/outboundCampaign.worker';
import { closeAllQueues } from './queue/Queue';
import { createLogger } from './utils/logger';

const log = createLogger('server');

/**
 * Bootstrap the full application: HTTP API + Twilio Media Streams WebSocket +
 * background workers, with graceful shutdown wiring.
 */
export async function startServer(): Promise<Server> {
  // A live DB is optional for boot; log a warning but keep serving so the
  // health endpoint and voice stub still work without a database.
  try {
    if (env.DATABASE_URL) {
      await connectDatabase();
      log.info('Database connected');
    } else {
      log.warn('DATABASE_URL not set — DB-backed routes will error until configured');
    }
  } catch (err) {
    log.error('Database connection failed; continuing to boot', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const app = createApp();
  const server = createServer(app);

  // Attach the Twilio Media Streams WebSocket server to the same HTTP server.
  voiceOrchestrator.attach(server);

  // Register background workers (post-call summary, email + voice campaigns).
  registerPostCallWorker();
  registerCampaignWorker();
  registerOutboundCampaignWorker();

  await new Promise<void>((resolve) => {
    server.listen(env.PORT, () => {
      log.info(`VoxCRM API listening on http://localhost:${env.PORT}`);
      resolve();
    });
  });

  wireGracefulShutdown(server);
  return server;
}

function wireGracefulShutdown(server: Server): void {
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info(`Received ${signal}, shutting down gracefully`);

    server.close(() => log.info('HTTP server closed'));
    try {
      await closeAllQueues();
      await disconnectDatabase();
    } catch (err) {
      log.error('Error during shutdown', {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    log.error('Unhandled promise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });
  process.on('uncaughtException', (err) => {
    log.error('Uncaught exception', { error: err.message, stack: err.stack });
  });
}
