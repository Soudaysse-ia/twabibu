import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ApiException } from '../common/api-exception.js';
import { verifyPresenceToken } from '../common/presence-token.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { practitionerName } from './appointment-view.js';

const Token = z.object({ t: z.string().max(64) });

/**
 * « Je confirme ma présence » from the reminder e-mail (SPEC-08, askConfirmation). No account needed: the signed
 * token is the proof. Read with GET, confirm with POST only (mail scanners open links, they do not post forms).
 * A wrong token and an unknown appointment answer the same 404. Never the motive.
 */
@ApiTags('booking')
@Controller('v1/appointments/:id/presence')
export class PresenceController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private async load(id: string, token: string) {
    const a = await this.prisma.appointment.findUnique({
      where: { id },
      include: { agenda: { include: { practitioner: true, practice: { include: { locality: true } } } } },
    });
    if (!a || !verifyPresenceToken(this.config.SESSION_SECRET, a.id, a.startsAt, token)) throw new ApiException('NOT_FOUND', 'Unknown appointment');
    return a;
  }

  private view(a: Awaited<ReturnType<PresenceController['load']>>) {
    const practice = a.agenda.practice;
    return {
      startsAt: a.startsAt.toISOString(),
      practitioner: practitionerName(a.agenda.practitioner),
      address: `${practice.name}, ${practice.addressLine}, ${practice.locality.name}`,
      status: a.status,
      confirmedAt: a.confirmedByPatientAt?.toISOString() ?? null,
      canConfirm: a.status === 'CONFIRMED' && a.startsAt > new Date(),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Rendez-vous à confirmer (lien du rappel).' })
  async get(@Param('id', new ParseUUIDPipe()) id: string, @Query(new ZodValidationPipe(Token)) q: z.infer<typeof Token>) {
    return this.view(await this.load(id, q.t));
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Le patient confirme sa présence (idempotent).' })
  async confirm(@Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(Token)) body: z.infer<typeof Token>) {
    const a = await this.load(id, body.t);
    if (a.status !== 'CONFIRMED' || a.startsAt <= new Date()) throw new ApiException('CONFLICT', 'This appointment can no longer be confirmed');
    if (!a.confirmedByPatientAt) {
      const now = new Date();
      // Only a still-unconfirmed row is updated: two clicks record one event.
      const done = await this.prisma.appointment.updateMany({ where: { id, confirmedByPatientAt: null }, data: { confirmedByPatientAt: now } });
      if (done.count) await this.prisma.appointmentEvent.create({ data: { appointmentId: id, type: 'CONFIRMED_BY_PATIENT', payload: { channel: 'EMAIL_LINK' } } });
    }
    return this.view(await this.load(id, body.t));
  }
}
