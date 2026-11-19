import { Inject, Injectable } from '@nestjs/common';
import type { SessionUser } from '../auth/auth.types.js';
import { ApiException } from '../common/api-exception.js';
import { FIELD_CRYPTO, type FieldCrypto } from '../common/field-crypto.js';
import { newTotpSecret, otpauthUri, verifyTotp } from '../common/totp.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { areasFor, mfaFresh } from './admin-roles.js';
import { AuditService } from './audit.service.js';

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 600;

/** Back-office sign-in, step 2: TOTP enrolment and check (SPEC-11: 2FA mandatory). Step 1 is the e-mail code. */
@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    @Inject(FIELD_CRYPTO) private readonly crypto: FieldCrypto,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private requireAdmin(user: SessionUser) {
    if (user.kind !== 'PLATFORM_ADMIN') throw new ApiException('FORBIDDEN', 'Back-office only');
  }

  /** Local testing without a phone app: same rule as the e-mail code (never in production, see config.ts). */
  private get devCodeAllowed() {
    return this.config.EMAIL_PROVIDER === 'fake' && this.config.NODE_ENV !== 'production';
  }

  async me(user: SessionUser) {
    this.requireAdmin(user);
    const [account, session] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true, adminRoles: true, twoFactorEnabledAt: true } }),
      this.prisma.session.findUnique({ where: { id: user.sessionId }, select: { mfaVerifiedAt: true } }),
    ]);
    return {
      email: account.email,
      roles: account.adminRoles,
      areas: areasFor(account.adminRoles),
      mfa: { enrolled: !!account.twoFactorEnabledAt, verified: !!account.twoFactorEnabledAt && mfaFresh(session?.mfaVerifiedAt) },
      devCode: this.devCodeAllowed,
    };
  }

  /** First sign-in: a new secret to scan. Refused once the second factor is active (reset = super admin action). */
  async setup(user: SessionUser) {
    this.requireAdmin(user);
    const account = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (account.twoFactorEnabledAt) throw new ApiException('CONFLICT', 'Second factor already active');
    const secret = newTotpSecret();
    await this.prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: this.crypto.encrypt(secret) } });
    return { secret, otpauthUri: otpauthUri(secret, account.email ?? user.id) };
  }

  async verify(user: SessionUser, code: string, ip: string | null) {
    this.requireAdmin(user);
    const rateKey = `twabibu:admin-mfa:${user.id}`;
    const attempts = await this.redis.client.incr(rateKey);
    if (attempts === 1) await this.redis.client.expire(rateKey, WINDOW_SECONDS);
    if (attempts > MAX_ATTEMPTS) throw new ApiException('OTP_TOO_MANY_ATTEMPTS', 'Too many attempts');
    const account = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!account.twoFactorSecret) throw new ApiException('CONFLICT', 'Set up the second factor first');
    const ok = verifyTotp(this.crypto.decrypt(account.twoFactorSecret), code) || (this.devCodeAllowed && code === '000000');
    if (!ok) {
      await this.audit.log({ actorUserId: user.id, action: 'admin.mfa.failed', entityType: 'User', entityId: user.id, ip });
      throw new ApiException('OTP_INVALID', 'Invalid code');
    }
    await this.redis.client.del(rateKey);
    const now = new Date();
    if (!account.twoFactorEnabledAt) {
      await this.prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabledAt: now } });
      await this.audit.log({ actorUserId: user.id, action: 'admin.mfa.enrolled', entityType: 'User', entityId: user.id, ip });
    }
    await this.prisma.session.update({ where: { id: user.sessionId }, data: { mfaVerifiedAt: now } });
    await this.audit.log({ actorUserId: user.id, action: 'admin.signed_in', entityType: 'User', entityId: user.id, ip });
    return this.me(user);
  }
}
