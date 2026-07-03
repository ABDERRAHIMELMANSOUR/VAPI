import { Router } from 'express';
import { providers } from '../config/providers';
import { authRouter } from './auth.routes';
import { agentRouter } from './agent.routes';
import { callRouter } from './call.routes';
import { campaignRouter } from './campaign.routes';
import { voiceRouter } from './voice.routes';

export const apiRouter = Router();

/** Liveness/readiness probe with provider capability report. */
apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptimeSec: Math.round(process.uptime()),
    providers: {
      twilio: providers.twilio.configured,
      deepgram: providers.deepgram.configured,
      elevenlabs: providers.elevenlabs.configured,
      llm: providers.llm.configured,
      email: providers.email.provider,
      queue: providers.queue.useRedis ? 'bullmq' : 'memory',
    },
  });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/agents', agentRouter);
apiRouter.use('/calls', callRouter);
apiRouter.use('/campaigns', campaignRouter);

export { voiceRouter };
