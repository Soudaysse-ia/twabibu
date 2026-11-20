import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
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
  phone: z.string().trim().max(30).optional(),
});
const birthDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => d >= '1900-01-01' && d <= today(), 'Invalid birth date');
const ProfileSchema = z.object({
  civility: z.enum(['M', 'MME', 'AUTRE']).nullable(),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  birthDate,
  addressLine: z.string().trim().max(200).nullable(),
  localityId: z.string().uuid().nullable(),
  insurance: z.string().trim().max(100).nullable(),
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

  @Patch('relatives/:id')
  @UseGuards(PatientGuard)
  @ApiOperation({ summary: 'Modifie un proche du patient.' })
  updateRelative(@CurrentUser() user: SessionUser, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(RelativeSchema)) body: z.infer<typeof RelativeSchema>) {
    return this.me.updateRelative(user, id, body);
  }

  @Delete('relatives/:id')
  @HttpCode(204)
  @UseGuards(PatientGuard)
  @ApiOperation({ summary: 'Supprime un proche sans rendez-vous à venir.' })
  async removeRelative(@CurrentUser() user: SessionUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.me.removeRelative(user, id);
  }

  @Get('profile')
  @UseGuards(PatientGuard)
  @ApiOperation({ summary: 'Identité, adresse et assurance du patient.' })
  profile(@CurrentUser() user: SessionUser) {
    return this.me.profile(user);
  }

  @Put('profile')
  @UseGuards(PatientGuard)
  @ApiOperation({ summary: 'Met à jour le profil ; un changement de nom est journalisé.' })
  updateProfile(@CurrentUser() user: SessionUser, @Body(new ZodValidationPipe(ProfileSchema)) body: z.infer<typeof ProfileSchema>) {
    return this.me.updateProfile(user, body);
  }

  @Get('sessions')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Appareils connectés au compte (sessions actives).' })
  sessions(@CurrentUser() user: SessionUser) {
    return this.me.sessions(user);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Déconnecte un autre appareil.' })
  async revokeSession(@CurrentUser() user: SessionUser, @Param('id', new ParseUUIDPipe()) id: string) {
    await this.me.revokeSession(user, id);
  }

  @Post('sessions/revoke-others')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Déconnecte tous les autres appareils.' })
  revokeOthers(@CurrentUser() user: SessionUser) {
    return this.me.revokeOtherSessions(user);
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
