import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  AcceptInvitationSchema,
  InviteMemberSchema,
  SecretaryRightsSchema,
  type AcceptInvitation,
  type InviteMember,
  type SecretaryRights,
} from '@twabibu/contracts';
import { CurrentUser, sessionFromRequest } from '../auth/auth.guard.js';
import { AuthService, SESSION_TTL_SECONDS } from '../auth/auth.service.js';
import type { AuthedRequest, SessionUser } from '../auth/auth.types.js';
import { SESSION_COOKIE, writeCookie } from '../common/cookies.js';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import type { MembershipContext } from './permissions.js';
import { CurrentMembership, ProGuard } from './pro.guard.js';
import { TeamService } from './team.service.js';

const meta = (req: AuthedRequest) => ({ userAgent: req.headers['user-agent'], ip: req.ip });

/** Team of a practice (SPEC-07, PRO-05): owner and administrators only, checked in TeamService. */
@ApiTags('pro')
@Controller('v1/pro/orgs/:orgId')
@UseGuards(ProGuard)
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get('members')
  @ApiOperation({
    summary: 'Membres de l’équipe, invitations en attente et agendas (titulaire et administrateurs).',
  })
  list(@CurrentMembership() m: MembershipContext) {
    return this.team.list(m);
  }

  @Post('members/invite')
  @HttpCode(201)
  @ApiOperation({ summary: 'Invite une secrétaire ou un administrateur par e-mail (lien valable 7 jours).' })
  invite(
    @CurrentMembership() m: MembershipContext,
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(InviteMemberSchema)) body: InviteMember,
    @Req() req: AuthedRequest,
  ) {
    return this.team.invite(m, user, body, meta(req));
  }

  @Patch('members/:id')
  @ApiOperation({ summary: 'Droits d’une secrétaire : agendas autorisés, réglages.' })
  update(
    @CurrentMembership() m: MembershipContext,
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(SecretaryRightsSchema)) body: SecretaryRights,
    @Req() req: AuthedRequest,
  ) {
    return this.team.updateSecretary(m, user, id, body, meta(req));
  }

  @Delete('members/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Retire un membre de l’équipe et ferme toutes ses sessions.' })
  async remove(
    @CurrentMembership() m: MembershipContext,
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthedRequest,
  ) {
    await this.team.removeMember(m, user, id, meta(req));
  }

  @Delete('invitations/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Annule une invitation en attente.' })
  async revoke(
    @CurrentMembership() m: MembershipContext,
    @CurrentUser() user: SessionUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthedRequest,
  ) {
    await this.team.revokeInvitation(m, user, id, meta(req));
  }
}

/** The invitation link, before and after signing in. Rate limited: tokens cannot be guessed, and this keeps it so. */
@ApiTags('pro')
@Controller('v1/pro/invitations')
@RateLimit('invitation')
@UseGuards(RateLimitGuard)
export class InvitationsController {
  constructor(
    private readonly team: TeamService,
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get(':token')
  @ApiOperation({ summary: 'Cabinet, rôle et adresse d’une invitation (sans connexion).' })
  preview(@Param('token') token: string) {
    return this.team.preview(token);
  }

  @Post(':token/accept')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Rejoint le cabinet : connecté avec l’adresse invitée, ou avec le jeton d’inscription du code e-mail.',
  })
  async accept(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(AcceptInvitationSchema)) body: AcceptInvitation,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await sessionFromRequest(this.auth, req);
    const result = await this.team.accept(token, user, body.signupToken, meta(req));
    if (result.sessionToken)
      writeCookie(
        res,
        SESSION_COOKIE,
        result.sessionToken,
        SESSION_TTL_SECONDS,
        this.config.NODE_ENV === 'production',
      );
    return { status: 'JOINED', organizationId: result.organizationId };
  }
}
