import { Inject, Injectable } from '@nestjs/common';
import type { OtpPurpose } from '@twabibu/contracts';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { ApiException } from '../common/api-exception.js';
import { randomOtp, randomToken, sha256 } from '../common/crypto.js';
import { emailTemplates } from '../notifications/email-templates.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import type { SessionUser } from './auth.types.js';

const OTP_TTL_MS = 5 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_REQUESTS = 3;
const OTP_WINDOW_SECONDS = 15 * 60;
const SIGNUP_TTL_SECONDS = 15 * 60;
export const SESSION_TTL_SECONDS = 30 * 24 * 3600;

export type VerifyResult =
  | { status: 'LOGGED_IN'; sessionToken: string }
  | { status: 'SIGNUP_REQUIRED'; signupToken: string };

export interface PatientSignup {
  signupToken: string;
  civility?: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  emailReminders: boolean;
}

/**
 * Everyone signs in with an e-mail address and a 6-digit code received by e-mail (ADR-016, replaces ADR-004).
 * Sessions are opaque random tokens; only their SHA-256 is stored (ADR-014).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private hashCode(email: string, code: string): string {
    return sha256(`${email}:${code}:${this.config.SESSION_SECRET}`);
  }

  async requestOtp(email: string, purpose: OtpPurpose): Promise<{ expiresInSeconds: number }> {
    const rateKey = `twabibu:otp-rate:${email}`;
    const count = await this.redis.client.incr(rateKey);
    if (count === 1) await this.redis.client.expire(rateKey, OTP_WINDOW_SECONDS);
    if (count > OTP_MAX_REQUESTS) throw new ApiException('RATE_LIMITED', 'Too many codes requested for this address');

    // With the fake e-mail provider the code is always 000000, so local testing needs no mailbox.
    const code = this.config.EMAIL_PROVIDER === 'fake' ? '000000' : randomOtp();
    await this.prisma.otpCode.create({ data: { recipient: email, purpose, codeHash: this.hashCode(email, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) } });
    await this.notifications.sendEmail({ to: email, email: emailTemplates.otp(code), template: 'otp' });
    return { expiresInSeconds: OTP_TTL_MS / 1000 };
  }

  async verifyOtp(email: string, purpose: OtpPurpose, code: string, meta: { userAgent?: string; ip?: string }): Promise<VerifyResult> {
    const otp = await this.prisma.otpCode.findFirst({ where: { recipient: email, purpose, consumedAt: null }, orderBy: { createdAt: 'desc' } });
    if (!otp || otp.expiresAt < new Date()) throw new ApiException('OTP_EXPIRED', 'Code expired');
    if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new ApiException('OTP_TOO_MANY_ATTEMPTS', 'Too many attempts');
    if (otp.codeHash !== this.hashCode(email, code)) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new ApiException('OTP_INVALID', 'Invalid code');
    }
    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      if (user.status !== 'ACTIVE') throw new ApiException('FORBIDDEN', 'Account disabled');
      await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), emailVerifiedAt: user.emailVerifiedAt ?? new Date() } });
      return { status: 'LOGGED_IN', sessionToken: await this.createSession(user.id, meta) };
    }
    const signupToken = randomToken();
    await this.redis.client.set(`twabibu:signup:${sha256(signupToken)}`, email, 'EX', SIGNUP_TTL_SECONDS);
    return { status: 'SIGNUP_REQUIRED', signupToken };
  }

  async signupPatient(input: PatientSignup, meta: { userAgent?: string; ip?: string }): Promise<string> {
    const key = `twabibu:signup:${sha256(input.signupToken)}`;
    const email = await this.redis.client.get(key);
    if (!email) throw new ApiException('OTP_EXPIRED', 'Signup token expired, request a new code');
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ApiException('CONFLICT', 'Email already registered');
    const user = await this.prisma.user.create({
      data: {
        email,
        emailVerifiedAt: new Date(),
        kind: 'PATIENT',
        lastLoginAt: new Date(),
        patientProfile: {
          create: { civility: input.civility ?? null, firstName: input.firstName, lastName: input.lastName, birthDate: new Date(`${input.birthDate}T00:00:00Z`) },
        },
        notificationPreferences: { create: { reminderOptOut: !input.emailReminders, sms: false } },
      },
    });
    await this.redis.client.del(key);
    await this.prisma.auditLog.create({ data: { actorUserId: user.id, action: 'patient.signup', entityType: 'User', entityId: user.id, ip: meta.ip ?? null } });
    return this.createSession(user.id, meta);
  }

  private async createSession(userId: string, meta: { userAgent?: string; ip?: string }): Promise<string> {
    const token = randomToken();
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: sha256(token),
        familyId: crypto.randomUUID(),
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
        ip: meta.ip ?? null,
        expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
      },
    });
    return token;
  }

  async resolveSession(token: string): Promise<SessionUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: { include: { patientProfile: { select: { id: true } } } } },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date() || session.user.status !== 'ACTIVE') return null;
    return {
      id: session.user.id,
      kind: session.user.kind,
      phone: session.user.phone,
      email: session.user.email,
      sessionId: session.id,
      patientProfileId: session.user.patientProfile?.id ?? null,
    };
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  }
}
