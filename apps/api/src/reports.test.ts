import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ApiErrorSchema } from '@twabibu/contracts';
import { canDecide, statusAfter } from './admin/report-rules.js';
import { createApp } from './bootstrap.js';
import { loadConfig } from './config.js';
import { PrismaService } from './prisma/prisma.service.js';
import { RedisService } from './redis/redis.service.js';

// Profile reports (SPEC-02 PROFILE-06, SPEC-11 ADMIN-07). Needs PostgreSQL and Redis, as in .env.
const stamp = Date.now();
const VERIFIER = `verif-${stamp}@test.twabibu.km`;
const FINANCE = `finance-${stamp}@test.twabibu.km`;
const DOCTOR = `signale-${stamp}@test.twabibu.km`;
const PATIENT = `patient-signal-${stamp}@test.twabibu.km`;
const EMAILS = [VERIFIER, FINANCE, DOCTOR, PATIENT];

describe('Profile reports', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orgId: string;
  let practitionerId: string;
  const slug = `signale-${stamp}`;

  async function login(email: string, admin = false) {
    await app.get(RedisService).client.del(`twabibu:otp-rate:${email}`);
    const agent = request.agent(app.getHttpServer());
    await agent.post('/v1/auth/otp/request').send({ email }).expect(200);
    const res = await agent.post('/v1/auth/otp/verify').send({ email, code: '000000' }).expect(200);
    if (res.body.status === 'SIGNUP_REQUIRED') {
      await agent
        .post('/v1/auth/signup/patient')
        .send({
          signupToken: res.body.signupToken,
          firstName: 'Signal',
          lastName: 'Patient',
          birthDate: '1990-01-01',
          acceptTerms: true,
        })
        .expect(201);
    }
    if (admin) {
      // Enrolled once; later sign-ins only enter the code (000000 outside production).
      if (!(await agent.get('/v1/admin/auth/me').expect(200)).body.mfa.enrolled)
        await agent.post('/v1/admin/auth/mfa/setup').expect(200);
      await agent.post('/v1/admin/auth/mfa/verify').send({ code: '000000' }).expect(200);
    }
    return agent;
  }
  const reportsOf = () =>
    prisma.report.findMany({
      where: { entityType: 'Practitioner', entityId: practitionerId },
      orderBy: { createdAt: 'asc' },
    });

  before(async () => {
    app = await createApp(loadConfig({ ...process.env, NODE_ENV: 'test' }));
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.user.create({
      data: {
        email: VERIFIER,
        emailVerifiedAt: new Date(),
        kind: 'PLATFORM_ADMIN',
        adminRoles: ['VERIFIER'],
      },
    });
    await prisma.user.create({
      data: { email: FINANCE, emailVerifiedAt: new Date(), kind: 'PLATFORM_ADMIN', adminRoles: ['FINANCE'] },
    });
    // A verified, published practitioner of its own, so unpublishing touches no demo profile.
    const speciality = await prisma.speciality.findUniqueOrThrow({ where: { slug: 'medecin-generaliste' } });
    const org = await prisma.organization.create({
      data: {
        name: `Cabinet signalé ${stamp}`,
        slug: `cabinet-signale-${stamp}`,
        type: 'SOLO_PRACTICE',
        status: 'ACTIVE',
      },
    });
    orgId = org.id;
    const p = await prisma.practitioner.create({
      data: {
        organizationId: org.id,
        slug,
        title: 'Dr',
        firstName: 'Signal',
        lastName: `Profil${stamp}`,
        specialityId: speciality.id,
        verificationStatus: 'VERIFIED',
        isPublished: true,
      },
    });
    practitionerId = p.id;
    const doctor = await prisma.user.create({
      data: { email: DOCTOR, emailVerifiedAt: new Date(), kind: 'PROFESSIONAL' },
    });
    await prisma.membership.create({
      data: { userId: doctor.id, organizationId: org.id, role: 'OWNER', practitionerId: p.id },
    });
  });

  // Every request here comes from the same address, and refused ones count too: start each batch from zero.
  const resetLimit = async () => {
    const redis = app.get(RedisService).client;
    const keys = await redis.keys('twabibu:rl:report:*');
    if (keys.length) await redis.del(...keys);
  };
  beforeEach(resetLimit);

  after(async () => {
    if (prisma) {
      await prisma.report.deleteMany({ where: { entityId: practitionerId } });
      await prisma.notification.deleteMany({ where: { recipient: { in: EMAILS } } });
      await prisma.membership.deleteMany({ where: { organizationId: orgId } });
      await prisma.practitioner.deleteMany({ where: { id: practitionerId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
      await prisma.session.deleteMany({ where: { user: { email: { in: EMAILS } } } });
      await prisma.otpCode.deleteMany({ where: { recipient: { in: EMAILS } } });
      await prisma.user.deleteMany({ where: { email: { in: EMAILS } } });
    }
    await app?.close();
  });

  it('keeps « contacter » open and closes the rest', () => {
    assert.equal(statusAfter('CONTACT'), 'IN_REVIEW');
    assert.equal(statusAfter('DISMISS'), 'CLOSED');
    assert.equal(statusAfter('UNPUBLISH'), 'CLOSED');
    assert.equal(canDecide('OPEN'), true);
    assert.equal(canDecide('IN_REVIEW'), true);
    assert.equal(canDecide('CLOSED'), false);
  });

  it('takes a report from anyone, checks it, keeps the reporter only when signed in', async () => {
    const server = app.getHttpServer();
    const url = `/v1/practitioners/${slug}/reports`;
    assert.equal(
      (await request(server).post(url).send({ reason: 'FAKE' }).expect(400)).body.code,
      'VALIDATION_FAILED',
    );
    await request(server)
      .post(url)
      .send({ reason: 'OTHER', details: 'x'.repeat(1001) })
      .expect(400);
    await request(server)
      .post('/v1/practitioners/personne-inconnue/reports')
      .send({ reason: 'OTHER' })
      .expect(404);

    // A robot fills the hidden field: accepted, never stored.
    await request(server).post(url).send({ reason: 'OTHER', website: 'https://spam.example' }).expect(202);
    assert.equal((await reportsOf()).length, 0);

    await resetLimit();
    await request(server)
      .post(url)
      .send({ reason: 'CLOSED', details: 'Le cabinet a fermé en octobre.' })
      .expect(202);
    const patient = await login(PATIENT);
    await patient
      .post(url)
      .send({ reason: 'WRONG_INFO', details: 'Le téléphone ne répond plus.' })
      .expect(202);
    const stored = await reportsOf();
    assert.deepEqual(
      stored.map((r) => r.reason),
      ['CLOSED', 'WRONG_INFO'],
    );
    assert.equal(stored[0]!.reporterId, null);
    assert.ok(stored[1]!.reporterId);
  });

  it('stops a flood of reports from one address', async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < 5; i++)
      await request(server)
        .post(`/v1/practitioners/${slug}/reports`)
        .set('X-Forwarded-For', '41.7.7.7')
        .send({ reason: 'OTHER', website: 'robot' })
        .expect(202);
    const limited = await request(server)
      .post(`/v1/practitioners/${slug}/reports`)
      .set('X-Forwarded-For', '41.7.7.7')
      .send({ reason: 'OTHER' })
      .expect(429);
    assert.equal(ApiErrorSchema.parse(limited.body).code, 'RATE_LIMITED');
  });

  it('shows the queue to verification and support only, and writes to the practitioner without naming the reporter', async () => {
    await (await login(PATIENT)).get('/v1/admin/reports').expect(403);
    await (await login(FINANCE, true)).get('/v1/admin/reports').expect(403);
    const verifier = await login(VERIFIER, true);
    const queue = (await verifier.get('/v1/admin/reports').expect(200)).body.filter(
      (r: { practitioner: { id: string } | null }) => r.practitioner?.id === practitionerId,
    );
    assert.equal(queue.length, 2);
    assert.equal(queue[0].reasonLabel, 'Le cabinet est fermé ou a déménagé');
    // Absolute: the back-office lives on another domain than the site.
    assert.ok(queue[0].practitioner.url.endsWith(`/medecin-generaliste/comores/${slug}`));
    assert.equal(queue[0].openOnProfile, 2);
    assert.equal(queue[1].reporter, PATIENT);

    const contacted = (
      await verifier.post(`/v1/admin/reports/${queue[1].id}/decision`).send({ action: 'CONTACT' }).expect(200)
    ).body;
    assert.equal(contacted.status, 'IN_REVIEW');
    const mail = await prisma.notification.findFirstOrThrow({
      where: { recipient: DOCTOR, template: 'profile.report-notice' },
    });
    const text = (mail.payload as { text: string }).text;
    assert.ok(text.includes('Informations inexactes'));
    assert.ok(
      !text.includes(PATIENT) && !text.includes('téléphone ne répond'),
      'neither the reporter nor the free text',
    );
  });

  it('takes the profile off the site and settles every open report about it', async () => {
    const verifier = await login(VERIFIER, true);
    const [first] = await reportsOf();
    const done = (
      await verifier.post(`/v1/admin/reports/${first!.id}/decision`).send({ action: 'UNPUBLISH' }).expect(200)
    ).body;
    assert.deepEqual(done, { id: first!.id, status: 'CLOSED', published: false });
    assert.equal(
      (await prisma.practitioner.findUniqueOrThrow({ where: { id: practitionerId } })).isPublished,
      false,
    );
    assert.ok((await reportsOf()).every((r) => r.status === 'CLOSED'));
    // Off the site: the profile can no longer be reported, and a closed report cannot be decided again.
    await request(app.getHttpServer())
      .post(`/v1/practitioners/${slug}/reports`)
      .send({ reason: 'OTHER' })
      .expect(404);
    assert.equal(
      (await verifier.post(`/v1/admin/reports/${first!.id}/decision`).send({ action: 'DISMISS' }).expect(409))
        .body.code,
      'CONFLICT',
    );
    const audit = await prisma.auditLog.findMany({
      where: { entityType: 'Practitioner', entityId: practitionerId, action: { startsWith: 'report.' } },
    });
    assert.deepEqual(audit.map((a) => a.action).sort(), ['report.contact', 'report.unpublish']);
  });
});
