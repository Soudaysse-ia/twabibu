import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

/** Every back-office action is written here with its actor (SPEC-11 §Critères). Never medical content. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(entry: { actorUserId: string; action: string; entityType: string; entityId?: string | null; organizationId?: string | null; changes?: Prisma.InputJsonValue; ip?: string | null }) {
    return this.prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        organizationId: entry.organizationId ?? null,
        changes: entry.changes,
        ip: entry.ip ?? null,
      },
    });
  }
}
