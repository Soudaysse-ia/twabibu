import { CanActivate, ExecutionContext, Injectable, createParamDecorator } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthedRequest } from '../auth/auth.types.js';
import { ApiException } from '../common/api-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type PharmaRole = 'OWNER' | 'ADMIN' | 'PHARMACIST' | 'PHARMACY_STAFF';

export interface PharmaMembership {
  id: string;
  userId: string;
  organizationId: string;
  role: PharmaRole;
  verified: boolean;
}

interface PharmaRequest extends AuthedRequest {
  pharma?: PharmaMembership;
}

const PHARMA_ROLES: readonly string[] = ['OWNER', 'ADMIN', 'PHARMACIST', 'PHARMACY_STAFF'];

/** Pharmacists answer prescriptions and set prices; staff prepare orders and update stock. */
export const isPharmacist = (m: PharmaMembership) => m.role !== 'PHARMACY_STAFF';

/** Signed-in member of the pharmacy in the URL (`:orgId`). A practice, another pharmacy or a patient: 403. */
@Injectable()
export class PharmaGuard implements CanActivate {
  constructor(
    private readonly auth: AuthGuard,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await this.auth.canActivate(context);
    const req = context.switchToHttp().getRequest<PharmaRequest>();
    const orgId = String(req.params.orgId ?? '');
    if (!/^[0-9a-f-]{36}$/i.test(orgId)) throw new ApiException('NOT_FOUND', 'Organization not found');
    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId: req.user!.id, organizationId: orgId } },
      include: { organization: { select: { status: true, type: true, pharmacyProfile: { select: { verifiedAt: true } } } } },
    });
    if (!membership || membership.organization.type !== 'PHARMACY' || membership.organization.status === 'SUSPENDED' || !PHARMA_ROLES.includes(membership.role)) {
      throw new ApiException('FORBIDDEN', 'No access to this pharmacy');
    }
    req.pharma = {
      id: membership.id,
      userId: membership.userId,
      organizationId: orgId,
      role: membership.role as PharmaRole,
      verified: !!membership.organization.pharmacyProfile?.verifiedAt,
    };
    return true;
  }
}

export const CurrentPharma = createParamDecorator((_: unknown, context: ExecutionContext): PharmaMembership => {
  return context.switchToHttp().getRequest<PharmaRequest>().pharma!;
});
