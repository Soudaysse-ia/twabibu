import { CanActivate, ExecutionContext, Injectable, createParamDecorator } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthedRequest } from '../auth/auth.types.js';
import { ApiException } from '../common/api-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isPracticeRole, type MembershipContext, type MembershipPermissions } from './permissions.js';

export interface ProRequest extends AuthedRequest {
  membership?: MembershipContext;
}

/** Signed-in user + membership of the organisation in the URL (`:orgId`). Anything else: 403. */
@Injectable()
export class ProGuard implements CanActivate {
  constructor(
    private readonly auth: AuthGuard,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await this.auth.canActivate(context);
    const req = context.switchToHttp().getRequest<ProRequest>();
    const orgId = req.params.orgId;
    if (!orgId || !/^[0-9a-f-]{36}$/i.test(String(orgId))) throw new ApiException('NOT_FOUND', 'Organization not found');
    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId: req.user!.id, organizationId: String(orgId) } },
      include: { organization: { select: { status: true, type: true } } },
    });
    // A pharmacy owner is not a practice member: Twabibu Pharma has its own routes (PharmaGuard).
    if (!membership || membership.organization.status === 'SUSPENDED' || membership.organization.type === 'PHARMACY') throw new ApiException('FORBIDDEN', 'No access to this organization');
    const ctx: MembershipContext = {
      id: membership.id,
      organizationId: membership.organizationId,
      role: membership.role,
      practitionerId: membership.practitionerId,
      permissions: (membership.permissions ?? {}) as MembershipPermissions,
    };
    if (!isPracticeRole(ctx)) throw new ApiException('FORBIDDEN', 'Practice access only');
    req.membership = ctx;
    return true;
  }
}

export const CurrentMembership = createParamDecorator((_: unknown, context: ExecutionContext): MembershipContext => {
  return context.switchToHttp().getRequest<ProRequest>().membership!;
});
