import express, { type Express } from 'express';
import cors from 'cors';
import { env } from './config/env';
import { apiRouter, voiceRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

/**
 * Build and configure the Express application. Kept separate from server
 * bootstrap so it can be imported directly by tests.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true);

  const origins =
    env.CORS_ORIGIN === '*'
      ? true
      : env.CORS_ORIGIN.split(',').map((o) => o.trim());
  app.use(cors({ origin: origins, credentials: true }));

  // JSON for the API; urlencoded for Twilio's form-encoded webhooks.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  // Public Twilio webhook (form-encoded, unauthenticated).
  app.use('/voice', voiceRouter);

  // Authenticated JSON API.
  app.use('/api', apiRouter);

  app.get('/', (_req, res) => {
    res.json({ name: 'VoxCRM API', status: 'ok', docs: '/api/health' });
  });

  // 404 + centralized error handling must be registered last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
