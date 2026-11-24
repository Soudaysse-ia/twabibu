import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { dateKeySchema, ProfileReportSchema, type ProfileReport } from '@twabibu/contracts';
import { addDaysToDateKey } from '@twabibu/utils';
import { sessionFromRequest } from '../auth/auth.guard.js';
import { AuthService } from '../auth/auth.service.js';
import type { AuthedRequest } from '../auth/auth.types.js';
import { ApiException } from '../common/api-exception.js';
import { BOOKING_COOKIE, readCookie } from '../common/cookies.js';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PractitionersService } from './practitioners.service.js';

const SearchSchema = z.object({
  q: z.string().trim().max(80).optional(),
  ou: z.string().trim().max(80).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  page: z.coerce.number().int().min(1).max(100).default(1),
  // Filters (SPEC-01 §7), all in the URL so a search can be shared.
  dispo: z.enum(['0', '3', '7', '14']).optional().transform((v) => (v === undefined ? undefined : Number(v))),
  langues: z.string().trim().max(200).optional().transform((v) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 10) : [])),
  paiement: z.string().trim().max(200).optional().transform((v) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 10) : [])),
  assurance: z.string().trim().max(120).optional(),
  nouveaux: z.literal('1').optional().transform((v) => v === '1'),
  tri: z.enum(['pertinence', 'dispo', 'distance']).default('pertinence'),
});

const AvailabilitySchema = z
  .object({ motiveId: z.uuid(), from: dateKeySchema, to: dateKeySchema })
  .refine((v) => v.from <= v.to && v.to <= addDaysToDateKey(v.from, 13), 'At most 14 days per request');

@ApiTags('practitioners')
@Controller('v1')
@RateLimit('publicRead')
@UseGuards(RateLimitGuard)
export class PractitionersController {
  constructor(
    private readonly practitioners: PractitionersService,
    private readonly auth: AuthService,
  ) {}

  @Get('search/practitioners')
  @RateLimit('search')
  @ApiOperation({ summary: 'Résultats de recherche avec la grille de créneaux des 5 prochains jours.' })
  async search(@Query(new ZodValidationPipe(SearchSchema)) query: z.infer<typeof SearchSchema>, @Req() req: AuthedRequest) {
    const user = await sessionFromRequest(this.auth, req);
    return this.practitioners.search({ ...query, patientProfileId: user?.patientProfileId });
  }

  @Get('search/sitemap')
  @Header('Cache-Control', 'public, max-age=600')
  @ApiOperation({ summary: 'Pages « spécialité × lieu » ayant au moins un résultat, et profils publics (plan du site, SEARCH-08).' })
  sitemap() {
    return this.practitioners.sitemap();
  }

  @Get('practitioners/:slug')
  @ApiOperation({ summary: 'Profil public d’un soignant vérifié.' })
  profile(@Param('slug') slug: string) {
    if (!/^[a-z0-9-]{1,120}$/.test(slug)) throw new ApiException('NOT_FOUND', 'Practitioner not found');
    return this.practitioners.profile(slug);
  }

  @Post('practitioners/:slug/reports')
  @HttpCode(202)
  @RateLimit('report')
  @ApiOperation({ summary: 'Signale un problème sur le profil public d’un soignant (traité dans le back-office).' })
  async report(@Param('slug') slug: string, @Body(new ZodValidationPipe(ProfileReportSchema)) body: ProfileReport, @Req() req: AuthedRequest) {
    if (!/^[a-z0-9-]{1,120}$/.test(slug)) throw new ApiException('NOT_FOUND', 'Practitioner not found');
    const user = await sessionFromRequest(this.auth, req);
    await this.practitioners.report(slug, body, user?.id ?? null);
    return { status: 'RECEIVED' };
  }

  @Get('practitioners/:slug/availabilities')
  @ApiOperation({ summary: 'Créneaux d’un motif, par jour (14 jours maximum par appel).' })
  async availabilities(@Param('slug') slug: string, @Query(new ZodValidationPipe(AvailabilitySchema)) query: z.infer<typeof AvailabilitySchema>, @Req() req: AuthedRequest) {
    const user = await sessionFromRequest(this.auth, req);
    return this.practitioners.availabilities(slug, query.motiveId, query.from, query.to, {
      patientProfileId: user?.patientProfileId,
      bookingSessionId: readCookie(req, BOOKING_COOKIE),
    });
  }
}
