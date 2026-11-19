import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { APP_CONFIG, type AppConfig } from '../config.js';

/** Shared Redis connection: cache, slot locks (SPEC-12), rate limits. */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.client = new Redis(config.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 2, enableOfflineQueue: false });
    this.client.on('error', (err: Error) => this.logger.warn(`Redis: ${err.message}`));
  }

  /**
   * Waits for the first connection before the app accepts requests (offline queue is disabled, so an early
   * command would fail). Gives up after 5 s: the app then starts degraded and /ready reports it.
   */
  async onModuleInit(): Promise<void> {
    if (this.client.status === 'ready') return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.logger.warn('Redis not reachable after 5 s, starting degraded');
        resolve();
      }, 5000);
      this.client.once('ready', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  async isHealthy(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }
}
