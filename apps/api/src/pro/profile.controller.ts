import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PractitionerProfileUpdateSchema, type PractitionerProfileUpdate } from '@twabibu/contracts';
import { CurrentUser } from '../auth/auth.guard.js';
import type { AuthedRequest, SessionUser } from '../auth/auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { MembershipContext } from './permissions.js';
import { CurrentMembership, ProGuard } from './pro.guard.js';
import { ProfileService } from './profile.service.js';

/** Public profiles of the practice's practitioners (SPEC-07 PRO-07). Rights are checked in ProfileService. */
@ApiTags('pro')
@Controller('v1/pro/orgs/:orgId/profiles')
@UseGuards(ProGuard)
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Get()
  @ApiOperation({
    summary:
      'Profils publics modifiables par ce membre (le sien, ou tous pour la direction) et choix proposés.',
  })
  list(@CurrentMembership() m: MembershipContext) {
    return this.profiles.list(m);
  }

  @Put(':practitionerId')
  @ApiOperation({
    summary:
      'Modifie la présentation, les expertises, les langues, les paiements, les assurances et les diplômes.',
  })
  update(
    @CurrentMembership() m: MembershipContext,
    @CurrentUser() user: SessionUser,
    @Param('practitionerId', new ParseUUIDPipe()) practitionerId: string,
    @Body(new ZodValidationPipe(PractitionerProfileUpdateSchema)) body: PractitionerProfileUpdate,
    @Req() req: AuthedRequest,
  ) {
    return this.profiles.update(m, user, practitionerId, body, req.ip);
  }
}
