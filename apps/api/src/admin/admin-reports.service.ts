import { Inject, Injectable } from '@nestjs/common';
import type { ReportDecision, ReportReason } from '@twabibu/contracts';
import { practitionerName } from '../booking/appointment-view.js';
import { ApiException } from '../common/api-exception.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { emailTemplates } from '../notifications/email-templates.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminContext } from './admin.guard.js';
import { AuditService } from './audit.service.js';
import { canDecide, REPORT_REASON_LABELS, statusAfter } from './report-rules.js';

/** Queue of profile reports (SPEC-11 §6, ADMIN-07): ignore, write to the practitioner, or take the profile off the site. */
@Injectable()
export class AdminReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async list(scope: 'open' | 'closed') {
    const rows = await this.prisma.report.findMany({
      where: {
        entityType: 'Practitioner',
        status: scope === 'open' ? { in: ['OPEN', 'IN_REVIEW'] } : 'CLOSED',
      },
      orderBy: { createdAt: scope === 'open' ? 'asc' : 'desc' },
      take: 100,
    });
    const practitioners = await this.prisma.practitioner.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.entityId))] } },
      include: {
        speciality: true,
        organization: { select: { name: true } },
        practices: { include: { practice: { include: { locality: true } } }, take: 1 },
      },
    });
    const reporters = await this.prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.reporterId).filter((x): x is string => !!x) } },
      select: { id: true, email: true },
    });
    // How many open reports each profile has: several people saying the same thing weighs more.
    const counts = await this.prisma.report.groupBy({
      by: ['entityId'],
      where: {
        entityType: 'Practitioner',
        status: { in: ['OPEN', 'IN_REVIEW'] },
        entityId: { in: practitioners.map((p) => p.id) },
      },
      _count: true,
    });
    return rows.map((r) => {
      const p = practitioners.find((x) => x.id === r.entityId);
      const locality = p?.practices[0]?.practice.locality.slug ?? 'comores';
      return {
        id: r.id,
        status: r.status,
        createdAt: r.createdAt,
        reason: r.reason,
        reasonLabel: REPORT_REASON_LABELS[r.reason as ReportReason] ?? r.reason,
        details: r.details,
        reporter: reporters.find((u) => u.id === r.reporterId)?.email ?? null,
        openOnProfile: counts.find((c) => c.entityId === r.entityId)?._count ?? 0,
        practitioner: p
          ? {
              id: p.id,
              name: practitionerName(p),
              speciality: p.speciality.name,
              organization: p.organization.name,
              published: p.isPublished,
              url: `${this.config.APP_URL}/${p.speciality.slug}/${locality}/${p.slug}`,
            }
          : null,
      };
    });
  }

  async decide(admin: AdminContext, id: string, input: ReportDecision) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report || report.entityType !== 'Practitioner')
      throw new ApiException('NOT_FOUND', 'Report not found');
    if (!canDecide(report.status)) throw new ApiException('CONFLICT', 'This report is already closed');
    const practitioner = await this.prisma.practitioner.findUnique({
      where: { id: report.entityId },
      include: { membership: { include: { user: { select: { id: true, email: true } } } } },
    });
    if (!practitioner) throw new ApiException('NOT_FOUND', 'Practitioner not found');

    // Conditional update: two admins deciding at once cannot both act.
    const done = await this.prisma.report.updateMany({
      where: { id, status: report.status },
      data: { status: statusAfter(input.action) },
    });
    if (!done.count) throw new ApiException('CONFLICT', 'This report changed meanwhile');
    if (input.action === 'UNPUBLISH') {
      await this.prisma.practitioner.update({ where: { id: practitioner.id }, data: { isPublished: false } });
      // Other open reports about the same profile are settled by the same decision.
      await this.prisma.report.updateMany({
        where: {
          entityType: 'Practitioner',
          entityId: practitioner.id,
          status: { in: ['OPEN', 'IN_REVIEW'] },
        },
        data: { status: 'CLOSED' },
      });
    }
    if (input.action === 'CONTACT' && practitioner.membership?.user.email) {
      await this.notifications.sendEmail({
        to: practitioner.membership.user.email,
        userId: practitioner.membership.user.id,
        template: 'profile.report-notice',
        email: emailTemplates.profileReportNotice({
          name: practitionerName(practitioner),
          reasonLabel: REPORT_REASON_LABELS[report.reason as ReportReason] ?? 'Information à vérifier',
          url: `${this.config.APP_URL}/pro/connexion`,
        }),
      });
    }
    await this.audit.log({
      actorUserId: admin.userId,
      action: `report.${input.action.toLowerCase()}`,
      entityType: 'Practitioner',
      entityId: practitioner.id,
      organizationId: practitioner.organizationId,
      ip: admin.ip,
      changes: { reportId: id, reason: report.reason },
    });
    return {
      id,
      status: statusAfter(input.action),
      published: input.action === 'UNPUBLISH' ? false : practitioner.isPublished,
    };
  }
}
