import { Body, Controller, Delete, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { CurrentUser, PatientGuard, sessionFromRequest } from '../auth/auth.guard.js';
import { AuthService } from '../auth/auth.service.js';
import type { AuthedRequest, SessionUser } from '../auth/auth.types.js';
import { ApiException } from '../common/api-exception.js';
import { BOOKING_COOKIE, readCookie, writeCookie } from '../common/cookies.js';
import { randomToken } from '../common/crypto.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { BookingService } from './booking.service.js';

const SlotSchema = z.object({ agendaId: z.uuid(), motiveId: z.uuid(), startsAt: z.iso.datetime().transform((v) => new Date(v)) });
const RescheduleSchema = z.object({ startsAt: z.iso.datetime().transform((v) => new Date(v)) });
const UnlockSchema = z.object({ agendaId: z.uuid(), startsAt: z.iso.datetime().transform((v) => new Date(v)) });
const today = () => new Date().toISOString().slice(0, 10);
const BookSchema = SlotSchema.extend({
  relativeId: z.uuid().optional(),
  newRelative: z
    .object({
      firstName: z.string().trim().min(1).max(60),
      lastName: z.string().trim().min(1).max(60),
      birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => d >= '1900-01-01' && d <= today(), 'Invalid birth date'),
      relationship: z.enum(['ENFANT', 'PARENT', 'CONJOINT', 'AUTRE']),
    })
    .optional(),
  answers: z.record(z.string(), z.string().max(200)).optional(),
  instructionsAccepted: z.literal(true),
  patientMessage: z.string().trim().max(200).optional(),
  /** The patient lets this practice see their whole medical record (SPEC-13 §Carnet). Never for a relative. */
  shareRecord: z.boolean().default(false),
}).refine((v) => !(v.relativeId && v.newRelative), 'Choose an existing relative or a new one, not both');

@ApiTags('booking')
@Controller('v1/booking')
export class BookingController {
  constructor(
    private readonly booking: BookingService,
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Anonymous booking session: lets a visitor hold a slot before signing in. */
  private bookingSession(req: AuthedRequest, res: Response): string {
    const existing = readCookie(req, BOOKING_COOKIE);
    if (existing && /^[A-Za-z0-9_-]{20,64}$/.test(existing)) return existing;
    const id = randomToken(24);
    writeCookie(res, BOOKING_COOKIE, id, 24 * 3600, this.config.NODE_ENV === 'production');
    return id;
  }

  @Post('locks')
  @HttpCode(201)
  @ApiOperation({ summary: 'Réserve un créneau pendant 10 minutes, le temps de s’identifier.' })
  async lock(@Body(new ZodValidationPipe(SlotSchema)) body: z.infer<typeof SlotSchema>, @Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    const user = await sessionFromRequest(this.auth, req);
    return this.booking.lock(body, this.bookingSession(req, res), user);
  }

  @Delete('locks')
  @HttpCode(204)
  @ApiOperation({ summary: 'Libère le créneau tenu par cette session.' })
  async unlock(@Query(new ZodValidationPipe(UnlockSchema)) query: z.infer<typeof UnlockSchema>, @Req() req: AuthedRequest) {
    const session = readCookie(req, BOOKING_COOKIE);
    if (session) await this.booking.unlock(query.agendaId, query.startsAt, session);
  }

  @Post('appointments')
  @HttpCode(201)
  @UseGuards(PatientGuard)
  @ApiOperation({ summary: 'Crée le rendez-vous sur le créneau tenu par cette session.' })
  async book(@Body(new ZodValidationPipe(BookSchema)) body: z.infer<typeof BookSchema>, @CurrentUser() user: SessionUser, @Req() req: AuthedRequest) {
    const session = readCookie(req, BOOKING_COOKIE);
    if (!session) throw new ApiException('SLOT_LOCK_EXPIRED', 'No slot held for this session');
    return this.booking.book(body, user, session);
  }

  @Post('appointments/:id/reschedule')
  @HttpCode(201)
  @UseGuards(PatientGuard)
  @ApiOperation({ summary: 'Déplace un rendez-vous du patient sur le créneau tenu par cette session (même soignant, même motif).' })
  async reschedule(@Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(RescheduleSchema)) body: z.infer<typeof RescheduleSchema>, @CurrentUser() user: SessionUser, @Req() req: AuthedRequest) {
    // Ownership is checked before the slot lock: someone else's appointment is « not found », whatever the cookie.
    return this.booking.reschedule(user, id, body.startsAt, readCookie(req, BOOKING_COOKIE) ?? '');
  }
}
