import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { addDaysToDateKey, toDateKey, weekdayOf, zonedToUtc } from '@twabibu/utils';
import { createApp } from './bootstrap.js';
import { loadConfig } from './config.js';
import { RemindersService } from './notifications/reminders.service.js';
import { PrismaService } from './prisma/prisma.service.js';
import { RedisService } from './redis/redis.service.js';

const AMINA = 'amina.said@demo.twabibu.km';
const SECRETARY = 'secretariat@demo.twabibu.km';
const OWNER = 'direction@demo.twabibu.km';
const stamp = Date.now();
const DESK = `rappel-guichet-${stamp}@test.twabibu.km`;
const ACCOUNT = `rappel-compte-${stamp}@test.twabibu.km`;

describe('Appointment reminders (SPEC-08 NOTIF-05)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let reminders: RemindersService;
  let orgId: string;
  let agenda: { id: string; motives: { id: string }[] };
  let previous: { reminderOffsetsHours: number[]; reminderHour: number; askConfirmation: boolean } | null = null;
  const created = { appointments: [] as string[], records: [] as string[] };

  // A Monday five weeks ahead (other suites use 3 to 4 weeks), local time; « the day before » is the Sunday.
  let day = addDaysToDateKey(toDateKey(new Date()), 35);
  while (weekdayOf(day) !== 1) day = addDaysToDateKey(day, 1);
  const local = (dateKey: string, h: number, m = 0) => zonedToUtc(dateKey, h * 60 + m);
  const sunday = addDaysToDateKey(day, -1);

  async function login(email: string) {
    await app.get(RedisService).client.del(`twabibu:otp-rate:${email}`);
    const agent = request.agent(app.getHttpServer());
    await agent.post('/v1/auth/otp/request').send({ email }).expect(200);
    const res = await agent.post('/v1/auth/otp/verify').send({ email, code: '000000' }).expect(200);
    if (res.body.status !== 'LOGGED_IN') {
      await agent.post('/v1/auth/signup/patient').send({ signupToken: res.body.signupToken, firstName: 'Rappel', lastName: 'Compte', birthDate: '1980-01-01', acceptTerms: true }).expect(201);
    }
    return agent;
  }
  const reminderMails = (appointmentId: string) => prisma.notification.findMany({ where: { relatedAppointmentId: appointmentId, template: 'appointment.reminder' } });

  async function book(agent: request.Agent, hour: number, patient: object) {
    const a = (await agent.post(`/v1/pro/orgs/${orgId}/appointments`).send({ agendaId: agenda.id, motiveId: agenda.motives[0]!.id, startsAt: local(day, hour).toISOString(), notifyPatient: false, ...patient }).expect(201)).body;
    created.appointments.push(a.id);
    created.records.push(a.patient.id);
    return a as { id: string; patient: { id: string }; startsAt: string };
  }

  before(async () => {
    app = await createApp(loadConfig({ ...process.env, NODE_ENV: 'test' }));
    await app.init();
    prisma = app.get(PrismaService);
    reminders = app.get(RemindersService);
    const amina = await login(AMINA);
    orgId = (await amina.get('/v1/pro/me').expect(200)).body.memberships[0].organizationId;
    agenda = (await amina.get(`/v1/pro/orgs/${orgId}/agendas`).expect(200)).body.find((x: { mine: boolean }) => x.mine);
    previous = await prisma.organizationNotificationSettings.findUnique({ where: { organizationId: orgId } });
  });

  after(async () => {
    if (prisma) {
      if (previous) await prisma.organizationNotificationSettings.update({ where: { organizationId: orgId }, data: { reminderOffsetsHours: previous.reminderOffsetsHours, reminderHour: previous.reminderHour, askConfirmation: previous.askConfirmation } });
      else await prisma.organizationNotificationSettings.deleteMany({ where: { organizationId: orgId } });
      await prisma.notification.deleteMany({ where: { relatedAppointmentId: { in: created.appointments } } });
      await prisma.appointment.deleteMany({ where: { id: { in: created.appointments } } });
      await prisma.patientRecord.deleteMany({ where: { id: { in: created.records } } });
      await prisma.notification.deleteMany({ where: { recipient: { in: [DESK, ACCOUNT] } } });
      await prisma.otpCode.deleteMany({ where: { recipient: { in: [DESK, ACCOUNT] } } });
      await prisma.user.deleteMany({ where: { email: { in: [DESK, ACCOUNT] } } });
    }
    await app?.close();
  });

  it('lets only managers change the reminder settings', async () => {
    const secretary = await login(SECRETARY);
    const read = (await secretary.get(`/v1/pro/orgs/${orgId}/notification-settings`).expect(200)).body;
    assert.equal(read.canEdit, false);
    await secretary.put(`/v1/pro/orgs/${orgId}/notification-settings`).send({ reminderOffsetsHours: [24], reminderHour: 17, askConfirmation: true }).expect(403);
    const owner = await login(OWNER);
    await owner.put(`/v1/pro/orgs/${orgId}/notification-settings`).send({ reminderOffsetsHours: [24], reminderHour: 22, askConfirmation: true }).expect(400);
    await owner.put(`/v1/pro/orgs/${orgId}/notification-settings`).send({ reminderOffsetsHours: [6], reminderHour: 17, askConfirmation: true }).expect(400);
    const saved = (await owner.put(`/v1/pro/orgs/${orgId}/notification-settings`).send({ reminderOffsetsHours: [24], reminderHour: 17, askConfirmation: true }).expect(200)).body;
    assert.deepEqual({ ...saved, canEdit: undefined }, { reminderOffsetsHours: [24], reminderHour: 17, askConfirmation: true, canEdit: undefined });
  });

  it('reminds the day before at 17:00, once, never at night, with a working presence link', async () => {
    const amina = await login(AMINA);
    const a = await book(amina, 10, { newPatient: { firstName: 'Rappel', lastName: 'Guichet', email: DESK } });

    await reminders.runDue(local(sunday, 16, 59));
    assert.equal((await reminderMails(a.id)).length, 0, 'not before 17:00');
    await reminders.runDue(local(sunday, 17, 5));
    await reminders.runDue(local(sunday, 17, 20));
    await Promise.all([reminders.runDue(local(sunday, 17, 35)), reminders.runDue(local(sunday, 17, 35))]);
    const mails = await reminderMails(a.id);
    assert.equal(mails.length, 1, 'one reminder, even with runs in parallel');
    assert.equal(mails[0]!.recipient, DESK);
    const text = (mails[0]!.payload as { text: string }).text;
    assert.ok(!text.includes('Consultation'), 'no motive in the reminder');
    const link = text.match(/\/rendez-vous\/([0-9a-f-]+)\/confirmer\?t=([A-Za-z0-9_-]+)/);
    assert.ok(link, 'the practice asked for a confirmation link');
    const [, id, token] = link;

    const http = request(app.getHttpServer());
    await http.get(`/v1/appointments/${id}/presence?t=AAAAAAAAAAAAAAAAAAAAAA`).expect(404);
    const before = (await http.get(`/v1/appointments/${id}/presence?t=${token}`).expect(200)).body;
    assert.equal(before.canConfirm, true);
    assert.equal(JSON.stringify(before).includes('motive'), false);
    const confirmed = (await http.post(`/v1/appointments/${id}/presence`).send({ t: token }).expect(200)).body;
    assert.ok(confirmed.confirmedAt);
    await http.post(`/v1/appointments/${id}/presence`).send({ t: token }).expect(200);
    assert.equal(await prisma.appointmentEvent.count({ where: { appointmentId: id, type: 'CONFIRMED_BY_PATIENT' } }), 1);
    const view = (await amina.get(`/v1/pro/orgs/${orgId}/appointments/${id}`).expect(200)).body;
    assert.ok(view.confirmedByPatientAt);

    // Moved: the old confirmation and the old link no longer count; a new reminder goes out the new day before.
    const tuesday = addDaysToDateKey(day, 1);
    await amina.patch(`/v1/pro/orgs/${orgId}/appointments/${id}`).send({ startsAt: local(tuesday, 10).toISOString(), notifyPatient: false }).expect(200);
    assert.equal((await amina.get(`/v1/pro/orgs/${orgId}/appointments/${id}`).expect(200)).body.confirmedByPatientAt, null);
    await http.get(`/v1/appointments/${id}/presence?t=${token}`).expect(404);
    await reminders.runDue(local(day, 22, 0));
    assert.equal((await reminderMails(a.id)).length, 1, 'quiet hours: nothing at 22:00');
    await reminders.runDue(local(tuesday, 7, 30));
    assert.equal((await reminderMails(a.id)).length, 2, 'caught up at 07:30 after the night');
  });

  it('respects the patient who switched reminders off', async () => {
    const patient = await login(ACCOUNT);
    assert.deepEqual((await patient.get('/v1/me/notification-preferences').expect(200)).body, { reminders: true });
    assert.deepEqual((await patient.put('/v1/me/notification-preferences').send({ reminders: false }).expect(200)).body, { reminders: false });
    await patient.put('/v1/me/notification-preferences').send({ reminders: 'non' }).expect(400);
    const profile = await prisma.patientProfile.findFirstOrThrow({ where: { user: { email: ACCOUNT } } });
    const record = await prisma.patientRecord.create({ data: { organizationId: orgId, patientProfileId: profile.id, firstName: 'Rappel', lastName: 'Compte', email: ACCOUNT } });
    created.records.push(record.id);
    const a = await book(await login(AMINA), 11, { patientRecordId: record.id });
    const report = await reminders.runDue(local(sunday, 17, 5));
    assert.ok(report.optedOut >= 1);
    assert.equal((await reminderMails(a.id)).length, 0);
    await request(app.getHttpServer()).get('/v1/me/notification-preferences').expect(401);
  });
});
