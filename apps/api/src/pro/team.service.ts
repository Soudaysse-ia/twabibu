import { Inject, Injectable } from '@nestjs/common';
import type { InviteMember, SecretaryRights } from '@twabibu/contracts';
import { AuthService } from '../auth/auth.service.js';
import type { SessionUser } from '../auth/auth.types.js';
import { ApiException } from '../common/api-exception.js';
import { randomToken, sha256 } from '../common/crypto.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { emailTemplates } from '../notifications/email-templates.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { canManagePractice, type MembershipContext, type MembershipPermissions } from './permissions.js';
import {
  canEditSecretary,
  canInvite,
  canRemoveMember,
  INVITATION_TTL_DAYS,
  invitationExpiry,
  invitationState,
} from './team-rules.js';

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'titulaire',
  ADMIN: 'administrateur ou administratrice',
  PRACTITIONER: 'praticien ou praticienne',
  SECRETARY: 'secrétaire',
};

type Meta = { userAgent?: string; ip?: string };

/** Team of a practice: members, invitations, arrival and departure (SPEC-07 §Équipe, PRO-05). */
@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly notifications: NotificationsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private requireManager(m: MembershipContext) {
    if (!canManagePractice(m))
      throw new ApiException('FORBIDDEN', 'Team management is for the owner and administrators');
  }

  /** Only rights that make sense for a secretary, with agendas that belong to this practice. */
  private async secretaryPermissions(
    organizationId: string,
    rights: SecretaryRights,
  ): Promise<MembershipPermissions> {
    const permissions: MembershipPermissions = {};
    if (rights.agendaIds?.length) {
      const ids = [...new Set(rights.agendaIds)];
      const found = await this.prisma.agenda.count({
        where: { id: { in: ids }, practitioner: { organizationId } },
      });
      if (found !== ids.length)
        throw new ApiException('VALIDATION_FAILED', 'Unknown agenda', [
          { path: 'agendaIds', message: 'Unknown agenda' },
        ]);
      permissions.agendaIds = ids;
    }
    if (rights.manageSettings) permissions.manageSettings = true;
    return permissions;
  }

  async list(m: MembershipContext) {
    this.requireManager(m);
    const now = new Date();
    const [members, invitations, agendas] = await Promise.all([
      this.prisma.membership.findMany({
        where: { organizationId: m.organizationId },
        include: {
          user: { select: { email: true, lastLoginAt: true } },
          practitioner: { select: { title: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.invitation.findMany({
        where: { organizationId: m.organizationId, acceptedAt: null, revokedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.agenda.findMany({
        where: { practitioner: { organizationId: m.organizationId } },
        select: {
          id: true,
          name: true,
          practitioner: { select: { title: true, firstName: true, lastName: true } },
        },
        orderBy: [{ practitioner: { lastName: 'asc' } }, { name: 'asc' }],
      }),
    ]);
    return {
      you: m.id,
      yourRole: m.role,
      // Several agendas share a name (« Consultations »): the practitioner tells them apart.
      agendas: agendas.map((a) => ({
        id: a.id,
        name: `${[a.practitioner.title, a.practitioner.firstName, a.practitioner.lastName].filter(Boolean).join(' ')} · ${a.name}`,
      })),
      members: members.map((x) => {
        const p = (x.permissions ?? {}) as MembershipPermissions;
        return {
          id: x.id,
          email: x.user.email,
          name: x.practitioner
            ? [x.practitioner.title, x.practitioner.firstName, x.practitioner.lastName]
                .filter(Boolean)
                .join(' ')
            : null,
          role: x.role,
          agendaIds: x.role === 'SECRETARY' ? (p.agendaIds ?? null) : null,
          manageSettings: x.role === 'SECRETARY' ? !!p.manageSettings : null,
          lastLoginAt: x.user.lastLoginAt,
          joinedAt: x.acceptedAt ?? x.createdAt,
          removable: canRemoveMember(m, { id: x.id, role: x.role }),
        };
      }),
      invitations: invitations.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        expiresAt: i.expiresAt,
        state: invitationState(i, now),
      })),
    };
  }

  async invite(m: MembershipContext, actor: SessionUser, body: InviteMember, meta: Meta) {
    this.requireManager(m);
    if (!canInvite(m, body.role))
      throw new ApiException('FORBIDDEN', 'Only the owner can invite an administrator');
    const permissions =
      body.role === 'SECRETARY' ? await this.secretaryPermissions(m.organizationId, body) : {};

    const already = await this.prisma.membership.findFirst({
      where: { organizationId: m.organizationId, user: { email: body.email } },
    });
    if (already) throw new ApiException('CONFLICT', 'Already a member of this practice');

    const token = randomToken();
    const now = new Date();
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: m.organizationId },
      select: { name: true },
    });
    const invitation = await this.prisma.$transaction(async (tx) => {
      // A new invitation to the same address replaces the previous one: only the latest link works.
      await tx.invitation.updateMany({
        where: { organizationId: m.organizationId, email: body.email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: now },
      });
      const created = await tx.invitation.create({
        data: {
          organizationId: m.organizationId,
          email: body.email,
          role: body.role,
          permissions: permissions as object,
          tokenHash: sha256(token),
          invitedById: actor.id,
          expiresAt: invitationExpiry(now),
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          organizationId: m.organizationId,
          action: 'team.invite',
          entityType: 'Invitation',
          entityId: created.id,
          ip: meta.ip ?? null,
          changes: { role: body.role },
        },
      });
      return created;
    });

    await this.notifications.sendEmail({
      to: body.email,
      template: 'team.invitation',
      email: emailTemplates.teamInvitation({
        organizationName: organization.name,
        roleLabel: ROLE_LABELS[body.role]!,
        url: `${this.config.APP_URL}/pro/invitation/${token}`,
        days: INVITATION_TTL_DAYS,
      }),
    });
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      state: 'PENDING' as const,
    };
  }

  async revokeInvitation(m: MembershipContext, actor: SessionUser, id: string, meta: Meta) {
    this.requireManager(m);
    // Scoped to this practice: another practice's invitation reads as not found.
    const done = await this.prisma.invitation.updateMany({
      where: { id, organizationId: m.organizationId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!done.count) throw new ApiException('NOT_FOUND', 'Invitation not found');
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        organizationId: m.organizationId,
        action: 'team.invitation.revoke',
        entityType: 'Invitation',
        entityId: id,
        ip: meta.ip ?? null,
      },
    });
  }

  async updateSecretary(
    m: MembershipContext,
    actor: SessionUser,
    membershipId: string,
    rights: SecretaryRights,
    meta: Meta,
  ) {
    this.requireManager(m);
    const target = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId: m.organizationId },
    });
    if (!target) throw new ApiException('NOT_FOUND', 'Member not found');
    if (!canEditSecretary(m, target))
      throw new ApiException('FORBIDDEN', 'Only a secretary’s rights can be changed here');
    const permissions = await this.secretaryPermissions(m.organizationId, rights);
    await this.prisma.membership.update({
      where: { id: target.id },
      data: { permissions: permissions as object },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        organizationId: m.organizationId,
        action: 'team.member.rights',
        entityType: 'Membership',
        entityId: target.id,
        ip: meta.ip ?? null,
        changes: permissions as object,
      },
    });
    return {
      id: target.id,
      agendaIds: permissions.agendaIds ?? null,
      manageSettings: !!permissions.manageSettings,
    };
  }

  /** Removes a member and signs them out everywhere (SPEC-07): an open session must not keep its access. */
  async removeMember(m: MembershipContext, actor: SessionUser, membershipId: string, meta: Meta) {
    this.requireManager(m);
    const target = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId: m.organizationId },
    });
    if (!target) throw new ApiException('NOT_FOUND', 'Member not found');
    if (!canRemoveMember(m, target))
      throw new ApiException('FORBIDDEN', 'This member cannot be removed by you');
    // A practitioner keeps their agenda and records in the practice: only the access goes.
    await this.prisma.$transaction([
      this.prisma.membership.delete({ where: { id: target.id } }),
      this.prisma.session.updateMany({
        where: { userId: target.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          organizationId: m.organizationId,
          action: 'team.member.remove',
          entityType: 'Membership',
          entityId: target.id,
          ip: meta.ip ?? null,
          changes: { role: target.role },
        },
      }),
    ]);
  }

  private async findByToken(token: string) {
    if (!/^[A-Za-z0-9_-]{20,200}$/.test(token))
      throw new ApiException('INVITATION_INVALID', 'Unknown invitation');
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: sha256(token) },
      include: { organization: { select: { name: true, status: true } } },
    });
    if (!invitation || invitation.organization.status === 'SUSPENDED')
      throw new ApiException('INVITATION_INVALID', 'Unknown invitation');
    return invitation;
  }

  /** What the invitation page shows before signing in: the practice, the role and the invited address. */
  async preview(token: string) {
    const invitation = await this.findByToken(token);
    return {
      organizationName: invitation.organization.name,
      role: invitation.role,
      email: invitation.email,
      state: invitationState(invitation, new Date()),
    };
  }

  /**
   * Joins the practice. Either the visitor is signed in with the invited address, or they just proved it with an
   * e-mail code and hold a sign-up token: then their professional account is created here.
   */
  async accept(
    token: string,
    user: SessionUser | null,
    signupToken: string | undefined,
    meta: Meta,
  ): Promise<{ organizationId: string; sessionToken?: string }> {
    const invitation = await this.findByToken(token);
    const state = invitationState(invitation, new Date());
    if (state === 'EXPIRED') throw new ApiException('INVITATION_EXPIRED', 'Invitation expired');
    if (state !== 'PENDING')
      throw new ApiException('INVITATION_INVALID', 'Invitation already used or cancelled');

    let existingUserId: string | null = null;
    if (user) {
      if (user.email?.toLowerCase() !== invitation.email)
        throw new ApiException('INVITATION_EMAIL_MISMATCH', 'Signed in with another address');
      existingUserId = user.id;
    } else if (signupToken) {
      const email = await this.auth.signupEmail(signupToken);
      if (email !== invitation.email)
        throw new ApiException('INVITATION_EMAIL_MISMATCH', 'Code checked for another address');
    } else {
      throw new ApiException('UNAUTHENTICATED', 'Sign in with the invited address');
    }
    const newAccount = existingUserId === null;

    const userId = await this.prisma.$transaction(async (tx) => {
      // Conditional update: two clicks on the same link cannot create two memberships.
      const claimed = await tx.invitation.updateMany({
        where: { id: invitation.id, acceptedAt: null, revokedAt: null },
        data: { acceptedAt: new Date() },
      });
      if (!claimed.count) throw new ApiException('INVITATION_INVALID', 'Invitation already used');
      // Created in the same transaction: a failed acceptance leaves no account without a practice behind.
      const userId =
        existingUserId ??
        (
          await tx.user.create({
            data: {
              email: invitation.email,
              emailVerifiedAt: new Date(),
              kind: 'PROFESSIONAL',
              lastLoginAt: new Date(),
            },
          })
        ).id;
      const existing = await tx.membership.findUnique({
        where: { userId_organizationId: { userId, organizationId: invitation.organizationId } },
      });
      if (existing) throw new ApiException('CONFLICT', 'Already a member of this practice');
      await tx.membership.create({
        data: {
          userId,
          organizationId: invitation.organizationId,
          role: invitation.role,
          permissions: invitation.permissions ?? {},
          invitedAt: invitation.createdAt,
          acceptedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          organizationId: invitation.organizationId,
          action: 'team.invitation.accept',
          entityType: 'Invitation',
          entityId: invitation.id,
          ip: meta.ip ?? null,
          changes: { role: invitation.role, newAccount },
        },
      });
      return userId;
    });

    const sessionToken =
      newAccount && signupToken ? await this.auth.completeSignup(signupToken, userId, meta) : undefined;
    return { organizationId: invitation.organizationId, sessionToken };
  }
}
