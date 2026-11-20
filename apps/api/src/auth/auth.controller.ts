import { Body, Controller, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { OtpPurpose } from '@twabibu/contracts';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { SESSION_COOKIE, clearCookie, writeCookie } from '../common/cookies.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AuthGuard, CurrentUser } from './auth.guard.js';
import { AuthService, SESSION_TTL_SECONDS } from './auth.service.js';
import { ProSignupService } from '../pro/pro-signup.service.js';
import type { AuthedRequest, SessionUser } from './auth.types.js';

/** E-mail addresses are compared in lower case, without surrounding spaces. */
const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

const RequestSchema = z.object({ email: emailSchema, purpose: OtpPurpose.default('LOGIN') });
const VerifySchema = z.object({ email: emailSchema, purpose: OtpPurpose.default('LOGIN'), code: z.string().regex(/^\d{6}$/) });

const today = () => new Date().toISOString().slice(0, 10);
const SignupSchema = z.object({
  signupToken: z.string().min(20),
  civility: z.enum(['M', 'MME', 'AUTRE']).optional(),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((d) => d >= '1900-01-01' && d <= today(), 'Invalid birth date'),
  acceptTerms: z.literal(true),
  emailReminders: z.boolean().default(true),
});

const ProSignupSchema = z.object({
  signupToken: z.string().min(20),
  kind: z.enum(['INDEPENDENT', 'FACILITY']),
  specialityId: z.string().uuid(),
  title: z.enum(['DR', 'NONE']),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  licenseNumber: z.string().trim().min(3).max(40),
  phone: z.string().trim().min(5).max(30),
  organizationName: z.string().trim().min(2).max(120),
  addressLine: z.string().trim().min(3).max(200),
  localityId: z.string().uuid(),
  acceptTerms: z.literal(true),
});

@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly proSignup: ProSignupService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private meta(req: AuthedRequest) {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }

  private setSession(res: Response, token: string) {
    writeCookie(res, SESSION_COOKIE, token, SESSION_TTL_SECONDS, this.config.NODE_ENV === 'production');
  }

  @Post('otp/request')
  @HttpCode(200)
  @ApiOperation({ summary: 'Envoie un code à 6 chiffres par e-mail (3 demandes par 15 min et par adresse).' })
  async request(@Body(new ZodValidationPipe(RequestSchema)) body: z.infer<typeof RequestSchema>) {
    const result = await this.auth.requestOtp(body.email, body.purpose);
    return { email: body.email, ...result };
  }

  @Post('otp/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Vérifie le code. Connecte un compte existant, sinon renvoie un jeton d’inscription.' })
  async verify(
    @Body(new ZodValidationPipe(VerifySchema)) body: z.infer<typeof VerifySchema>,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.verifyOtp(body.email, body.purpose, body.code, this.meta(req));
    if (result.status === 'LOGGED_IN') {
      this.setSession(res, result.sessionToken);
      return { status: result.status };
    }
    return result;
  }

  @Post('signup/patient')
  @HttpCode(201)
  @ApiOperation({ summary: 'Crée le compte patient après vérification de l’adresse e-mail.' })
  async signup(
    @Body(new ZodValidationPipe(SignupSchema)) body: z.infer<typeof SignupSchema>,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = await this.auth.signupPatient(body, this.meta(req));
    this.setSession(res, token);
    return { status: 'LOGGED_IN' };
  }

  @Post('signup/practitioner')
  @HttpCode(201)
  @ApiOperation({ summary: 'Crée le compte soignant, son cabinet, son agenda et ses motifs ; le profil attend la vérification.' })
  async signupPractitioner(
    @Body(new ZodValidationPipe(ProSignupSchema)) body: z.infer<typeof ProSignupSchema>,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { sessionToken, organizationId } = await this.proSignup.signup(body, this.meta(req));
    this.setSession(res, sessionToken);
    return { status: 'LOGGED_IN', organizationId };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async logout(@CurrentUser() user: SessionUser, @Res({ passthrough: true }) res: Response) {
    await this.auth.revokeSession(user.sessionId);
    clearCookie(res, SESSION_COOKIE, this.config.NODE_ENV === 'production');
    return { status: 'LOGGED_OUT' };
  }
}

