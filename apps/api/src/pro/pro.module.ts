import { Module } from '@nestjs/common';
import { ProController, ProMeController } from './pro.controller.js';
import { ProGuard } from './pro.guard.js';
import { PracticeOverviewService } from './practice-overview.service.js';
import { ProService } from './pro.service.js';
import { SettingsService } from './settings.service.js';
import { InvitationsController, TeamController } from './team.controller.js';
import { TeamService } from './team.service.js';

@Module({
  controllers: [ProMeController, ProController, TeamController, InvitationsController],
  providers: [ProService, SettingsService, PracticeOverviewService, TeamService, ProGuard],
})
export class ProModule {}
