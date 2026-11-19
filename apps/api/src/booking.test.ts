import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { addDaysToDateKey, toDateKey } from '@twabibu/utils';
import { createApp } from './bootstrap.js';
import { loadConfig } from './config.js';
import { PrismaService } from './prisma/prisma.service.js';

// End-to-end booking flow against the real database (seeded demo data) and Redis.
const email = () => `patient-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.twabibu.km`;

async function signUp(agent: request.Agent, address: string, firstName = 'Test') {
  await agent.post('/v1/auth/otp/request').send({ email: address }).expect(200);
  const verify = await agent.post('/v1/auth/otp/verify').send({ email: address, code: '000000' }).expect(200);
  assert.equal(verify.body.status, 'SIGNUP_REQUIRED');
  await agent
    .post('/v1/auth/signup/patient')
    .send({ signupToken: verify.body.signupToken, civility: 'MME', firstName, lastName: 'Patient', birthDate: '1990-05-14', acceptTerms: true })
    .expect(201);
}

describe('Booking flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const emails: string[] = [];

  before(async () => {
    app = await createApp(loadConfig({ ...process.env, NODE_ENV: 'test' }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  after(async () => {
    if (prisma) {
      const users = await prisma.user.findMany({ where: { email: { in: emails } }, include: { patientProfile: true } });
      const profileIds = users.map((u) => u.patientProfile?.id).filter((id): id is string => !!id);
      await prisma.appointment.deleteMany({ where: { patientProfileId: { in: profileIds } } });
      await prisma.patientRecord.deleteMany({ where: { patientProfileId: { in: profileIds } } });
      await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
      await prisma.notification.deleteMany({ where: { recipient: { in: emails } } });
      await prisma.otpCode.deleteMany({ where: { recipient: { in: emails } } });
    }
    await app?.close();
  });

  it('signs a new patient up with an e-mail address and a code sent by e-mail, without any phone number', async () => {
    const address = email();
    emails.push(address);
    const agent = request.agent(app.getHttpServer());
    await agent.get('/v1/me').expect(401);
    const wrong = await agent.post('/v1/auth/otp/request').send({ email: 'pas-une-adresse' }).expect(400);
    assert.equal(wrong.body.code, 'VALIDATION_FAILED');
    // Spaces and capitals are ignored.
    await agent.post('/v1/auth/otp/request').send({ email: `  ${address.toUpperCase()} ` }).expect(200);
    const sent = await prisma.notification.findFirst({ where: { recipient: address, template: 'otp' } });
    assert.equal(sent?.channel, 'EMAIL');
    assert.equal((sent?.payload as { subject: string }).subject, 'Votre code Twabibu : 000000');
    const bad = await agent.post('/v1/auth/otp/verify').send({ email: address, code: '123456' });
    assert.equal(bad.body.code, 'OTP_INVALID');
    const verify = await agent.post('/v1/auth/otp/verify').send({ email: address, code: '000000' }).expect(200);
    assert.equal(verify.body.status, 'SIGNUP_REQUIRED');
    await agent
      .post('/v1/auth/signup/patient')
      .send({ signupToken: verify.body.signupToken, firstName: 'Amina', lastName: 'Test', birthDate: '1992-03-01', acceptTerms: true })
      .expect(201);
    const me = await agent.get('/v1/me').expect(200);
    assert.equal(me.body.email, address);
    assert.equal(me.body.phone, null);
    assert.equal(me.body.profile.firstName, 'Amina');

    // Second login with the same address goes straight in.
    const again = request.agent(app.getHttpServer());
    await again.post('/v1/auth/otp/request').send({ email: address }).expect(200);
    const login = await again.post('/v1/auth/otp/verify').send({ email: address, code: '000000' }).expect(200);
    assert.equal(login.body.status, 'LOGGED_IN');
    await again.get('/v1/me').expect(200);
    await again.post('/v1/auth/logout').expect(200);
    await again.get('/v1/me').expect(401);
  });

  it('limits codes to 3 per address per 15 minutes', async () => {
    const address = email();
    emails.push(address);
    for (let i = 0; i < 3; i++) await request(app.getHttpServer()).post('/v1/auth/otp/request').send({ email: address }).expect(200);
    const fourth = await request(app.getHttpServer()).post('/v1/auth/otp/request').send({ email: address }).expect(429);
    assert.equal(fourth.body.code, 'RATE_LIMITED');
  });

  it('finds practitioners with their next slots, and their public profile', async () => {
    const res = await request(app.getHttpServer()).get('/v1/search/practitioners?q=medecin-generaliste&ou=moroni').expect(200);
    assert.ok(res.body.total >= 1);
    const first = res.body.items[0];
    assert.equal(first.speciality.slug, 'medecin-generaliste');
    assert.equal(first.days.length, 5);
    assert.match(first.url, /^\/medecin-generaliste\/moroni\/[a-z-]+$/);

    const none = await request(app.getHttpServer()).get('/v1/search/practitioners?q=medecin-generaliste&ou=fomboni').expect(200);
    assert.equal(none.body.total, 0);

    const profile = await request(app.getHttpServer()).get(`/v1/practitioners/${first.slug}`).expect(200);
    assert.equal(profile.body.slug, first.slug);
    assert.ok(profile.body.agenda.motives.length > 0);
    await request(app.getHttpServer()).get('/v1/practitioners/does-not-exist').expect(404);
  });

  it('holds a slot for one visitor, books it, confirms by e-mail, and lets the patient cancel', async () => {
    const search = await request(app.getHttpServer()).get('/v1/search/practitioners?q=pediatre').expect(200);
    const practitioner = search.body.items[0];
    const profile = (await request(app.getHttpServer()).get(`/v1/practitioners/${practitioner.slug}`).expect(200)).body;
    const motive = profile.agenda.motives[0];

    // A slot at least 3 days ahead, so the 24 h cancellation deadline is not reached.
    const from = addDaysToDateKey(toDateKey(new Date()), 3);
    const avail = await request(app.getHttpServer())
      .get(`/v1/practitioners/${practitioner.slug}/availabilities?motiveId=${motive.id}&from=${from}&to=${addDaysToDateKey(from, 7)}`)
      .expect(200);
    const slot = avail.body.days[0].slots[0];
    assert.ok(slot, 'demo agenda should have slots');

    const alice = request.agent(app.getHttpServer());
    const bob = request.agent(app.getHttpServer());
    const body = { agendaId: avail.body.agendaId, motiveId: motive.id, startsAt: slot.startsAt };
    const lock = await alice.post('/v1/booking/locks').send(body).expect(201);
    assert.equal(lock.body.expiresInSeconds, 600);
    const taken = await bob.post('/v1/booking/locks').send(body).expect(409);
    assert.equal(taken.body.code, 'SLOT_UNAVAILABLE');

    // Bob no longer sees the held slot; Alice still does.
    const slotDay = toDateKey(new Date(slot.startsAt));
    const query = `/v1/practitioners/${practitioner.slug}/availabilities?motiveId=${motive.id}&from=${slotDay}&to=${slotDay}`;
    const bobView = (await bob.get(query).expect(200)).body.days.flatMap((d: { slots: { startsAt: string }[] }) => d.slots.map((s) => s.startsAt));
    const aliceView = (await alice.get(query).expect(200)).body.days.flatMap((d: { slots: { startsAt: string }[] }) => d.slots.map((s) => s.startsAt));
    assert.ok(!bobView.includes(slot.startsAt));
    assert.ok(aliceView.includes(slot.startsAt));

    // Booking requires a signed-in patient.
    const anonymous = await alice.post('/v1/booking/appointments').send({ ...body, instructionsAccepted: true }).expect(401);
    assert.equal(anonymous.body.code, 'UNAUTHENTICATED');

    const aliceEmail = email();
    emails.push(aliceEmail);
    await signUp(alice, aliceEmail, 'Alice');
    const booked = await alice
      .post('/v1/booking/appointments')
      .send({ ...body, instructionsAccepted: true, newRelative: { firstName: 'Nour', lastName: 'Patient', birthDate: '2022-02-02', relationship: 'ENFANT' } })
      .expect(201);
    assert.equal(booked.body.status, 'CONFIRMED');
    assert.equal(booked.body.forName, 'Nour Patient');
    assert.equal(booked.body.startsAt, slot.startsAt);
    assert.equal(booked.body.cancellation.allowed, true);

    // The lock is consumed and the slot is gone for everybody.
    const afterView = (await bob.get(query).expect(200)).body.days.flatMap((d: { slots: { startsAt: string }[] }) => d.slots.map((s) => s.startsAt));
    assert.ok(!afterView.includes(slot.startsAt));
    const twice = await alice.post('/v1/booking/appointments').send({ ...body, instructionsAccepted: true }).expect(410);
    assert.equal(twice.body.code, 'SLOT_LOCK_EXPIRED');

    // Confirmation by e-mail: no motive, no medical information.
    const confirmation = await prisma.notification.findFirst({ where: { recipient: aliceEmail, template: 'appointment.booked' } });
    assert.equal(confirmation?.channel, 'EMAIL');
    const mail = confirmation?.payload as { subject: string; text: string; html: string };
    assert.ok(mail.subject.startsWith('Rendez-vous confirmé le '));
    assert.ok(mail.text.startsWith('Bonjour Alice,'));
    assert.ok(!mail.text.toLowerCase().includes(motive.name.toLowerCase()));
    assert.ok(!mail.html.toLowerCase().includes(motive.name.toLowerCase()));

    // The database itself refuses an overlapping appointment on the same agenda.
    const appt = await prisma.appointment.findUniqueOrThrow({ where: { id: booked.body.id } });
    await assert.rejects(prisma.appointment.create({ data: { agendaId: appt.agendaId, motiveId: appt.motiveId, patientRecordId: appt.patientRecordId, startsAt: appt.startsAt, endsAt: appt.endsAt, source: 'PRACTICE' } }));

    const upcoming = await alice.get('/v1/me/appointments?scope=upcoming').expect(200);
    assert.equal(upcoming.body.length, 1);
    const me = await alice.get('/v1/me').expect(200);
    assert.equal(me.body.relatives[0].firstName, 'Nour');

    // Somebody else cannot cancel it.
    const stranger = request.agent(app.getHttpServer());
    const strangerEmail = email();
    emails.push(strangerEmail);
    await signUp(stranger, strangerEmail, 'Stranger');
    await stranger.post(`/v1/me/appointments/${booked.body.id}/cancel`).expect(404);

    const cancelled = await alice.post(`/v1/me/appointments/${booked.body.id}/cancel`).expect(200);
    assert.equal(cancelled.body.status, 'CANCELLED_BY_PATIENT');
    const reopened = (await bob.get(query).expect(200)).body.days.flatMap((d: { slots: { startsAt: string }[] }) => d.slots.map((s) => s.startsAt));
    assert.ok(reopened.includes(slot.startsAt), 'a cancelled slot is bookable again');
    assert.ok(await prisma.notification.findFirst({ where: { recipient: aliceEmail, template: 'appointment.cancelled_by_patient', channel: 'EMAIL' } }));
  });
});
