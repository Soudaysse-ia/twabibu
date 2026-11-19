import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthGuard, CurrentUser, PatientGuard } from '../auth/auth.guard.js';
import type { SessionUser } from '../auth/auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { MeService } from './me.service.js';

const today = () => new Date().toISOString().slice(0, 10);
const RelativeSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => d >= '1900-01-01' && d <= today(), 'Invalid birth date'),
  relationship: z.enum(['ENFANT', 'PARENT', 'CONJOINT', 'AUTRE']),
});
const ScopeSchema = z.object({ scope: z.enum(['upcoming', 'past']).default('upcoming') });
const PreferencesSchema = z.object({ reminders: z.boolean() });

@ApiTags('me')
@Controller('v1/me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Utilisateur connecté, profil patient et proches.' })
  get(@CurrentUser() user: SessionUser) {
    return this.me.me(user);
  }

  @Get('notification-preferences')
  @UseGuards(PatientGuard)
  @ApiOperation({ summary: 'Rappels de rendez-vous activés ou non.' })
  preferences(@CurrentUser() user: SessionUser) {
    return this.me.preferences(user);
  }

  @Put('notification-preferences')
  @UseGuards(PatientGuard)
  updatePreferences(@CurrentUser() user: SessionUser, @Body(new ZodValidationPipe(PreferencesSchema)) body: z.infer<typeof PreferencesSchema>) {
    return this.me.updatePreferences(user, body);
  }

  @Post('relatives')
  @HttpCode(201)
  @UseGuards(PatientGuard)
  addRelative(@CurrentUser() user: SessionUser, @Body(new ZodValidationPipe(RelativeSchema)) body: z.infer<typeof RelativeSchema>) {
    return this.me.addRelative(user, body);
  }

  @Get('appointments')
  @UseGuards(PatientGuard)
  @ApiOperation({ summary: 'Rendez-vous à venir ou passés du patient et de ses proches.' })
  appointments(@CurrentUser() user: SessionUser, @Query(new ZodValidationPipe(ScopeSchema)) query: z.infer<typeof ScopeSchema>) {
    return this.me.appointments(user, query.scope);
  }

  @Post('appointments/:id/cancel')
  @HttpCode(200)
  @UseGuards(PatientGuard)
  @ApiOperation({ summary: 'Annule un rendez-vous si le délai d’annulation du cabinet le permet.' })
  cancel(@CurrentUser() user: SessionUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.me.cancel(user, id);
  }
}
