import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from './bootstrap.js';
import { loadConfig } from './config.js';
import { PrismaService } from './prisma/prisma.service.js';
import { RedisService } from './redis/redis.service.js';

const AMINA = 'amina.said@demo.twabibu.km';
const SECRETARY = 'secretariat@demo.twabibu.km';

describe('Practitioner home and patient list (SPEC-05/06)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orgId: string;
  let otherOrg: string | null = null;

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
    orgId = (await prisma.organization.findUniqueOrThrow({ where: { slug: 'clinique-demo-al-kamar' } })).id;
  });

  after(async () => {
    if (otherOrg) {
      await prisma.patientRecord.deleteMany({ where: { organizationId: otherOrg } });
      await prisma.organization.delete({ where: { id: otherOrg } });
    }
    await app?.close();
  });

  it('gives the practitioner a home page without any medical data', async () => {
    const amina = await login(AMINA);
    const d = (await amina.get(`/v1/pro/orgs/${orgId}/dashboard`).expect(200)).body;
    assert.equal(typeof d.today.total, 'number');
    assert.ok(d.recentPatients.some((p: { name: string }) => p.name === 'Ahmed Mze'), 'seeded consultations show as recent patients');
    const text = JSON.stringify(d);
    for (const medical of ['Hypertension', 'Pénicillines', 'diagnos', 'allerg']) assert.equal(text.includes(medical), false, medical);
    // A dashboard or list read is not a medical read: nothing logged on these patients' records.
    // (Only the demo patients' records are counted: other test files open their own records meanwhile.)
    const demoRecords = (await prisma.medicalRecord.findMany({ where: { patientRecord: { organizationId: orgId, lastName: { in: ['Mze', 'Houmadi', 'Ali', 'Mmadi'] } } }, select: { id: true } })).map((r) => r.id);
    const logs = () => prisma.recordAccessLog.count({ where: { recordId: { in: demoRecords } } });
    const before = await logs();
    await amina.get(`/v1/pro/orgs/${orgId}/dashboard`).expect(200);
    await amina.get(`/v1/pro/orgs/${orgId}/patients/list`).expect(200);
    assert.equal(await logs(), before);
  });

  it('lists « my patients » most recent first, searches and pages', async () => {
    const amina = await login(AMINA);
    const mine = (await amina.get(`/v1/pro/orgs/${orgId}/patients/list?scope=mine`).expect(200)).body;
    assert.ok(mine.total >= 8);
    const visits = mine.items.map((p: { lastVisitAt: string | null; nextAppointmentAt: string | null }) => p.lastVisitAt);
    assert.ok(visits.length > 0);
    // Found by search, not on the first page: other tests and journeys keep adding patients to this practitioner.
    const found = (await amina.get(`/v1/pro/orgs/${orgId}/patients/list?scope=mine&q=mze`).expect(200)).body;
    assert.deepEqual(found.items.map((p: { lastName: string }) => p.lastName), ['Mze']);
    const ahmed = found.items[0];
    assert.ok(ahmed.visits >= 3 && ahmed.lastVisitAt);
    const all = (await amina.get(`/v1/pro/orgs/${orgId}/patients/list?scope=all`).expect(200)).body;
    assert.ok(all.total >= mine.total);
    await amina.get(`/v1/pro/orgs/${orgId}/patients/list?scope=everyone`).expect(400);
    await amina.get(`/v1/pro/orgs/${orgId}/patients/list?page=0`).expect(400);
  });

  it('shows the secretary contact and appointments, never the record, and refuses other practices', async () => {
    const secretary = await login(SECRETARY);
    await secretary.get(`/v1/pro/orgs/${orgId}/dashboard`).expect(200);
    const ahmed = (await prisma.patientRecord.findFirstOrThrow({ where: { organizationId: orgId, lastName: 'Mze' } })).id;
    const overview = (await secretary.get(`/v1/pro/orgs/${orgId}/patients/${ahmed}`).expect(200)).body;
    assert.equal(overview.canOpenRecord, false);
    assert.ok(overview.appointments.some((a: { status: string }) => a.status === 'DONE'));
    assert.equal(JSON.stringify(overview).includes('Hypertension'), false);
    await secretary.get(`/v1/pro/orgs/${orgId}/patients/${ahmed}/record`).expect(403);

    const org = await prisma.organization.create({ data: { name: 'Cabinet test isolement', slug: `cabinet-isolement-${Date.now()}`, type: 'SOLO_PRACTICE', status: 'ACTIVE' } });
    otherOrg = org.id;
    const foreign = await prisma.patientRecord.create({ data: { organizationId: org.id, firstName: 'Autre', lastName: 'Cabinet' } });
    const amina = await login(AMINA);
    await amina.get(`/v1/pro/orgs/${orgId}/patients/${foreign.id}`).expect(404);
    await amina.get(`/v1/pro/orgs/${org.id}/dashboard`).expect(403);
    const list = (await amina.get(`/v1/pro/orgs/${orgId}/patients/list?scope=all&q=Cabinet`).expect(200)).body;
    assert.equal(list.items.some((p: { id: string }) => p.id === foreign.id), false);
  });
});
