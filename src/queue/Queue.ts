import { providers } from '../config/providers';
import { createLogger } from '../utils/logger';

const log = createLogger('queue');

/** A unit of background work. */
export type JobProcessor<T> = (data: T, jobId: string) => Promise<void>;

export interface EnqueueOptions {
  /** Delay in ms before the job becomes eligible to run. */
  delayMs?: number;
  /** Number of attempts before the job is considered failed. */
  attempts?: number;
}

export interface Queue<T> {
  readonly name: string;
  readonly driver: 'bullmq' | 'memory';
  add(data: T, options?: EnqueueOptions): Promise<string>;
  process(processor: JobProcessor<T>): void;
  close(): Promise<void>;
}

/**
 * In-process fallback queue. Used automatically when REDIS_URL is not set so
 * the app runs end-to-end without a Redis dependency. Jobs run on the Node
 * event loop with a bounded concurrency and simple retry/backoff.
 */
class MemoryQueue<T> implements Queue<T> {
  public readonly driver = 'memory' as const;
  private processor: JobProcessor<T> | null = null;
  private readonly pending: Array<{ id: string; data: T; attemptsLeft: number }> = [];
  private active = 0;
  private seq = 0;
  private closed = false;

  constructor(
    public readonly name: string,
    private readonly concurrency = 5,
  ) {}

  async add(data: T, options: EnqueueOptions = {}): Promise<string> {
    const id = `${this.name}:${++this.seq}`;
    const attemptsLeft = Math.max(1, options.attempts ?? 3);
    const schedule = () => {
      if (this.closed) return;
      this.pending.push({ id, data, attemptsLeft });
      this.drain();
    };
    if (options.delayMs && options.delayMs > 0) {
      setTimeout(schedule, options.delayMs).unref?.();
    } else {
      schedule();
    }
    return id;
  }

  process(processor: JobProcessor<T>): void {
    this.processor = processor;
    this.drain();
  }

  private drain(): void {
    if (!this.processor) return;
    while (this.active < this.concurrency && this.pending.length > 0) {
      const job = this.pending.shift()!;
      this.active += 1;
      void this.run(job);
    }
  }

  private async run(job: { id: string; data: T; attemptsLeft: number }): Promise<void> {
    try {
      await this.processor!(job.data, job.id);
    } catch (err) {
      const remaining = job.attemptsLeft - 1;
      if (remaining > 0) {
        const backoff = (3 - remaining) * 500;
        log.warn(`Job ${job.id} failed, retrying`, { remaining, backoff });
        setTimeout(() => {
          this.pending.push({ ...job, attemptsLeft: remaining });
          this.drain();
        }, backoff).unref?.();
      } else {
        log.error(`Job ${job.id} failed permanently`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      this.active -= 1;
      this.drain();
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    this.pending.length = 0;
  }
}

/**
 * BullMQ-backed queue. Loaded lazily (dynamic import) so that neither bullmq nor
 * ioredis is required at runtime unless REDIS_URL is configured.
 */
class BullQueue<T> implements Queue<T> {
  public readonly driver = 'bullmq' as const;
  private queue: import('bullmq').Queue | null = null;
  private worker: import('bullmq').Worker | null = null;
  private readyPromise: Promise<void>;

  constructor(
    public readonly name: string,
    private readonly redisUrl: string,
    private readonly concurrency = 5,
  ) {
    this.readyPromise = this.init();
  }

  private async init(): Promise<void> {
    const { Queue: BQueue } = await import('bullmq');
    this.queue = new BQueue(this.name, {
      connection: { url: this.redisUrl } as never,
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        backoff: { type: 'exponential', delay: 1000 },
      },
    });
    log.info(`BullMQ queue ready: ${this.name}`);
  }

  async add(data: T, options: EnqueueOptions = {}): Promise<string> {
    await this.readyPromise;
    const job = await this.queue!.add(this.name, data as never, {
      delay: options.delayMs,
      attempts: options.attempts ?? 3,
    });
    return String(job.id);
  }

  process(processor: JobProcessor<T>): void {
    void this.readyPromise.then(async () => {
      const { Worker } = await import('bullmq');
      this.worker = new Worker(
        this.name,
        async (job) => {
          await processor(job.data as T, String(job.id));
        },
        {
          connection: { url: this.redisUrl } as never,
          concurrency: this.concurrency,
        },
      );
      this.worker.on('failed', (job, err) => {
        log.error(`BullMQ job ${job?.id} failed`, { error: err.message });
      });
    });
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}

const registry = new Map<string, Queue<unknown>>();

/**
 * Create (or reuse) a named queue. Selects BullMQ when Redis is configured,
 * otherwise the in-memory fallback — the calling code is identical either way.
 */
export function createQueue<T>(name: string, concurrency = 5): Queue<T> {
  const existing = registry.get(name);
  if (existing) return existing as Queue<T>;

  const queue: Queue<T> = providers.queue.useRedis
    ? new BullQueue<T>(name, providers.queue.redisUrl!, concurrency)
    : new MemoryQueue<T>(name, concurrency);

  log.info(`Queue "${name}" using ${queue.driver} driver`);
  registry.set(name, queue as Queue<unknown>);
  return queue;
}

export async function closeAllQueues(): Promise<void> {
  await Promise.all([...registry.values()].map((q) => q.close()));
  registry.clear();
}
