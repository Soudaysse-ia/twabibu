import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { RemindersService } from './reminders.service.js';

export const REMINDERS_QUEUE = 'reminders';
const EVERY_MS = 15 * 60_000;

/** Runs the reminder scheduler every 15 minutes (one BullMQ job scheduler, shared by all API instances). */
@Processor(REMINDERS_QUEUE)
export class RemindersProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(RemindersProcessor.name);

  constructor(
    private readonly reminders: RemindersService,
    @InjectQueue(REMINDERS_QUEUE) private readonly queue: Queue,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    super();
  }

  async onModuleInit() {
    // Tests drive runDue() with a simulated clock instead.
    if (this.config.NODE_ENV === 'test') return;
    try {
      await this.queue.upsertJobScheduler('reminder-scheduler', { every: EVERY_MS }, { name: 'run', opts: { removeOnComplete: 100, removeOnFail: 100 } });
    } catch (error) {
      this.logger.error(`Could not schedule reminders: ${(error as Error).message}`);
    }
  }

  async process(): Promise<void> {
    await this.reminders.runDue();
    await this.reminders.runValidationReminders();
  }
}
