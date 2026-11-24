import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { addDaysToDateKey, toDateKey, weekdayOf, zonedToUtc } from '@twabibu/utils';
import { createApp } from './bootstrap.js';
import { loadConfig } from './config.js';
import { PrismaService } from './prisma/prisma.service.js';
import { RedisService } from './redis/redis.service.js';

// Practice space against the seeded demo clinic (see prisma/seed.ts).
const AMINA = 'amina.said@demo.twabibu.km'; // general practitioner
const SECRETARY = 'secretariat@demo.twabibu.km';
const OWNER = 'direction@demo.twabibu.km';

describe('Practice space', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orgId: string;
  const created = { appointments: [] as string[], records: [] as string[], absences: [] as string[], phones: [] as string[] };
  const restore: (() => Promise<void>)[] = [];

  async function login(email: string) {
    await app.get(RedisService).client.del(`twabibu:otp-rate:${email}`);
    const agent = request.agent(app.getHttpServer());
    await agent.post('/v1/auth/otp/request').send({ email }).expect(200);
    const res = await agent.post('/v1/auth/otp/verify').send({ email, code: '000000' }).expect(200);
    assert.equal(res.body.status, 'LOGGED_IN', `demo account ${email} missing: run pnpm db:seed`);
    return agent;
  }

  // A Monday three weeks ahead, at 13:00 local: outside the seeded appointments.
  function freeMonday(hour = 13, extraWeeks = 0) {
    let day = addDaysToDateKey(toDateKey(new Date()), 21 + 7 * extraWeeks);
    while (weekdayOf(day) !== 1) day = addDaysToDateKey(day, 1);
    return { day, at: (h = hour, m = 0) => zonedToUtc(day, h * 60 + m).toISOString() };
  }
  const randomPhone = () => {
    const p = `+2693${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`;
    created.phones.push(p);
    return p;
  };

  before(async () => {
    app = await createApp(loadConfig({ ...process.env, NODE_ENV: 'test' }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  after(async () => {
    if (prisma) {
      for (const fn of restore) await fn();
      await prisma.absence.deleteMany({ where: { id: { in: created.absences } } });
      await prisma.appointment.deleteMany({ where: { id: { in: created.appointments } } });
      await prisma.appointment.deleteMany({ where: { patientRecordId: { in: created.records } } });
      await prisma.patientRecord.deleteMany({ where: { id: { in: created.records } } });
      await prisma.notification.deleteMany({ where: { recipient: { in: created.phones } } });
    }
    await app?.close();
  });

  it('lists the memberships of a professional and refuses patients and other organisations', async () => {
    const amina = await login(AMINA);
    const me = (await amina.get('/v1/pro/me').expect(200)).body;
    assert.equal(me.memberships.length, 1);
    assert.equal(me.memberships[0].role, 'PRACTITIONER');
    assert.equal(me.memberships[0].displayName, 'Dr Amina Saïd');
    orgId = me.memberships[0].organizationId;

    const pharmacy = await prisma.organization.findFirstOrThrow({ where: { type: 'PHARMACY' } });
    assert.equal((await amina.get(`/v1/pro/orgs/${pharmacy.id}/agendas`).expect(403)).body.code, 'FORBIDDEN');
    await request(app.getHttpServer()).get(`/v1/pro/orgs/${orgId}/agendas`).expect(401);
  });

  it('shows each role the agendas it may see', async () => {
    const amina = await login(AMINA);
    const secretary = await login(SECRETARY);
    const owner = await login(OWNER);
    const mine = (await amina.get(`/v1/pro/orgs/${orgId}/agendas`).expect(200)).body;
    assert.equal(mine.length, 1);
    assert.equal(mine[0].practitioner.name, 'Dr Amina Saïd');
    assert.equal((await secretary.get(`/v1/pro/orgs/${orgId}/agendas`).expect(200)).body.length, 6);
    assert.equal((await owner.get(`/v1/pro/orgs/${orgId}/agendas`).expect(200)).body.length, 6);
  });

  it('returns the week grid with online windows and appointments', async () => {
    const secretary = await login(SECRETARY);
    const from = toDateKey(new Date());
    const res = (await secretary.get(`/v1/pro/orgs/${orgId}/agenda/events?from=${from}&to=${addDaysToDateKey(from, 6)}`).expect(200)).body;
    assert.equal(res.agendaIds.length, 6);
    assert.ok(res.windows.length > 0, 'seeded online windows');
    assert.ok(res.appointments.length > 0, 'seeded appointments');
    assert.ok(res.appointments.every((a: { patient: { firstName: string } }) => a.patient.firstName));
    await secretary.get(`/v1/pro/orgs/${orgId}/agenda/events?from=${from}&to=${addDaysToDateKey(from, 60)}`).expect(400);
  });

  it('books by phone, refuses double booking, and lets only practitioners overbook', async () => {
    const secretary = await login(SECRETARY);
    const amina = await login(AMINA);
    const agendas = (await secretary.get(`/v1/pro/orgs/${orgId}/agendas`).expect(200)).body;
    const agenda = agendas.find((a: { practitioner: { name: string } }) => a.practitioner.name === 'Dr Amina Saïd');
    const { at } = freeMonday();
    const phone = randomPhone();
    const body = { agendaId: agenda.id, motiveId: agenda.motives[0].id, startsAt: at(), source: 'PHONE' };

    const first = (await secretary.post(`/v1/pro/orgs/${orgId}/appointments`).send({ ...body, newPatient: { firstName: 'Zaharia', lastName: 'Test', phone: phone.slice(4) } }).expect(201)).body;
    created.appointments.push(first.id);
    created.records.push(first.patient.id);
    assert.equal(first.status, 'CONFIRMED');
    assert.equal(first.patient.phone, phone);
    // Registered at the desk with a phone only: SMS fallback.
    assert.equal((await prisma.notification.findFirst({ where: { recipient: phone, template: 'appointment.booked' } }))?.channel, 'SMS');

    const clash = await secretary.post(`/v1/pro/orgs/${orgId}/appointments`).send({ ...body, patientRecordId: first.patient.id }).expect(409);
    assert.equal(clash.body.code, 'SLOT_UNAVAILABLE');
    assert.equal(clash.body.details.with, 'Zaharia Test');
    assert.equal((await secretary.post(`/v1/pro/orgs/${orgId}/appointments`).send({ ...body, patientRecordId: first.patient.id, force: true }).expect(403)).body.code, 'FORBIDDEN');

    const forced = (await amina.post(`/v1/pro/orgs/${orgId}/appointments`).send({ ...body, patientRecordId: first.patient.id, force: true, notifyPatient: false }).expect(201)).body;
    created.appointments.push(forced.id);
    assert.equal(forced.allowOverlap, true);

    // Registered with an e-mail: the confirmation goes by e-mail, not SMS.
    const mailPatient = `desk-${Date.now()}@test.twabibu.km`;
    created.phones.push(mailPatient);
    const byMail = (await secretary.post(`/v1/pro/orgs/${orgId}/appointments`).send({ ...body, startsAt: freeMonday(17).at(), newPatient: { firstName: 'Nadia', lastName: 'Courriel', email: mailPatient, phone: randomPhone() } }).expect(201)).body;
    created.appointments.push(byMail.id);
    created.records.push(byMail.patient.id);
    assert.equal((await prisma.notification.findFirst({ where: { relatedAppointmentId: byMail.id } }))?.channel, 'EMAIL');

    const found = (await secretary.get(`/v1/pro/orgs/${orgId}/patients?q=zahar`).expect(200)).body;
    assert.ok(found.some((p: { id: string }) => p.id === first.patient.id));
    const byPhone = (await secretary.get(`/v1/pro/orgs/${orgId}/patients?q=${phone.slice(-4)}`).expect(200)).body;
    assert.ok(byPhone.some((p: { id: string }) => p.id === first.patient.id));
  });

  it('changes status, counts no-shows, moves with an SMS, and keeps practitioners out of colleagues’ agendas', async () => {
    const secretary = await login(SECRETARY);
    const amina = await login(AMINA);
    const agendas = (await secretary.get(`/v1/pro/orgs/${orgId}/agendas`).expect(200)).body;
    const agenda = agendas.find((a: { practitioner: { name: string } }) => a.practitioner.name === 'Dr Amina Saïd');
    const other = agendas.find((a: { practitioner: { name: string } }) => a.practitioner.name !== 'Dr Amina Saïd');
    const { at } = freeMonday(14);
    const phone = randomPhone();

    const appt = (await secretary.post(`/v1/pro/orgs/${orgId}/appointments`).send({ agendaId: agenda.id, motiveId: agenda.motives[0].id, startsAt: at(), newPatient: { firstName: 'Ali', lastName: 'Statut', phone } }).expect(201)).body;
    created.appointments.push(appt.id);
    created.records.push(appt.patient.id);

    const arrived = (await secretary.patch(`/v1/pro/orgs/${orgId}/appointments/${appt.id}`).send({ status: 'ARRIVED' }).expect(200)).body;
    assert.equal(arrived.status, 'ARRIVED');
    assert.equal((await secretary.patch(`/v1/pro/orgs/${orgId}/appointments/${appt.id}`).send({ status: 'NO_SHOW' }).expect(409)).body.code, 'CONFLICT');
    await secretary.patch(`/v1/pro/orgs/${orgId}/appointments/${appt.id}`).send({ status: 'CONFIRMED' }).expect(200);
    // Not before the appointment time: a no-show counts against the patient (SPEC-05 §Règles 4).
    assert.equal((await secretary.patch(`/v1/pro/orgs/${orgId}/appointments/${appt.id}`).send({ status: 'NO_SHOW' }).expect(409)).body.code, 'CONFLICT');
    await prisma.appointment.update({ where: { id: appt.id }, data: { startsAt: new Date(Date.now() - 400 * 86_400_000), endsAt: new Date(Date.now() - 400 * 86_400_000 + 1_800_000) } }); // far from the demo history
    const noShow = (await secretary.patch(`/v1/pro/orgs/${orgId}/appointments/${appt.id}`).send({ status: 'NO_SHOW' }).expect(200)).body;
    assert.equal(noShow.patient.noShowCount, 1);
    const back = (await secretary.patch(`/v1/pro/orgs/${orgId}/appointments/${appt.id}`).send({ status: 'CONFIRMED' }).expect(200)).body;
    assert.equal(back.patient.noShowCount, 0);

    const moved = (await secretary.patch(`/v1/pro/orgs/${orgId}/appointments/${appt.id}`).send({ startsAt: at(15, 30) }).expect(200)).body;
    assert.equal(moved.startsAt, at(15, 30));
    const sms = await prisma.notification.findFirst({ where: { recipient: phone, template: 'appointment.rescheduled' } });
    assert.ok((sms?.payload as { text: string }).text.includes('deplace'));

    const history = (await secretary.get(`/v1/pro/orgs/${orgId}/appointments/${appt.id}/history`).expect(200)).body;
    assert.deepEqual(history.events.map((e: { type: string }) => e.type), ['BOOKED', 'STATUS_CHANGED', 'STATUS_CHANGED', 'STATUS_CHANGED', 'STATUS_CHANGED', 'RESCHEDULED']);

    // Amina has no access to a colleague's appointment.
    const colleagueAppt = (await secretary.post(`/v1/pro/orgs/${orgId}/appointments`).send({ agendaId: other.id, motiveId: other.motives[0].id, startsAt: at(13), patientRecordId: appt.patient.id, notifyPatient: false }).expect(201)).body;
    created.appointments.push(colleagueAppt.id);
    await amina.patch(`/v1/pro/orgs/${orgId}/appointments/${colleagueAppt.id}`).send({ status: 'ARRIVED' }).expect(404);
    await amina.post(`/v1/pro/orgs/${orgId}/appointments/${colleagueAppt.id}/cancel`).send({}).expect(404);
  });

  it('accepts or refuses an online request and tells the patient each time', async () => {
    const secretary = await login(SECRETARY);
    const agendas = (await secretary.get(`/v1/pro/orgs/${orgId}/agendas`).expect(200)).body;
    const agenda = agendas.find((a: { practitioner: { name: string } }) => a.practitioner.name === 'Dr Amina Saïd');
    const { at } = freeMonday(10, 1);
    const phone = randomPhone();
    // Online requests come from the booking flow; here they are made pending directly.
    const request = async (h: number, record?: string) => {
      const a = (await secretary.post(`/v1/pro/orgs/${orgId}/appointments`).send({ agendaId: agenda.id, motiveId: agenda.motives[0].id, startsAt: at(h), notifyPatient: false, ...(record ? { patientRecordId: record } : { newPatient: { firstName: 'Saïd', lastName: 'Demande', phone } }) }).expect(201)).body;
      created.appointments.push(a.id);
      await prisma.appointment.update({ where: { id: a.id }, data: { status: 'PENDING_VALIDATION', source: 'ONLINE' } });
      return a;
    };

    const first = await request(10);
    created.records.push(first.patient.id);
    const accepted = (await secretary.patch(`/v1/pro/orgs/${orgId}/appointments/${first.id}`).send({ status: 'CONFIRMED' }).expect(200)).body;
    assert.equal(accepted.status, 'CONFIRMED');
    const yes = await prisma.notification.findFirst({ where: { relatedAppointmentId: first.id, template: 'appointment.accepted' } });
    assert.ok((yes?.payload as { text: string }).text.includes('demande acceptee'));

    const second = await request(11, first.patient.id);
    const refused = (await secretary.post(`/v1/pro/orgs/${orgId}/appointments/${second.id}/cancel`).send({ reason: 'Agenda complet' }).expect(200)).body;
    assert.equal(refused.status, 'CANCELLED_BY_PRACTICE');
    const no = await prisma.notification.findFirst({ where: { relatedAppointmentId: second.id, template: 'appointment.refused' } });
    const text = (no?.payload as { text: string }).text;
    assert.ok(text.includes('non acceptee'), text);
    assert.equal(text.includes('Agenda complet'), false, 'the internal reason is never sent');
    assert.equal(text.includes('mon-compte'), false, 'points to the practitioner page to pick another time');
    const history = (await secretary.get(`/v1/pro/orgs/${orgId}/appointments/${second.id}/history`).expect(200)).body;
    assert.deepEqual(history.events.map((e: { type: string }) => e.type), ['BOOKED', 'REFUSED']);

    // A confirmed appointment cannot go back to pending.
    await secretary.patch(`/v1/pro/orgs/${orgId}/appointments/${first.id}`).send({ status: 'PENDING_VALIDATION' }).expect(400);
  });

  it('lets the practitioner change her motives and online windows, not the secretary', async () => {
    const amina = await login(AMINA);
    const secretary = await login(SECRETARY);
    const agenda = (await amina.get(`/v1/pro/orgs/${orgId}/agendas`).expect(200)).body[0];
    const settings = (await amina.get(`/v1/pro/orgs/${orgId}/agendas/${agenda.id}/settings`).expect(200)).body;
    assert.equal(settings.canEdit, true);
    const motive = settings.motives[0];
    restore.push(async () => {
      await prisma.motive.update({ where: { id: motive.id }, data: { priceKmf: motive.priceKmf } });
    });
    restore.push(async () => {
      await prisma.availabilityRule.deleteMany({ where: { agendaId: agenda.id } });
      await prisma.availabilityRule.createMany({ data: settings.rules.map((r: { weekday: number; startMinutes: number; endMinutes: number; motiveIds: string[] }) => ({ agendaId: agenda.id, ...r })) });
    });

    const updated = (await amina.patch(`/v1/pro/orgs/${orgId}/agendas/${agenda.id}/motives/${motive.id}`).send({ priceKmf: 6000 }).expect(200)).body;
    assert.equal(updated.motives.find((x: { id: string }) => x.id === motive.id).priceKmf, 6000);
    await secretary.patch(`/v1/pro/orgs/${orgId}/agendas/${agenda.id}/motives/${motive.id}`).send({ priceKmf: 1 }).expect(403);
    assert.equal((await secretary.get(`/v1/pro/orgs/${orgId}/agendas/${agenda.id}/settings`).expect(200)).body.canEdit, false);

    // Add a Sunday afternoon window: it appears in the public availability.
    let sunday = addDaysToDateKey(toDateKey(new Date()), 14);
    while (weekdayOf(sunday) !== 0) sunday = addDaysToDateKey(sunday, 1);
    const profile = await prisma.practitioner.findFirstOrThrow({ where: { firstName: 'Amina' } });
    const publicQuery = `/v1/practitioners/${profile.slug}/availabilities?motiveId=${motive.id}&from=${sunday}&to=${sunday}`;
    assert.equal((await request(app.getHttpServer()).get(publicQuery).expect(200)).body.days.length, 0);
    const rules = [...settings.rules.map(({ weekday, startMinutes, endMinutes, motiveIds }: { weekday: number; startMinutes: number; endMinutes: number; motiveIds: string[] }) => ({ weekday, startMinutes, endMinutes, motiveIds })), { weekday: 0, startMinutes: 14 * 60, endMinutes: 16 * 60 }];
    await amina.put(`/v1/pro/orgs/${orgId}/agendas/${agenda.id}/availability-rules`).send({ rules }).expect(200);
    assert.ok((await request(app.getHttpServer()).get(publicQuery).expect(200)).body.days[0].slots.length > 0);

    const overlapping = [...rules, { weekday: 0, startMinutes: 15 * 60, endMinutes: 17 * 60 }];
    assert.equal((await amina.put(`/v1/pro/orgs/${orgId}/agendas/${agenda.id}/availability-rules`).send({ rules: overlapping }).expect(400)).body.code, 'VALIDATION_FAILED');
  });

  it('previews the appointments an absence hits, then cancels them and tells the patients', async () => {
    const amina = await login(AMINA);
    const agenda = (await amina.get(`/v1/pro/orgs/${orgId}/agendas`).expect(200)).body[0];
    const { at } = freeMonday(10, 1);
    const phone = randomPhone();
    const appt = (await amina.post(`/v1/pro/orgs/${orgId}/appointments`).send({ agendaId: agenda.id, motiveId: agenda.motives[0].id, startsAt: at(16), newPatient: { firstName: 'Absence', lastName: 'Test', phone }, notifyPatient: false }).expect(201)).body;
    created.appointments.push(appt.id);
    created.records.push(appt.patient.id);
    const mail = `absence-${Date.now()}@exemple.km`;
    const byMail = (await amina.post(`/v1/pro/orgs/${orgId}/appointments`).send({ agendaId: agenda.id, motiveId: agenda.motives[0].id, startsAt: at(17), newPatient: { firstName: 'Absence', lastName: 'Courriel', email: mail }, notifyPatient: false }).expect(201)).body;
    created.appointments.push(byMail.id);
    created.records.push(byMail.patient.id);

    const range = { startsAt: at(15, 30), endsAt: at(18) };
    const preview = (await amina.post(`/v1/pro/orgs/${orgId}/agendas/${agenda.id}/absences/preview`).send(range).expect(200)).body;
    assert.deepEqual(preview.map((p: { id: string }) => p.id).sort(), [appt.id, byMail.id].sort());

    const absence = (await amina.post(`/v1/pro/orgs/${orgId}/agendas/${agenda.id}/absences`).send({ ...range, reason: 'Formation', impacted: 'CANCEL_AND_NOTIFY' }).expect(201)).body;
    created.absences.push(absence.id);
    assert.equal(absence.cancelled, 2);
    const after = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    assert.equal(after.status, 'CANCELLED_BY_PRACTICE');
    assert.ok(await prisma.notification.findFirst({ where: { recipient: phone, template: 'appointment.cancelled_by_practice' } }));
    // By e-mail, other free times are offered (P5), each opening the booking with that time chosen, never inside the absence.
    const offer = await prisma.notification.findFirstOrThrow({ where: { recipient: mail, template: 'appointment.cancelled_by_practice' } });
    const html = (offer.payload as { html: string }).html;
    const offered = [...html.matchAll(/creneau=([^"&]+)/g)].map((m) => new Date(decodeURIComponent(m[1]!)));
    assert.ok(offered.length >= 1 && offered.length <= 3, `${offered.length} times offered`);
    assert.ok(html.includes(`/reserver?motif=${agenda.motives[0].id}`));
    assert.ok(offered.every((t) => t < new Date(range.startsAt) || t >= new Date(range.endsAt)), 'no time inside the absence');

    // The practice cannot book during an absence without forcing.
    const blocked = await amina.post(`/v1/pro/orgs/${orgId}/appointments`).send({ agendaId: agenda.id, motiveId: agenda.motives[0].id, startsAt: at(16), patientRecordId: appt.patient.id, notifyPatient: false }).expect(409);
    assert.equal(blocked.body.code, 'CONFLICT');

    await amina.delete(`/v1/pro/orgs/${orgId}/agendas/${agenda.id}/absences/${absence.id}`).expect(204);
  });
});
