import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PracticeUpdateSchema, type PracticeUpdate } from '@twabibu/contracts';
import { CurrentUser } from '../auth/auth.guard.js';
import type { AuthedRequest, SessionUser } from '../auth/auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { MembershipContext } from './permissions.js';
import { CurrentMembership, ProGuard } from './pro.guard.js';
import { PracticeService } from './practice.service.js';

/** Places of consultation of the practice (SPEC-07 PRO-06). Rights are checked in PracticeService. */
@ApiTags('pro')
@Controller('v1/pro/orgs/:orgId/practices')
@UseGuards(ProGuard)
export class PracticeController {
  constructor(private readonly practices: PracticeService) {}

  @Get()
  @ApiOperation({ summary: 'Lieux de consultation du cabinet, et si ce membre peut les modifier.' })
  list(@CurrentMembership() m: MembershipContext) {
    return this.practices.list(m);
  }

  @Put(':practiceId')
  @ApiOperation({
    summary:
      'Modifie un lieu : nom, adresse, localité, téléphone, position, accès, horaires (titulaire et administrateurs).',
  })
  update(
    @CurrentMembership() m: MembershipContext,
    @CurrentUser() user: SessionUser,
    @Param('practiceId', new ParseUUIDPipe()) practiceId: string,
    @Body(new ZodValidationPipe(PracticeUpdateSchema)) body: PracticeUpdate,
    @Req() req: AuthedRequest,
  ) {
    return this.practices.update(m, user, practiceId, body, req.ip);
  }
}
