import { isProduction } from '../config/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const MIN_LEVEL: LogLevel = isProduction ? 'info' : 'debug';

function emit(level: LogLevel, scope: string, message: string, meta?: unknown): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[MIN_LEVEL]) return;

  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
  };
  if (meta !== undefined) entry.meta = meta;

  const line = isProduction
    ? JSON.stringify(entry)
    : `${entry.ts} [${level.toUpperCase()}] (${scope}) ${message}${
        meta !== undefined ? ` ${safeStringify(meta)}` : ''
      }`;

  // eslint-disable-next-line no-console
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  sink(line);
}

function safeStringify(value: unknown): string {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Create a scoped logger, e.g. `const log = createLogger('VoiceOrchestrator')`. */
export function createLogger(scope: string) {
  return {
    debug: (message: string, meta?: unknown) => emit('debug', scope, message, meta),
    info: (message: string, meta?: unknown) => emit('info', scope, message, meta),
    warn: (message: string, meta?: unknown) => emit('warn', scope, message, meta),
    error: (message: string, meta?: unknown) => emit('error', scope, message, meta),
  };
}

export type Logger = ReturnType<typeof createLogger>;
