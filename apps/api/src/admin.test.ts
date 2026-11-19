import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from './bootstrap.js';
import { totp } from './common/totp.js';
import { loadConfig } from './config.js';
import { PrismaService } from './prisma/prisma.service.js';
import { RedisService } from './redis/redis.service.js';

const stamp = Date.now();
const SUPER = `super-${stamp}@test.twabibu.km`;
const SUPPORT = `support-${stamp}@test.twabibu.km`;
const DOCTOR = `docteur-${stamp}@test.twabibu.km`;

describe('Back-office (SPEC-11)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orgId: string;
  let practitionerId: string;
  const tempOrgs: string[] = [];
  const cleanup: (() => Promise<unknown>)[] = [];

  async function login(email: string) {
    await app.get(RedisService).client.del(`twabibu:otp-rate:${email}`);
    const agent = request.agent(app.getHttpServer());
    await agent.post('/v1/auth/otp/request').send({ email }).expect(200);
    await agent.post('/v1/auth/otp/verify').send({ email, code: '000000' }).expect(200);
    return agent;
  }

  before(async () => {
    app = await createApp(loadConfig({ ...process.env, NODE_ENV: 'test' }));
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.user.create({ data: { email: SUPER, emailVerifiedAt: new Date(), kind: 'PLATFORM_ADMIN', adminRoles: ['SUPERADMIN'] } });
    await prisma.user.create({ data: { email: SUPPORT, emailVerifiedAt: new Date(), kind: 'PLATFORM_ADMIN', adminRoles: ['SUPPORT'] } });
    // A new solo practice waiting for verification.
    const speciality = await prisma.speciality.findUniqueOrThrow({ where: { slug: 'medecin-generaliste' } });
    const org = await prisma.organization.create({ data: { name: `Cabinet test back-office ${stamp}`, slug: `cabinet-test-bo-${stamp}`, type: 'SOLO_PRACTICE', status: 'PENDING' } });
    orgId = org.id;
    const p = await prisma.practitioner.create({ data: { organizationId: org.id, slug: `test-bo-${stamp}`, title: 'Dr', firstName: 'Test', lastName: `Backoffice${stamp}`, specialityId: speciality.id, verificationStatus: 'PENDING' } });
    practitionerId = p.id;
    const doctor = await prisma.user.create({ data: { email: DOCTOR, emailVerifiedAt: new Date(), kind: 'PROFESSIONAL' } });
    await prisma.membership.create({ data: { userId: doctor.id, organizationId: org.id, role: 'OWNER', practitionerId: p.id } });
    cleanup.push(async () => {
      const users = await prisma.user.findMany({ where: { email: { in: [SUPER, SUPPORT, DOCTOR] } }, select: { id: true } });
      // AuditLog is append-only (database trigger): test entries stay, like any other.
      void users;
      await prisma.notification.deleteMany({ where: { recipient: { in: [SUPER, SUPPORT, DOCTOR] } } });
      await prisma.otpCode.deleteMany({ where: { recipient: { in: [SUPER, SUPPORT, DOCTOR] } } });
      await prisma.practitioner.delete({ where: { id: practitionerId } }).catch(() => undefined);
      await prisma.organization.deleteMany({ where: { id: { in: [orgId, ...tempOrgs] } } });
      await prisma.user.deleteMany({ where: { email: { in: [SUPER, SUPPORT, DOCTOR] } } });
    });
  });

  after(async () => {
    for (const fn of cleanup.reverse()) await fn().catch((e) => console.error(e));
    await app?.close();
  });

  it('requires a platform admin with a second factor, then opens areas by role', async () => {
    const doctor = await login(DOCTOR);
    await doctor.get('/v1/admin/dashboard').expect(403);

    const admin = await login(SUPER);
    const blocked = await admin.get('/v1/admin/dashboard').expect(401);
    assert.equal(blocked.body.details.reason, 'MFA_REQUIRED');
    assert.equal((await admin.get('/v1/admin/auth/me').expect(200)).body.mfa.enrolled, false);
    const { secret, otpauthUri } = (await admin.post('/v1/admin/auth/mfa/setup').expect(200)).body;
    assert.match(otpauthUri, /^otpauth:\/\/totp\//);
    await admin.post('/v1/admin/auth/mfa/verify').send({ code: '123456' }).expect(422);
    const me = (await admin.post('/v1/admin/auth/mfa/verify').send({ code: totp(secret) }).expect(200)).body;
    assert.deepEqual(me.mfa, { enrolled: true, verified: true });
    await admin.post('/v1/admin/auth/mfa/setup').expect(409);
    const stored = await prisma.user.findUniqueOrThrow({ where: { email: SUPER } });
    assert.ok(stored.twoFactorSecret && !stored.twoFactorSecret.includes(secret), 'the secret is stored encrypted');
    const dash = (await admin.get('/v1/admin/dashboard').expect(200)).body;
    assert.ok(dash.practitioners.pending >= 1);

    // Support: dev code 000000 (fake e-mail provider only), patients yes, verification and audit no.
    const support = await login(SUPPORT);
    await support.post('/v1/admin/auth/mfa/setup').expect(200);
    await support.post('/v1/admin/auth/mfa/verify').send({ code: '000000' }).expect(200);
    await support.get('/v1/admin/patients?q=te').expect(200);
    await support.get('/v1/admin/verifications').expect(403);
    await support.get('/v1/admin/audit').expect(403);
    await support.get('/v1/admin/placements').expect(403);
  });

  it('verifies a practitioner with the checklist, tells them and audits it', async () => {
    const admin = await login(SUPER);
    await admin.post('/v1/admin/auth/mfa/verify').send({ code: '000000' }).expect(200);
    const queue = (await admin.get('/v1/admin/verifications').expect(200)).body;
    assert.ok(queue.some((q: { id: string }) => q.id === practitionerId));

    const url = `/v1/admin/practitioners/${practitionerId}/decision`;
    await admin.post(url).send({ decision: 'VERIFIED', checklist: { documentsReadable: true } }).expect(400);
    await admin.post(url).send({ decision: 'CHANGES_REQUESTED' }).expect(400);
    await admin.post(url).send({ decision: 'CHANGES_REQUESTED', message: 'Merci d’envoyer une copie lisible du diplôme.' }).expect(200);
    const file = (await admin
      .post(url)
      .send({ decision: 'VERIFIED', checklist: { documentsReadable: true, nameMatches: true, licenseValid: true, confirmationCall: true } })
      .expect(200)).body;
    assert.equal(file.status, 'VERIFIED');
    assert.equal(file.isPublished, true);
    assert.deepEqual(file.history.map((h: { action: string }) => h.action), ['practitioner.verified', 'practitioner.changes_requested']);
    assert.equal(file.history[0].by, SUPER);
    const mails = await prisma.notification.findMany({ where: { recipient: DOCTOR, template: 'verificationDecision' } });
    assert.equal(mails.length, 2);

    // Suspending the structure unpublishes at once and closes the Pro space; reactivating restores both.
    await admin.post(`/v1/admin/structures/${orgId}/status`).send({ suspend: true, reason: 'Autorisation d’exercer expirée' }).expect(200);
    assert.equal((await prisma.practitioner.findUniqueOrThrow({ where: { id: practitionerId } })).isPublished, false);
    const doctor = await login(DOCTOR);
    await doctor.get(`/v1/pro/orgs/${orgId}/agendas`).expect(403);
    await admin.post(`/v1/admin/structures/${orgId}/status`).send({ suspend: true, reason: 'encore' }).expect(409);
    await admin.post(`/v1/admin/structures/${orgId}/status`).send({ suspend: false, reason: 'Autorisation renouvelée' }).expect(200);
    assert.equal((await prisma.practitioner.findUniqueOrThrow({ where: { id: practitionerId } })).isPublished, true);

    const audit = (await admin.get(`/v1/admin/audit?actor=${encodeURIComponent(SUPER)}`).expect(200)).body;
    for (const action of ['practitioner.verified', 'organization.suspended', 'organization.reactivated', 'admin.mfa.enrolled']) {
      assert.ok(audit.some((a: { action: string; actor: string }) => a.action === action && a.actor === SUPER), action);
    }
    const csv = await admin.get(`/v1/admin/audit.csv?actor=${encodeURIComponent(SUPER)}`).expect(200);
    assert.match(csv.text, /^date;acteur;action/);
  });

  it('never reaches clinical data', async () => {
    const admin = await login(SUPER);
    await admin.post('/v1/admin/auth/mfa/verify').send({ code: '000000' }).expect(200);
    const clinic = await prisma.organization.findFirstOrThrow({ where: { name: 'Clinique de démonstration Al-Kamar' } });
    const record = await prisma.patientRecord.findFirstOrThrow({ where: { organizationId: clinic.id } });
    await admin.get(`/v1/pro/orgs/${clinic.id}/patients/${record.id}/record`).expect(403);
    const patients = (await admin.get('/v1/admin/patients?q=test.twabibu').expect(200)).body;
    if (patients[0]) {
      const res = await admin.get(`/v1/admin/patients/${patients[0].id}`);
      assert.equal(res.status, 200, JSON.stringify(res.body));
      const detail = res.body;
      const keys = new Set(detail.appointments.flatMap((a: object) => Object.keys(a)));
      assert.equal(keys.has('motive'), false);
      assert.equal(JSON.stringify(detail).includes('payload'), false);
    }
    const log = (await admin.get('/v1/admin/notifications?template=otp').expect(200)).body;
    assert.ok(log.every((n: object) => !('payload' in n)), 'sign-in codes are never shown');
  });

  it('keeps the official duty calendar whole and limits sponsored slots', async () => {
    const admin = await login(SUPER);
    await admin.post('/v1/admin/auth/mfa/verify').send({ code: '000000' }).expect(200);
    const bad = (await admin.post('/v1/admin/duties/import').send({ source: 'Test ministère', csv: 'pharmacie;debut;fin\npharmacie-demo-du-port;2030-01-01 19:30;2030-01-02 08:00\ninconnue;2030-01-03 19:30;2030-01-04 08:00' }).expect(200)).body;
    assert.equal(bad.created, 0, 'one wrong line: nothing is written');
    assert.equal(bad.errors[0].line, 3);
    const okRes = await admin.post('/v1/admin/duties/import').send({ source: 'Test ministère', csv: 'pharmacie-demo-du-port;2030-01-01 19:30;2030-01-02 08:00' }).expect(200);
    const ok = okRes.body;
    assert.equal(ok.created, 1, JSON.stringify(ok));
    const duty = (await admin.get('/v1/admin/duties?island=ngazidja&from=2030-01-01').expect(200)).body.find((d: { source: string }) => d.source === 'Test ministère');
    assert.ok(duty);
    const pub = (await request(app.getHttpServer()).get('/v1/pharmacies/on-duty?island=ngazidja&date=2030-01-01').expect(200)).body;
    assert.ok(pub.duties.some((d: { id: string }) => d.id === duty.id));
    await admin.post('/v1/admin/duties').send({ pharmacyId: duty.pharmacyId, startsAt: '2030-01-01 22:00', endsAt: '2030-01-02 06:00', source: 'Test' }).expect(409);
    await admin.delete(`/v1/admin/duties/${duty.id}`).expect(204);

    // Three sponsored pharmacies per island and slot at most.
    const pharmacies = [];
    for (let i = 0; i < 4; i++) {
      const o = await prisma.organization.create({ data: { name: `Pharmacie test ${stamp}-${i}`, slug: `pharmacie-test-${stamp}-${i}`, type: 'PHARMACY', status: 'ACTIVE', pharmacyProfile: { create: { verifiedAt: new Date() } } } });
      tempOrgs.push(o.id);
      pharmacies.push(o.id);
    }
    const slot = { slot: 'DRUG_PAGE', island: 'MWALI', startsOn: '2031-03-01', endsOn: '2031-03-31', priceKmf: 80000 };
    for (const id of pharmacies.slice(0, 3)) await admin.post('/v1/admin/placements').send({ ...slot, pharmacyId: id }).expect(201);
    await admin.post('/v1/admin/placements').send({ ...slot, pharmacyId: pharmacies[0] }).expect(409);
    const full = await admin.post('/v1/admin/placements').send({ ...slot, pharmacyId: pharmacies[3] }).expect(409);
    assert.match(full.body.message, /3 per island/);
    const iconi = await prisma.organization.findUniqueOrThrow({ where: { slug: 'pharmacie-demo-d-iconi' } });
    await admin.post('/v1/admin/placements').send({ ...slot, pharmacyId: iconi.id }).expect(403);
  });
});
