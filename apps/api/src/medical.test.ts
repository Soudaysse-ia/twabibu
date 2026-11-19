import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from './bootstrap.js';
import { loadConfig } from './config.js';
import { PrismaService } from './prisma/prisma.service.js';
import { RedisService } from './redis/redis.service.js';

const AMINA = 'amina.said@demo.twabibu.km'; // general practitioner, can prescribe
const IBRAHIM = 'ibrahim.mohamed@demo.twabibu.km'; // paediatrician, same clinic
const SECRETARY = 'secretariat@demo.twabibu.km';

describe('Medical record and prescriptions', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orgId: string;
  let recordId: string;
  const cleanup: (() => Promise<unknown>)[] = [];

  async function login(email: string) {
    await app.get(RedisService).client.del(`twabibu:otp-rate:${email}`);
    const agent = request.agent(app.getHttpServer());
    await agent.post('/v1/auth/otp/request').send({ email }).expect(200);
    const res = await agent.post('/v1/auth/otp/verify').send({ email, code: '000000' }).expect(200);
    if (res.body.status !== 'LOGGED_IN') {
      await agent.post('/v1/auth/signup/patient').send({ signupToken: res.body.signupToken, firstName: 'Patiente', lastName: 'Dossier', birthDate: '1988-08-08', acceptTerms: true }).expect(201);
    }
    return agent;
  }
  const url = (path = '') => `/v1/pro/orgs/${orgId}/patients/${recordId}/record${path}`;
  // Several forms share a DCI (tablet, syrup): pick the adult tablet or capsule explicitly.
  const drug = async (dci: string, strength = dci === 'Paracétamol' || dci === 'Amoxicilline' ? '500 mg' : undefined) =>
    (await prisma.drug.findFirstOrThrow({ where: { dci, ...(strength ? { strength } : {}) }, orderBy: { slug: 'asc' } })).id;

  before(async () => {
    app = await createApp(loadConfig({ ...process.env, NODE_ENV: 'test' }));
    await app.init();
    prisma = app.get(PrismaService);
    const amina = await login(AMINA);
    orgId = (await amina.get('/v1/pro/me').expect(200)).body.memberships[0].organizationId;
    const record = await prisma.patientRecord.create({ data: { organizationId: orgId, firstName: 'Fatouma', lastName: 'Dossier-Test', birthDate: new Date('1990-01-01T00:00:00Z') } });
    recordId = record.id;
    cleanup.push(async () => {
      const mr = await prisma.medicalRecord.findUnique({ where: { patientRecordId: recordId } });
      if (mr) {
        await prisma.currentTreatment.deleteMany({ where: { recordId: mr.id } });
        await prisma.prescription.deleteMany({ where: { recordId: mr.id } });
        await prisma.medicalRecord.delete({ where: { id: mr.id } });
      }
      await prisma.appointment.deleteMany({ where: { patientRecordId: recordId } });
      await prisma.patientRecord.delete({ where: { id: recordId } });
    });
  });

  after(async () => {
    for (const fn of cleanup.reverse()) await fn().catch(() => undefined);
    await app?.close();
  });

  it('is closed to secretaries and to anyone outside the clinic', async () => {
    const secretary = await login(SECRETARY);
    assert.equal((await secretary.get(url()).expect(403)).body.code, 'FORBIDDEN');
    await request(app.getHttpServer()).get(url()).expect(401);
    const pharmacy = await prisma.organization.findFirstOrThrow({ where: { type: 'PHARMACY' } });
    const amina = await login(AMINA);
    await amina.get(`/v1/pro/orgs/${pharmacy.id}/patients/${recordId}/record`).expect(403);
  });

  it('records allergies, history and treatments, encrypts free text, and logs each read', async () => {
    const amina = await login(AMINA);
    await amina.post(url('/allergies')).send({ substance: 'Pénicillines', reaction: 'Urticaire géante', severity: 'SEVERE' }).expect(201);
    await amina.post(url('/history')).send({ type: 'MEDICAL', label: 'Hypertension artérielle', occurredOn: '2019-03-01', details: 'Suivie, bien équilibrée sous traitement' }).expect(201);
    const s = (await amina.post(url('/treatments')).send({ label: 'Amlodipine 5 mg', posology: '1 comprimé le matin' }).expect(201)).body;
    assert.equal(s.allergies[0].substance, 'Pénicillines');
    assert.equal(s.history[0].details, 'Suivie, bien équilibrée sous traitement');
    assert.equal(s.treatments[0].label, 'Amlodipine 5 mg');

    const raw = await prisma.medicalHistoryItem.findFirstOrThrow({ where: { label: 'Hypertension artérielle', organizationId: orgId } });
    assert.ok(raw.detailsEncrypted?.startsWith('v1:'));
    assert.ok(!raw.detailsEncrypted?.includes('équilibrée'));
    const mr = await prisma.medicalRecord.findUniqueOrThrow({ where: { patientRecordId: recordId } });
    assert.ok((await prisma.recordAccessLog.count({ where: { recordId: mr.id } })) >= 1);

    // A colleague of the same clinic sees the shared practice record.
    const ibrahim = await login(IBRAHIM);
    assert.equal((await ibrahim.get(url()).expect(200)).body.allergies.length, 1);
    assert.equal((await amina.post(url('/vitals-unknown')).send({})).status, 404);
  });

  it('saves a consultation with vital signs and closes the appointment', async () => {
    const amina = await login(AMINA);
    const agenda = (await amina.get(`/v1/pro/orgs/${orgId}/agendas`).expect(200)).body[0];
    const appt = await prisma.appointment.create({
      data: { agendaId: agenda.id, motiveId: agenda.motives[0].id, patientRecordId: recordId, startsAt: new Date(Date.now() - 3600_000), endsAt: new Date(Date.now() - 3000_000), status: 'ARRIVED', source: 'WALK_IN', allowOverlap: true },
    });
    const body = {
      appointmentId: appt.id,
      sections: { reason: 'Maux de tête', examination: 'TA 15/9', diagnosis: 'HTA mal contrôlée', plan: 'Contrôle dans 1 mois' },
      diagnoses: [{ label: 'Hypertension artérielle', code: 'I10' }],
      vitals: [
        { type: 'SYSTOLIC_MMHG', value: 150 },
        { type: 'DIASTOLIC_MMHG', value: 90 },
        { type: 'WEIGHT_KG', value: 72.5 },
      ],
      close: true,
    };
    assert.equal((await amina.post(url('/consultations')).send({ ...body, vitals: [{ type: 'TEMPERATURE_C', value: 80 }] }).expect(400)).body.code, 'VALIDATION_FAILED');
    const saved = (await amina.post(url('/consultations')).send(body).expect(201)).body;
    assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status, 'DONE');
    const raw = await prisma.consultation.findUniqueOrThrow({ where: { id: saved.id } });
    assert.ok(!raw.sectionsEncrypted.includes('Maux'));

    const s = (await amina.get(url()).expect(200)).body;
    assert.equal(s.vitals.SYSTOLIC_MMHG.value, 150);
    assert.equal(s.consultations[0].reason, 'Maux de tête');
    const detail = (await amina.get(url(`/consultations/${saved.id}`)).expect(200)).body;
    assert.equal(detail.sections.plan, 'Contrôle dans 1 mois');
  });

  it('blocks an allergy, signs with a justification, and exposes only validity behind the QR code', async () => {
    const amina = await login(AMINA);
    const amox = await drug('Amoxicilline');
    const para = await drug('Paracétamol');
    const lines = [
      { drugId: amox, posologyText: '1 gélule matin, midi et soir pendant 7 jours', durationDays: 7 },
      { drugId: para, posologyText: '1 comprimé si douleur, 3 par jour au maximum' },
    ];
    const alerts = (await amina.post(url('/prescriptions/check')).send({ lines }).expect(200)).body;
    assert.deepEqual(alerts.map((a: { type: string; lineIndex: number }) => [a.type, a.lineIndex]), [['ALLERGY', 0]]);

    const refused = await amina.post(url('/prescriptions')).send({ lines }).expect(422);
    assert.equal(refused.body.code, 'ALLERGY_CONFLICT');
    await amina.post(url('/prescriptions')).send({ lines, allergyOverride: { justification: 'ok' } }).expect(422);

    const signed = (await amina.post(url('/prescriptions')).send({ lines: [lines[1]] }).expect(201)).body;
    assert.match(signed.qrCode, /^[A-Z2-9]{10}$/);
    const doc = (await amina.get(`/v1/pro/orgs/${orgId}/prescriptions/${signed.id}`).expect(200)).body;
    assert.equal(doc.prescriber.name, 'Dr Amina Saïd');
    assert.equal(doc.patient.lastName, 'Dossier-Test');
    assert.equal(doc.lines[0].label, 'Paracétamol 500 mg');

    // Paracetamol is now a current treatment: prescribing it again only warns.
    const again = (await amina.post(url('/prescriptions/check')).send({ lines: [lines[1]] }).expect(200)).body;
    assert.deepEqual(again.map((a: { type: string }) => a.type), ['ALREADY_TREATED']);

    const forced = (await amina.post(url('/prescriptions')).send({ lines, allergyOverride: { justification: 'Allergie ancienne non confirmée, test cutané négatif' } }).expect(201)).body;
    assert.ok(await prisma.auditLog.findFirst({ where: { entityId: forced.id, action: 'prescription.signed_with_allergy_override' } }));

    const publicView = (await request(app.getHttpServer()).get(`/v1/o/${signed.qrCode}`).expect(200)).body;
    assert.equal(publicView.valid, true);
    assert.equal(publicView.prescriber.name, 'Dr Amina Saïd');
    assert.equal(JSON.stringify(publicView).includes('Paracétamol'), false);
    assert.equal(JSON.stringify(publicView).includes('Dossier-Test'), false);
    await request(app.getHttpServer()).get('/v1/o/AAAAAAAAAA').expect(404);
    await request(app.getHttpServer()).get('/v1/o/<script>').expect(404);

    const secretary = await login(SECRETARY);
    await secretary.get(`/v1/pro/orgs/${orgId}/prescriptions/${signed.id}`).expect(403);
    const search = (await request(app.getHttpServer()).get('/v1/directory/drugs?q=augment').expect(200)).body;
    assert.equal(search[0].dci, 'Amoxicilline + acide clavulanique');
  });

  it('shares a patient account record with another practice only after consent, and shows the patient who looked', async () => {
    const address = `dossier-${Date.now()}@test.twabibu.km`;
    const patient = await login(address);
    const profile = await prisma.patientProfile.findFirstOrThrow({ where: { user: { email: address } } });
    // The same person has a file in the demo clinic and in a second, fictional practice.
    const other = await prisma.organization.create({ data: { name: 'Cabinet test consentement', slug: `cabinet-test-${Date.now()}`, type: 'SOLO_PRACTICE', status: 'ACTIVE' } });
    const ibrahimUser = await prisma.user.findUniqueOrThrow({ where: { email: IBRAHIM }, include: { memberships: true } });
    const membership = await prisma.membership.create({ data: { userId: ibrahimUser.id, organizationId: other.id, role: 'PRACTITIONER', practitionerId: null } });
    const [fileA, fileB] = await Promise.all([
      prisma.patientRecord.create({ data: { organizationId: orgId, patientProfileId: profile.id, firstName: 'Patiente', lastName: 'Dossier' } }),
      prisma.patientRecord.create({ data: { organizationId: other.id, patientProfileId: profile.id, firstName: 'Patiente', lastName: 'Dossier' } }),
    ]);
    cleanup.push(async () => {
      const mr = await prisma.medicalRecord.findUnique({ where: { patientProfileId: profile.id } });
      if (mr) await prisma.medicalRecord.delete({ where: { id: mr.id } });
      await prisma.patientRecord.deleteMany({ where: { id: { in: [fileA.id, fileB.id] } } });
      await prisma.membership.delete({ where: { id: membership.id } });
      await prisma.organization.delete({ where: { id: other.id } });
      await prisma.user.delete({ where: { email: address } });
      await prisma.notification.deleteMany({ where: { recipient: address } });
      await prisma.otpCode.deleteMany({ where: { recipient: address } });
    });

    const amina = await login(AMINA);
    await amina.post(`/v1/pro/orgs/${orgId}/patients/${fileA.id}/record/allergies`).send({ substance: 'Arachide', severity: 'SEVERE' }).expect(201);

    // In the second practice, Ibrahim needs a practitioner link to open records at all.
    const ibrahim = await login(IBRAHIM);
    await ibrahim.get(`/v1/pro/orgs/${other.id}/patients/${fileB.id}/record`).expect(403);
    const practitioner = await prisma.practitioner.findFirstOrThrow({ where: { firstName: 'Ibrahim' } });
    // A practitioner is linked to one membership at a time: move Ibrahim's link to the second practice for the test.
    const original = ibrahimUser.memberships[0]!;
    await prisma.membership.update({ where: { id: original.id }, data: { practitionerId: null } });
    await prisma.membership.update({ where: { id: membership.id }, data: { practitionerId: practitioner.id } });
    cleanup.push(async () => {
      await prisma.membership.update({ where: { id: membership.id }, data: { practitionerId: null } });
      await prisma.membership.update({ where: { id: original.id }, data: { practitionerId: practitioner.id } });
    });

    const before = (await ibrahim.get(`/v1/pro/orgs/${other.id}/patients/${fileB.id}/record`).expect(200)).body;
    assert.equal(before.shared, false);
    assert.equal(before.allergies.length, 0, 'no consent: the other practice sees nothing written by the clinic');

    const consents = (await patient.get('/v1/me/record/consents').expect(200)).body;
    assert.equal(consents.length, 2);
    await patient.post(`/v1/me/record/consents/${other.id}`).expect(200);
    const afterConsent = (await ibrahim.get(`/v1/pro/orgs/${other.id}/patients/${fileB.id}/record`).expect(200)).body;
    assert.equal(afterConsent.shared, true);
    assert.equal(afterConsent.allergies[0].substance, 'Arachide');

    // Revoking closes the record again.
    await patient.delete(`/v1/me/record/consents/${other.id}`).expect(200);
    assert.equal((await ibrahim.get(`/v1/pro/orgs/${other.id}/patients/${fileB.id}/record`).expect(200)).body.allergies.length, 0);
    const log = (await patient.get('/v1/me/record/access-log').expect(200)).body;
    assert.ok(log.some((l: { organization: string }) => l.organization === 'Cabinet test consentement'));
    assert.ok(log.some((l: { organization: string }) => l.organization === 'Clinique de démonstration Al-Kamar'));
  });
});
