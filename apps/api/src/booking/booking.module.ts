import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller.js';
import { BookingService } from './booking.service.js';
import { PresenceController } from './presence.controller.js';

@Module({ controllers: [BookingController, PresenceController], providers: [BookingService] })
export class BookingModule {}
