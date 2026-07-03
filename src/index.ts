import { startServer } from './server';
import { createLogger } from './utils/logger';

const log = createLogger('bootstrap');

startServer().catch((err) => {
  log.error('Fatal error during startup', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
