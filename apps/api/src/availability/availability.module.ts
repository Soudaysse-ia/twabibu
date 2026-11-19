import { Global, Module } from '@nestjs/common';
import { AvailabilityService } from './availability.service.js';
import { SlotLockService } from './slot-locks.js';

@Global()
@Module({ providers: [AvailabilityService, SlotLockService], exports: [AvailabilityService, SlotLockService] })
export class AvailabilityModule {}
