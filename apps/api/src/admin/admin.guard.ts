import { CanActivate, ExecutionContext, Injectable, SetMetadata, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthedRequest } from '../auth/auth.types.js';
import { ApiException } from '../common/api-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { canAccess, mfaFresh, type AdminArea } from './admin-roles.js';

export interface AdminContext {
  userId: string;
  email: string | null;
  roles: string[];
  ip: string | null;
}

interface AdminRequest extends AuthedRequest {
  admin?: AdminContext;
}

const AREA_KEY = 'twabibu:admin-area';
/** Declares which back-office area a controller or route belongs to. */
export const AdminAreaRequired = (area: AdminArea) => SetMetadata(AREA_KEY, area);

/**
 * Back-office access: platform admin, active, second factor validated on this session less than 12 h ago,
 * and a role that opens the area. Anything else: 401 (MFA_REQUIRED in details) or 403.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly auth: AuthGuard,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await this.auth.canActivate(context);
    const req = context.switchToHttp().getRequest<AdminRequest>();
    const user = req.user!;
    if (user.kind !== 'PLATFORM_ADMIN') throw new ApiException('FORBIDDEN', 'Back-office only');
    const [session, account] = await Promise.all([
      this.prisma.session.findUnique({ where: { id: user.sessionId }, select: { mfaVerifiedAt: true } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { adminRoles: true, twoFactorEnabledAt: true } }),
    ]);
    if (!account.twoFactorEnabledAt || !mfaFresh(session?.mfaVerifiedAt)) throw new ApiException('UNAUTHENTICATED', 'Second factor required', { reason: 'MFA_REQUIRED' });
    const area = this.reflector.getAllAndOverride<AdminArea | undefined>(AREA_KEY, [context.getHandler(), context.getClass()]) ?? 'dashboard';
    if (!canAccess(account.adminRoles, area)) throw new ApiException('FORBIDDEN', 'Role does not open this area');
    req.admin = { userId: user.id, email: user.email, roles: account.adminRoles, ip: req.ip ?? null };
    return true;
  }
}

export const CurrentAdmin = createParamDecorator((_: unknown, context: ExecutionContext): AdminContext => {
  return context.switchToHttp().getRequest<AdminRequest>().admin!;
});
