import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from './bootstrap.js';
import { loadConfig } from './config.js';
import { PrismaService } from './prisma/prisma.service.js';
import { RedisService } from './redis/redis.service.js';

const stamp = Date.now();
const VERIFIER = `ref-verif-${stamp}@test.twabibu.km`;
const SUPPORT = `ref-support-${stamp}@test.twabibu.km`;
const BASE = '/v1/admin/referentials';

describe('Back-office reference data (SPEC-11 ADMIN-06)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const created = { specialities: [] as string[], localities: [] as string[], drugs: [] as string[], holidays: [] as string[] };

  async function admin(email: string) {
    await app.get(RedisService).client.del(`twabibu:otp-rate:${email}`);
    const agent = request.agent(app.getHttpServer());
    await agent.post('/v1/auth/otp/request').send({ email }).expect(200);
    await agent.post('/v1/auth/otp/verify').send({ email, code: '000000' }).expect(200);
    if (!(await agent.get('/v1/admin/auth/me').expect(200)).body.mfa.enrolled) await agent.post('/v1/admin/auth/mfa/setup').expect(200);
    await agent.post('/v1/admin/auth/mfa/verify').send({ code: '000000' }).expect(200);
    return agent;
  }

  before(async () => {
    app = await createApp(loadConfig({ ...process.env, NODE_ENV: 'test' }));
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.user.createMany({ data: [{ email: VERIFIER, emailVerifiedAt: new Date(), kind: 'PLATFORM_ADMIN', adminRoles: ['VERIFIER'] }, { email: SUPPORT, emailVerifiedAt: new Date(), kind: 'PLATFORM_ADMIN', adminRoles: ['SUPPORT'] }] });
  });

  after(async () => {
    if (prisma) {
      await prisma.pharmacyProduct.deleteMany({ where: { drugId: { in: created.drugs } } });
      await prisma.drug.deleteMany({ where: { id: { in: created.drugs } } });
      await prisma.speciality.deleteMany({ where: { id: { in: created.specialities } } });
      await prisma.locality.deleteMany({ where: { id: { in: created.localities } } });
      await prisma.holiday.deleteMany({ where: { date: { in: created.holidays.map((d) => new Date(`${d}T00:00:00Z`)) } } });
      await prisma.otpCode.deleteMany({ where: { recipient: { in: [VERIFIER, SUPPORT] } } });
      await prisma.user.deleteMany({ where: { email: { in: [VERIFIER, SUPPORT] } } });
    }
    await app?.close();
  });

  it('opens reference data to the verification team only', async () => {
    await (await admin(SUPPORT)).get(`${BASE}/specialities`).expect(403);
    const list = (await (await admin(VERIFIER)).get(`${BASE}/specialities`).expect(200)).body;
    assert.ok(list.find((s: { slug: string; publishedPractitioners: number }) => s.slug === 'medecin-generaliste' && s.publishedPractitioners > 0));
  });

  it('adds a speciality that the site shows within a minute, and protects one in use', async () => {
    const v = await admin(VERIFIER);
    const body = { name: `Orthophoniste ${stamp}`, group: 'PARAMEDICAL', canPrescribe: false, defaultMotives: [{ name: 'Bilan', durationMinutes: 45 }, { name: 'Séance', durationMinutes: 30 }] };
    await v.post(`${BASE}/specialities`).send({ ...body, defaultMotives: [{ name: 'Bilan', durationMinutes: 7 }] }).expect(400);
    const s = (await v.post(`${BASE}/specialities`).send(body).expect(201)).body;
    created.specialities.push(s.id);
    assert.equal(s.slug, `orthophoniste-${stamp}`);
    await v.post(`${BASE}/specialities`).send(body).expect(409);

    const http = request(app.getHttpServer());
    const directory = await http.get('/v1/directory/specialities').expect(200);
    assert.match(String(directory.headers['cache-control']), /max-age=60\b/);
    assert.ok(directory.body.some((x: { slug: string }) => x.slug === s.slug));

    await v.patch(`${BASE}/specialities/${s.id}`).send({ isActive: false }).expect(200);
    assert.ok(!(await http.get('/v1/directory/specialities').expect(200)).body.some((x: { slug: string }) => x.slug === s.slug));
    const gp = (await v.get(`${BASE}/specialities`).expect(200)).body.find((x: { slug: string }) => x.slug === 'medecin-generaliste');
    assert.equal((await v.patch(`${BASE}/specialities/${gp.id}`).send({ isActive: false }).expect(409)).body.code, 'CONFLICT');
    assert.ok(await prisma.auditLog.findFirst({ where: { entityId: s.id, action: 'referential.speciality.updated' } }));
  });

  it('keeps localities inside the Comoros and gives a shared name its island', async () => {
    const v = await admin(VERIFIER);
    const name = `Hamba ${stamp}`;
    await v.post(`${BASE}/localities`).send({ island: 'MWALI', name, lat: 43.7, lng: -12.3, kind: 'village' }).expect(400);
    const a = (await v.post(`${BASE}/localities`).send({ island: 'MWALI', name, lat: -12.3, lng: 43.7, kind: 'village' }).expect(201)).body;
    created.localities.push(a.id);
    await v.post(`${BASE}/localities`).send({ island: 'MWALI', name, lat: -12.31, lng: 43.71, kind: 'village' }).expect(409);
    const b = (await v.post(`${BASE}/localities`).send({ island: 'NDZUANI', name, lat: -12.2, lng: 44.4, kind: 'village' }).expect(201)).body;
    created.localities.push(b.id);
    assert.equal(b.slug, `${a.slug}-ndzuani`);
    const places = (await request(app.getHttpServer()).get(`/v1/search/places?q=${encodeURIComponent(name)}`).expect(200)).body;
    assert.equal(places.localities.length, 2);
    const moroni = (await v.get(`${BASE}/localities?island=ngazidja`).expect(200)).body.find((l: { slug: string }) => l.slug === 'moroni');
    await v.patch(`${BASE}/localities/${moroni.id}`).send({ isActive: false }).expect(409);
  });

  it('moves an estimated holiday to its confirmed date', async () => {
    const v = await admin(VERIFIER);
    created.holidays.push('2031-02-02', '2031-02-03');
    await v.post(`${BASE}/holidays`).send({ date: '2031-02-02', name: 'Fête test', isEstimated: true }).expect(201);
    await v.post(`${BASE}/holidays`).send({ date: '2031-02-02', name: 'Doublon', isEstimated: false }).expect(409);
    const year = (await v.patch(`${BASE}/holidays/2031-02-02`).send({ date: '2031-02-03', isEstimated: false }).expect(200)).body;
    const moved = year.find((h: { name: string }) => h.name === 'Fête test');
    assert.deepEqual(moved, { date: '2031-02-03', name: 'Fête test', isEstimated: false });
    assert.equal((await v.patch(`${BASE}/holidays/2031-02-31`).send({ name: 'Autre' }).expect(400)).body.code, 'VALIDATION_FAILED');
    await v.patch(`${BASE}/holidays/2031-02-27`).send({ name: 'Autre' }).expect(404);
    await v.delete(`${BASE}/holidays/2031-02-03`).expect(204);
    assert.equal(await prisma.holiday.count({ where: { name: 'Fête test' } }), 0);
  });

  it('keeps pharmacy products in line with the drug and stops withdrawn drugs', async () => {
    const v = await admin(VERIFIER);
    const drug = (await v.post(`${BASE}/drugs`).send({ dci: `Testocaine ${stamp}`, strength: '10 mg', form: 'comprimé', route: 'oral', brandNames: ['Testo', 'Testo'], prescriptionOnly: false, controlled: true, essential: false }).expect(201)).body;
    created.drugs.push(drug.id);
    assert.equal(drug.prescriptionOnly, true, 'controlled implies prescription');
    assert.deepEqual(drug.brandNames, ['Testo']);
    await v.post(`${BASE}/drugs`).send({ dci: `Testocaine ${stamp}`, strength: '10 mg', form: 'comprimé', route: 'oral', brandNames: [], prescriptionOnly: true, controlled: false, essential: false }).expect(409);

    const port = await prisma.organization.findUniqueOrThrow({ where: { slug: 'pharmacie-demo-du-port' } });
    const product = await prisma.pharmacyProduct.create({ data: { pharmacyId: port.id, drugId: drug.id, name: 'Testocaine', priceKmf: 1000, prescriptionOnly: true, controlled: true } });
    await v.patch(`${BASE}/drugs/${drug.id}`).send({ controlled: false, prescriptionOnly: false }).expect(200);
    const after = await prisma.pharmacyProduct.findUniqueOrThrow({ where: { id: product.id } });
    assert.deepEqual([after.prescriptionOnly, after.controlled], [false, false]);

    const http = request(app.getHttpServer());
    assert.ok((await http.get(`/v1/directory/drugs?q=testocaine ${stamp}`).expect(200)).body.length === 1);
    await v.patch(`${BASE}/drugs/${drug.id}`).send({ isActive: false }).expect(200);
    assert.equal((await http.get(`/v1/directory/drugs?q=testocaine ${stamp}`).expect(200)).body.length, 0);
    await http.get(`/v1/drugs/${drug.slug}/availability`).expect(404);
    const audit = await prisma.auditLog.findMany({ where: { entityId: drug.id } });
    assert.deepEqual(audit.map((a) => a.action).sort(), ['referential.drug.created', 'referential.drug.updated', 'referential.drug.updated']);
  });
});
