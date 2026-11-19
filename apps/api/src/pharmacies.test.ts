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
const PORT_OWNER = 'titulaire.port@demo.twabibu.km';
const PORT_STAFF = 'preparateur.port@demo.twabibu.km';
const MEDINA_OWNER = 'titulaire.medina@demo.twabibu.km';

describe('Pharmacies, orders and prescriptions sent to a pharmacy', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let port: string;
  let clinic: string;
  const patientEmail = `pharmacie-${Date.now()}@test.twabibu.km`;
  const cleanup: (() => Promise<unknown>)[] = [];

  async function login(email: string) {
    await app.get(RedisService).client.del(`twabibu:otp-rate:${email}`);
    const agent = request.agent(app.getHttpServer());
    await agent.post('/v1/auth/otp/request').send({ email }).expect(200);
    const res = await agent.post('/v1/auth/otp/verify').send({ email, code: '000000' }).expect(200);
    if (res.body.status !== 'LOGGED_IN') {
      await agent.post('/v1/auth/signup/patient').send({ signupToken: res.body.signupToken, firstName: 'Zaharia', lastName: 'Pharmacie-Test', birthDate: '1985-05-05', acceptTerms: true }).expect(201);
    }
    return agent;
  }
  const product = async (pharmacyId: string, where: object) => (await prisma.pharmacyProduct.findFirstOrThrow({ where: { pharmacyId, ...where } })).id;
  const locality = async (slug: string) => (await prisma.locality.findUniqueOrThrow({ where: { slug } })).id;

  before(async () => {
    app = await createApp(loadConfig({ ...process.env, NODE_ENV: 'test' }));
    await app.init();
    prisma = app.get(PrismaService);
    port = (await prisma.organization.findUniqueOrThrow({ where: { slug: 'pharmacie-demo-du-port' } })).id;
    clinic = (await prisma.organization.findFirstOrThrow({ where: { name: 'Clinique de démonstration Al-Kamar' } })).id;
    cleanup.push(async () => {
      const profile = await prisma.patientProfile.findFirst({ where: { user: { email: patientEmail } } });
      if (profile) {
        const orders = await prisma.order.findMany({ where: { patientProfileId: profile.id }, select: { id: true } });
        await prisma.notification.deleteMany({ where: { relatedOrderId: { in: orders.map((o) => o.id) } } });
        await prisma.order.deleteMany({ where: { patientProfileId: profile.id } });
        const mr = await prisma.medicalRecord.findUnique({ where: { patientProfileId: profile.id } });
        if (mr) {
          await prisma.dispensation.deleteMany({ where: { prescription: { recordId: mr.id } } });
          await prisma.currentTreatment.deleteMany({ where: { recordId: mr.id } });
          await prisma.prescription.deleteMany({ where: { recordId: mr.id } });
          await prisma.medicalRecord.delete({ where: { id: mr.id } });
        }
        await prisma.patientRecord.deleteMany({ where: { patientProfileId: profile.id } });
      }
      await prisma.notification.deleteMany({ where: { recipient: patientEmail } });
      await prisma.otpCode.deleteMany({ where: { recipient: patientEmail } });
      await prisma.user.deleteMany({ where: { email: patientEmail } });
    });
  });

  after(async () => {
    for (const fn of cleanup.reverse()) await fn().catch((e) => console.error(e));
    await app?.close();
  });

  it('lists duty pharmacies of an island without an account, partners labelled', async () => {
    const http = request(app.getHttpServer());
    const duty = (await http.get('/v1/pharmacies/on-duty?island=ngazidja&week=1').expect(200)).body;
    assert.equal(duty.island.code, 'NGAZIDJA');
    assert.ok(duty.duties.length >= 7, 'a week of nights on Ngazidja');
    assert.ok(duty.duties.every((d: { pharmacy: { island: { code: string } } }) => d.pharmacy.island.code === 'NGAZIDJA'));
    assert.ok(duty.duties.every((d: { endsAt: string }) => new Date(d.endsAt) > new Date()), 'finished duties are hidden');
    const port = duty.duties.find((d: { pharmacy: { slug: string } }) => d.pharmacy.slug === 'pharmacie-demo-du-port');
    assert.equal(port.pharmacy.partner, true, 'the partner is labelled');
    assert.equal(duty.partners.length, 0, 'a partner already on duty is not repeated');
    const anjouan = (await http.get('/v1/pharmacies/on-duty?island=ndzuani').expect(200)).body;
    assert.ok(anjouan.duties.every((d: { pharmacy: { island: { code: string } } }) => d.pharmacy.island.code === 'NDZUANI'));
    await http.get('/v1/pharmacies/on-duty?island=mayotte').expect(400);

    const list = (await http.get('/v1/pharmacies?island=ngazidja').expect(200)).body;
    assert.equal(list[0].slug, 'pharmacie-demo-du-port', 'the partner comes first');
    assert.equal(list.find((p: { slug: string }) => p.slug === 'pharmacie-demo-d-iconi').verified, false);

    // No partner promotion on a prescription-only drug.
    const amox = (await http.get('/v1/drugs/amoxicilline-500-mg-gelule/availability').expect(200)).body;
    assert.ok(amox.offers.length > 0 && amox.offers.every((o: { pharmacy: { partner: boolean } }) => !o.pharmacy.partner));
  });

  it('keeps pharmacies and practices apart', async () => {
    const amina = await login(AMINA);
    await amina.get(`/v1/pharma/orgs/${port}/dashboard`).expect(403);
    const owner = await login(PORT_OWNER);
    await owner.get(`/v1/pro/orgs/${port}/agendas`).expect(403);
    await owner.get(`/v1/pro/orgs/${clinic}/agendas`).expect(403);
    assert.equal((await owner.get('/v1/pro/me').expect(200)).body.memberships.length, 0);
    assert.equal((await owner.get('/v1/pharma/me').expect(200)).body.memberships[0].organizationId, port);
    const medina = await login(MEDINA_OWNER);
    await medina.get(`/v1/pharma/orgs/${port}/orders`).expect(403);
    await medina.get(`/v1/pharma/orgs/${port}/prescriptions`).expect(403);
  });

  it('refuses controlled, prescription-only and out-of-zone orders, then delivers a free-product order step by step', async () => {
    const patient = await login(patientEmail);
    const moroni = await locality('moroni');
    const gel = await product(port, { name: 'Thermomètre digital' });
    const diazepam = await product(port, { controlled: true });
    const amox = await product(port, { drug: { slug: 'amoxicilline-500-mg-gelule' } });
    const address = { line: 'Rue de la Corniche, maison bleue', localityId: moroni, phone: '333 12 34' };

    const controlled = await patient.post('/v1/me/orders').send({ pharmacyId: port, mode: 'PICKUP', lines: [{ productId: diazepam, quantity: 1 }] }).expect(422);
    assert.equal(controlled.body.code, 'CONTROLLED_PRODUCT_NOT_ORDERABLE');
    const rx = await patient.post('/v1/me/orders').send({ pharmacyId: port, mode: 'PICKUP', lines: [{ productId: amox, quantity: 1 }] }).expect(422);
    assert.equal(rx.body.code, 'PRESCRIPTION_REQUIRED');
    const far = await patient.post('/v1/me/orders').send({ pharmacyId: port, mode: 'DELIVERY', address: { ...address, localityId: await locality('mitsamiouli') }, lines: [{ productId: gel, quantity: 1 }] }).expect(422);
    assert.equal(far.body.code, 'DELIVERY_NOT_AVAILABLE');
    const iconi = (await prisma.organization.findUniqueOrThrow({ where: { slug: 'pharmacie-demo-d-iconi' } })).id;
    const iconiGel = await product(iconi, { category: { not: 'medication' } });
    assert.equal((await patient.post('/v1/me/orders').send({ pharmacyId: iconi, mode: 'PICKUP', lines: [{ productId: iconiGel, quantity: 1 }] }).expect(403)).body.code, 'PHARMACY_NOT_VERIFIED');
    // A product of another pharmacy cannot be slipped into the cart.
    await patient.post('/v1/me/orders').send({ pharmacyId: port, mode: 'PICKUP', lines: [{ productId: iconiGel, quantity: 1 }] }).expect(422);

    const order = (await patient.post('/v1/me/orders').send({ pharmacyId: port, mode: 'DELIVERY', address, lines: [{ productId: gel, quantity: 2 }] }).expect(201)).body;
    assert.equal(order.status, 'PENDING');
    assert.equal(order.deliveryFeeKmf, 1000);
    assert.equal(order.totalKmf, order.subtotalKmf + 1000);
    assert.equal(order.address.phone, '+2693331234');

    const staff = await login(PORT_STAFF);
    const url = `/v1/pharma/orgs/${port}/orders/${order.id}/status`;
    await staff.post(url).send({ status: 'READY' }).expect(409);
    await staff.post(url).send({ status: 'ACCEPTED' }).expect(200);
    await staff.post(url).send({ status: 'PREPARING' }).expect(200);
    assert.equal((await patient.post(`/v1/me/orders/${order.id}/cancel`).expect(409)).body.code, 'ORDER_STATUS_INVALID');
    await staff.post(url).send({ status: 'OUT_FOR_DELIVERY' }).expect(400);
    await staff.post(url).send({ status: 'OUT_FOR_DELIVERY', courier: { name: 'Said', phone: '344 00 00' } }).expect(200);
    const done = (await staff.post(url).send({ status: 'DELIVERED' }).expect(200)).body;
    assert.deepEqual(done.events.map((e: { status: string }) => e.status), ['PENDING', 'ACCEPTED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED']);

    // One e-mail per step, never with the product names.
    const mails = await prisma.notification.findMany({ where: { relatedOrderId: order.id, recipient: patientEmail } });
    assert.equal(mails.length, 5);
    assert.ok(mails.every((n) => !JSON.stringify(n.payload).includes('Thermomètre')));
    const mine = (await patient.get('/v1/me/orders').expect(200)).body;
    assert.equal(mine[0].status, 'DELIVERED');
    await (await login(MEDINA_OWNER)).post(`/v1/pharma/orgs/${port}/orders/${order.id}/status`).send({ status: 'CANCELLED' }).expect(403);
  });

  it('sends a prescription to a pharmacy, gets an answer, orders it and records the dispensation', async () => {
    const patient = await login(patientEmail);
    const profile = await prisma.patientProfile.findFirstOrThrow({ where: { user: { email: patientEmail } } });
    const file = await prisma.patientRecord.create({ data: { organizationId: clinic, patientProfileId: profile.id, firstName: 'Zaharia', lastName: 'Pharmacie-Test' } });
    const amina = await login(AMINA);
    const drug = async (slug: string) => (await prisma.drug.findUniqueOrThrow({ where: { slug } })).id;
    const signed = (
      await amina
        .post(`/v1/pro/orgs/${clinic}/patients/${file.id}/record/prescriptions`)
        .send({
          lines: [
            { drugId: await drug('amoxicilline-500-mg-gelule'), posologyText: '1 gélule matin, midi et soir pendant 7 jours', quantity: 2 },
            { drugId: await drug('salbutamol-100-g-dose-aerosol-doseur'), posologyText: '2 bouffées si gêne respiratoire', substitutable: false },
          ],
        })
        .expect(201)
    ).body;

    const medina = (await prisma.organization.findUniqueOrThrow({ where: { slug: 'pharmacie-demo-de-la-medina' } })).id;
    await patient.post(`/v1/me/prescriptions/${signed.id}/shares`).send({ pharmacyId: port }).expect(201);
    await patient.post(`/v1/me/prescriptions/${signed.id}/shares`).send({ pharmacyId: port }).expect(409);
    await patient.post(`/v1/me/prescriptions/${signed.id}/shares`).send({ pharmacyId: medina }).expect(201);
    assert.equal((await prisma.prescription.findUniqueOrThrow({ where: { id: signed.id } })).status, 'SENT_TO_PHARMACY');

    const owner = await login(PORT_OWNER);
    const inbox = (await owner.get(`/v1/pharma/orgs/${port}/prescriptions?status=open`).expect(200)).body;
    const share = inbox.find((s: { prescription: { id: string } }) => s.prescription.id === signed.id);
    assert.equal(share.patient.name, 'Zaharia Pharmacie-Test');
    assert.equal(share.prescription.lines.length, 2);
    // The read is logged in the patient's record history, once even if the inbox refreshes.
    await owner.get(`/v1/pharma/orgs/${port}/prescriptions?status=open`).expect(200);
    const reads = (await patient.get('/v1/me/record/access-log').expect(200)).body.filter((l: { organization: string }) => l.organization === 'Pharmacie de démonstration du Port');
    assert.equal(reads.length, 1);

    const [amoxLine, salbuLine] = share.prescription.lines;
    const amoxProduct = await product(port, { drug: { slug: 'amoxicilline-500-mg-gelule' } });
    const answer = { lines: [{ lineId: amoxLine.id, status: 'AVAILABLE', productId: amoxProduct, quantity: 2 }, { lineId: salbuLine.id, status: 'SUBSTITUTE', productName: 'Autre aérosol', unitPriceKmf: 4000, quantity: 1 }], readyInMinutes: 30 };
    await (await login(PORT_STAFF)).post(`/v1/pharma/orgs/${port}/prescriptions/${share.id}/respond`).send(answer).expect(403);
    assert.equal((await owner.post(`/v1/pharma/orgs/${port}/prescriptions/${share.id}/respond`).send(answer).expect(400)).body.code, 'VALIDATION_FAILED', 'no substitution when the prescriber refused it');
    answer.lines[1] = { lineId: salbuLine.id, status: 'UNAVAILABLE', quantity: 1 } as (typeof answer.lines)[number];
    await owner.post(`/v1/pharma/orgs/${port}/prescriptions/${share.id}/respond`).send(answer).expect(200);

    const shares = (await patient.get(`/v1/me/prescriptions/${signed.id}/shares`).expect(200)).body;
    const answered = shares.find((s: { pharmacy: { id: string } }) => s.pharmacy.id === port);
    assert.equal(answered.status, 'ANSWERED');
    assert.equal(answered.response.readyInMinutes, 30);
    const order = (await patient.post(`/v1/me/prescription-shares/${answered.id}/accept`).send({ mode: 'PICKUP' }).expect(201)).body;
    assert.equal(order.lines.length, 1);
    assert.equal(order.prescriptionId, signed.id);

    const url = `/v1/pharma/orgs/${port}/orders/${order.id}/status`;
    for (const status of ['ACCEPTED', 'PREPARING', 'READY']) await owner.post(url).send({ status }).expect(200);
    await (await login(PORT_STAFF)).post(url).send({ status: 'DELIVERED' }).expect(403);
    await owner.post(url).send({ status: 'DELIVERED' }).expect(200);
    // Partial dispensation (the aerosol was missing), visible to the prescriber.
    const doc = (await amina.get(`/v1/pro/orgs/${clinic}/prescriptions/${signed.id}`).expect(200)).body;
    assert.equal(doc.status, 'PARTIALLY_DISPENSED');
    const dispensation = await prisma.dispensation.findFirstOrThrow({ where: { prescriptionId: signed.id } });
    assert.equal(dispensation.pharmacyId, port);
  });
});
