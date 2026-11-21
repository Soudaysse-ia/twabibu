import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from './bootstrap.js';
import { loadConfig } from './config.js';
import { PrismaService } from './prisma/prisma.service.js';
import { RedisService } from './redis/redis.service.js';

// Team and invitations (SPEC-07, PRO-05). Needs the seeded demo practice, PostgreSQL and Redis.
const OWNER = 'direction@demo.twabibu.km';
const SECRETARY = 'secretariat@demo.twabibu.km';
const AMINA = 'amina.said@demo.twabibu.km';

describe('Practice team and invitations', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orgId: string;
  const stamp = Date.now();
  const newcomer = `nouvelle.secretaire.${stamp}@exemple.km`;
  const otherOwner = `autre.cabinet.${stamp}@exemple.km`;
  const emails = [newcomer, otherOwner, `expiree.${stamp}@exemple.km`, `annulee.${stamp}@exemple.km`];
  let otherOrgId: string;

  async function clearLimits(email: string) {
    const redis = app.get(RedisService).client;
    await redis.del(`twabibu:otp-rate:${email}`);
    const keys = await redis.keys('twabibu:rl:invitation:*');
    if (keys.length) await redis.del(...keys);
  }

  async function login(email: string) {
    await clearLimits(email);
    const agent = request.agent(app.getHttpServer());
    await agent.post('/v1/auth/otp/request').send({ email }).expect(200);
    const res = await agent.post('/v1/auth/otp/verify').send({ email, code: '000000' }).expect(200);
    assert.equal(res.body.status, 'LOGGED_IN', `account ${email} missing: run pnpm db:seed`);
    return agent;
  }

  /** The link only exists in the e-mail: read it back from the notification journal. */
  async function invitationToken(email: string): Promise<string> {
    const n = await prisma.notification.findFirstOrThrow({
      where: { recipient: email, template: 'team.invitation' },
      orderBy: { createdAt: 'desc' },
    });
    const token = (n.payload as { text: string }).text.match(/\/pro\/invitation\/([A-Za-z0-9_-]+)/)?.[1];
    assert.ok(token, 'the e-mail carries the invitation link');
    return token;
  }

  before(async () => {
    app = await createApp(loadConfig({ ...process.env, NODE_ENV: 'test' }));
    await app.init();
    prisma = app.get(PrismaService);
    // A second practice, to check that one practice can never act on another's team.
    const user = await prisma.user.create({
      data: { email: otherOwner, emailVerifiedAt: new Date(), kind: 'PROFESSIONAL' },
    });
    const org = await prisma.organization.create({
      data: {
        name: `Autre cabinet ${stamp}`,
        slug: `autre-cabinet-${stamp}`,
        type: 'SOLO_PRACTICE',
        status: 'ACTIVE',
      },
    });
    otherOrgId = org.id;
    await prisma.membership.create({
      data: { userId: user.id, organizationId: org.id, role: 'OWNER', acceptedAt: new Date() },
    });
  });

  after(async () => {
    if (prisma) {
      await prisma.invitation.deleteMany({ where: { email: { in: emails } } });
      await prisma.membership.deleteMany({ where: { user: { email: { in: emails } } } });
      await prisma.session.deleteMany({ where: { user: { email: { in: emails } } } });
      await prisma.notification.deleteMany({ where: { recipient: { in: emails } } });
      await prisma.organization.deleteMany({ where: { id: otherOrgId } });
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
    }
    await app?.close();
  });

  it('shows the team to the owner only', async () => {
    const owner = await login(OWNER);
    orgId = (await owner.get('/v1/pro/me').expect(200)).body.memberships[0].organizationId;
    const team = (await owner.get(`/v1/pro/orgs/${orgId}/members`).expect(200)).body;
    const roles = team.members.map((m: { role: string }) => m.role);
    assert.ok(roles.includes('OWNER') && roles.includes('SECRETARY') && roles.includes('PRACTITIONER'));
    const me = team.members.find((m: { id: string }) => m.id === team.you);
    assert.equal(me.removable, false, 'nobody removes themselves');
    assert.ok(team.agendas.length > 0);

    for (const email of [SECRETARY, AMINA]) {
      const res = await (await login(email)).get(`/v1/pro/orgs/${orgId}/members`).expect(403);
      assert.equal(res.body.code, 'FORBIDDEN');
    }
    // Another practice's owner cannot even open this team.
    await (await login(otherOwner)).get(`/v1/pro/orgs/${orgId}/members`).expect(403);
  });

  it('invites a secretary limited to one agenda, who creates her account from the link', async () => {
    const owner = await login(OWNER);
    const { agendas } = (await owner.get(`/v1/pro/orgs/${orgId}/members`).expect(200)).body;
    const agendaId = agendas[0].id;

    // Wrong inputs: an agenda of another practice, an address already in the team.
    const foreignAgenda = await prisma.agenda.findFirstOrThrow({
      where: { practitioner: { organizationId: { not: orgId } } },
    });
    await owner
      .post(`/v1/pro/orgs/${orgId}/members/invite`)
      .send({ email: newcomer, role: 'SECRETARY', agendaIds: [foreignAgenda.id] })
      .expect(400);
    assert.equal(
      (
        await owner
          .post(`/v1/pro/orgs/${orgId}/members/invite`)
          .send({ email: SECRETARY, role: 'SECRETARY' })
          .expect(409)
      ).body.code,
      'CONFLICT',
    );
    await owner
      .post(`/v1/pro/orgs/${orgId}/members/invite`)
      .send({ email: newcomer, role: 'PRACTITIONER' })
      .expect(400);
    // A secretary cannot invite.
    await (
      await login(SECRETARY)
    )
      .post(`/v1/pro/orgs/${orgId}/members/invite`)
      .send({ email: newcomer, role: 'SECRETARY' })
      .expect(403);

    const invited = (
      await owner
        .post(`/v1/pro/orgs/${orgId}/members/invite`)
        .send({ email: newcomer.toUpperCase(), role: 'SECRETARY', agendaIds: [agendaId] })
        .expect(201)
    ).body;
    assert.equal(invited.email, newcomer, 'addresses are kept in lower case');
    const token = await invitationToken(newcomer);
    assert.equal(
      (await prisma.invitation.findFirstOrThrow({ where: { id: invited.id } })).tokenHash.length,
      64,
      'only the hash of the token is stored',
    );

    await clearLimits(newcomer);
    const server = app.getHttpServer();
    const preview = (await request(server).get(`/v1/pro/invitations/${token}`).expect(200)).body;
    assert.equal(preview.email, newcomer);
    assert.equal(preview.role, 'SECRETARY');
    assert.equal(preview.state, 'PENDING');
    assert.equal(
      (await request(server).get('/v1/pro/invitations/not-a-real-token-at-all-xxxx').expect(404)).body.code,
      'INVITATION_INVALID',
    );

    // Not signed in and no code: refused. Signed in as someone else: refused.
    await request(server).post(`/v1/pro/invitations/${token}/accept`).send({}).expect(401);
    assert.equal(
      (await (await login(AMINA)).post(`/v1/pro/invitations/${token}/accept`).send({}).expect(403)).body.code,
      'INVITATION_EMAIL_MISMATCH',
    );

    // The newcomer proves her address with the e-mail code, then joins: account, membership and session at once.
    const agent = request.agent(server);
    await agent.post('/v1/auth/otp/request').send({ email: newcomer, purpose: 'SIGNUP' }).expect(200);
    const verify = (
      await agent
        .post('/v1/auth/otp/verify')
        .send({ email: newcomer, purpose: 'SIGNUP', code: '000000' })
        .expect(200)
    ).body;
    assert.equal(verify.status, 'SIGNUP_REQUIRED');
    const joined = (
      await agent
        .post(`/v1/pro/invitations/${token}/accept`)
        .send({ signupToken: verify.signupToken })
        .expect(200)
    ).body;
    assert.deepEqual(joined, { status: 'JOINED', organizationId: orgId });

    const me = (await agent.get('/v1/pro/me').expect(200)).body;
    assert.equal(me.memberships[0].role, 'SECRETARY');
    const visible = (await agent.get(`/v1/pro/orgs/${orgId}/agendas`).expect(200)).body;
    assert.deepEqual(
      visible.map((a: { id: string }) => a.id),
      [agendaId],
      'only the agenda she was given',
    );

    // The link works once.
    assert.equal(
      (await agent.post(`/v1/pro/invitations/${token}/accept`).send({}).expect(404)).body.code,
      'INVITATION_INVALID',
    );
  });

  it('refuses expired and cancelled invitations', async () => {
    const owner = await login(OWNER);
    const expiredEmail = emails[2]!;
    const cancelledEmail = emails[3]!;
    await owner
      .post(`/v1/pro/orgs/${orgId}/members/invite`)
      .send({ email: expiredEmail, role: 'SECRETARY' })
      .expect(201);
    await prisma.invitation.updateMany({
      where: { email: expiredEmail },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expiredToken = await invitationToken(expiredEmail);
    await clearLimits(expiredEmail);
    const agent = request.agent(app.getHttpServer());
    await agent.post('/v1/auth/otp/request').send({ email: expiredEmail, purpose: 'SIGNUP' }).expect(200);
    const verify = (
      await agent
        .post('/v1/auth/otp/verify')
        .send({ email: expiredEmail, purpose: 'SIGNUP', code: '000000' })
        .expect(200)
    ).body;
    const expired = await agent
      .post(`/v1/pro/invitations/${expiredToken}/accept`)
      .send({ signupToken: verify.signupToken })
      .expect(410);
    assert.equal(expired.body.code, 'INVITATION_EXPIRED');
    assert.equal(
      await prisma.user.count({ where: { email: expiredEmail } }),
      0,
      'an expired invitation creates no account',
    );

    const cancelled = (
      await owner
        .post(`/v1/pro/orgs/${orgId}/members/invite`)
        .send({ email: cancelledEmail, role: 'SECRETARY' })
        .expect(201)
    ).body;
    const cancelledToken = await invitationToken(cancelledEmail);
    // Another practice cannot cancel it: it does not exist for them.
    await (
      await login(otherOwner)
    )
      .delete(`/v1/pro/orgs/${otherOrgId}/invitations/${cancelled.id}`)
      .expect(404);
    await owner.delete(`/v1/pro/orgs/${orgId}/invitations/${cancelled.id}`).expect(204);
    await clearLimits(cancelledEmail);
    assert.equal(
      (await request(app.getHttpServer()).get(`/v1/pro/invitations/${cancelledToken}`).expect(200)).body
        .state,
      'REVOKED',
    );
  });

  it('lets someone who already has an account join while signed in', async () => {
    const owner = await login(OWNER);
    await owner
      .post(`/v1/pro/orgs/${orgId}/members/invite`)
      .send({ email: otherOwner, role: 'ADMIN' })
      .expect(201);
    const token = await invitationToken(otherOwner);
    const other = await login(otherOwner);
    await other.post(`/v1/pro/invitations/${token}/accept`).send({}).expect(200);
    const roles = (await other.get('/v1/pro/me').expect(200)).body.memberships
      .map((m: { role: string }) => m.role)
      .sort();
    assert.deepEqual(roles, ['ADMIN', 'OWNER']);
  });

  it('changes a secretary’s agendas and removes members, signing them out everywhere', async () => {
    const owner = await login(OWNER);
    const team = (await owner.get(`/v1/pro/orgs/${orgId}/members`).expect(200)).body;
    const newSecretary = team.members.find((m: { email: string }) => m.email === newcomer);
    const practitioner = team.members.find((m: { role: string }) => m.role === 'PRACTITIONER');
    const admin = team.members.find((m: { email: string }) => m.email === otherOwner);

    const updated = (
      await owner
        .patch(`/v1/pro/orgs/${orgId}/members/${newSecretary.id}`)
        .send({ agendaIds: team.agendas.slice(0, 2).map((a: { id: string }) => a.id), manageSettings: true })
        .expect(200)
    ).body;
    assert.equal(updated.agendaIds.length, Math.min(2, team.agendas.length));
    assert.equal(updated.manageSettings, true);
    await owner
      .patch(`/v1/pro/orgs/${orgId}/members/${practitioner.id}`)
      .send({ manageSettings: true })
      .expect(403);

    // The new administrator cannot remove the owner, nor reach members of another practice.
    const asAdmin = await login(otherOwner);
    const ownerRow = team.members.find((m: { role: string }) => m.role === 'OWNER');
    await asAdmin.delete(`/v1/pro/orgs/${orgId}/members/${ownerRow.id}`).expect(403);
    await asAdmin.delete(`/v1/pro/orgs/${otherOrgId}/members/${newSecretary.id}`).expect(404);

    // Removing the secretary closes her sessions at once.
    const secretarySession = await login(newcomer);
    await secretarySession.get('/v1/pro/me').expect(200);
    await owner.delete(`/v1/pro/orgs/${orgId}/members/${newSecretary.id}`).expect(204);
    await secretarySession.get('/v1/pro/me').expect(401);
    await owner.delete(`/v1/pro/orgs/${orgId}/members/${admin.id}`).expect(204);
    assert.equal(
      await prisma.membership.count({ where: { organizationId: orgId, user: { email: { in: emails } } } }),
      0,
    );
  });
});
