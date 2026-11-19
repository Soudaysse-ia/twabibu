import { Injectable } from '@nestjs/common';
import type { SessionUser } from '../auth/auth.types.js';
import { ApiException } from '../common/api-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** The patient decides which practices see the whole record, and sees who opened it (SPEC-13 §Carnet). */
@Injectable()
export class ConsentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async myRecord(user: SessionUser) {
    const profileId = user.patientProfileId!;
    return (
      (await this.prisma.medicalRecord.findUnique({ where: { patientProfileId: profileId } })) ??
      (await this.prisma.medicalRecord.create({ data: { patientProfileId: profileId } }))
    );
  }

  async list(user: SessionUser) {
    const record = await this.myRecord(user);
    const [consents, practices] = await Promise.all([
      this.prisma.recordConsent.findMany({ where: { recordId: record.id, revokedAt: null } }),
      // Practices where the patient has a file: the ones they can share with.
      this.prisma.patientRecord.findMany({ where: { patientProfileId: user.patientProfileId!, relativeId: null, deletedAt: null }, include: { organization: { select: { id: true, name: true } } } }),
    ]);
    const unique = [...new Map(practices.map((p) => [p.organization.id, p])).values()];
    return unique.map((p) => ({
      organizationId: p.organization.id,
      organizationName: p.organization.name,
      shared: consents.some((c) => c.organizationId === p.organization.id),
    }));
  }

  async grant(user: SessionUser, organizationId: string) {
    const record = await this.myRecord(user);
    const known = await this.prisma.patientRecord.findFirst({ where: { patientProfileId: user.patientProfileId!, organizationId } });
    if (!known) throw new ApiException('NOT_FOUND', 'You have no file in this practice');
    const existing = await this.prisma.recordConsent.findFirst({ where: { recordId: record.id, organizationId, revokedAt: null } });
    if (!existing) await this.prisma.recordConsent.create({ data: { recordId: record.id, organizationId, grantedVia: 'app' } });
    return this.list(user);
  }

  async revoke(user: SessionUser, organizationId: string) {
    const record = await this.myRecord(user);
    await this.prisma.recordConsent.updateMany({ where: { recordId: record.id, organizationId, revokedAt: null }, data: { revokedAt: new Date() } });
    return this.list(user);
  }

  async accessLog(user: SessionUser) {
    const record = await this.myRecord(user);
    const rows = await this.prisma.recordAccessLog.findMany({ where: { recordId: record.id }, orderBy: { createdAt: 'desc' }, take: 100 });
    const orgs = await this.prisma.organization.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.organizationId))] } }, select: { id: true, name: true } });
    return rows.map((r) => ({ at: r.createdAt.toISOString(), organization: orgs.find((o) => o.id === r.organizationId)?.name ?? '', section: r.section, reason: r.reason }));
  }
}
