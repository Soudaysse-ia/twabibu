import { Module } from '@nestjs/common';
import { ProController, ProMeController } from './pro.controller.js';
import { ProGuard } from './pro.guard.js';
import { PracticeOverviewService } from './practice-overview.service.js';
import { ProService } from './pro.service.js';
import { SettingsService } from './settings.service.js';

@Module({ controllers: [ProMeController, ProController], providers: [ProService, SettingsService, PracticeOverviewService, ProGuard] })
export class ProModule {}
