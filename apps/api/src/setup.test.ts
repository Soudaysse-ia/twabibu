import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { setupSteps, type PractitionerFacts } from './pro/setup-rules.js';
import { createApp } from './bootstrap.js';
import { loadConfig } from './config.js';
import { PrismaService } from './prisma/prisma.service.js';
import { RedisService } from './redis/redis.service.js';

// « Votre cabinet est prêt à X % » (SPEC-07 PRO-02). Needs PostgreSQL, Redis and the seeded referentials.
const stamp = Date.now();
const OWNER = `titulaire-install-${stamp}@test.twabibu.km`;
const COLLEAGUE = `collegue-install-${stamp}@test.twabibu.km`;
const SECRETARY = `secretaire-install-${stamp}@test.twabibu.km`;
const EMAILS = [OWNER, COLLEAGUE, SECRETARY];

const ready: PractitionerFacts = {
  verificationStatus: 'VERIFIED',
  activeMotives: 2,
  onlineMotivesWithoutPrice: 0,
  availabilityRules: 5,
  hasBio: true,
};

describe('Practice setup: rules', () => {
  it('counts six steps for a practitioner who manages the practice, three for a colleague', () => {
    const place = { hasAddress: true, pinAtLocalityCentre: false, openDays: 5 };
    assert.deepEqual(setupSteps({ practitioners: [ready], places: [place] }).percent, 100);
    const fresh = setupSteps({
      practitioners: [
        {
          ...ready,
          verificationStatus: 'PENDING',
          onlineMotivesWithoutPrice: 2,
          availabilityRules: 0,
          hasBio: false,
        },
      ],
      places: [{ ...place, pinAtLocalityCentre: true, openDays: 0 }],
    });
    assert.deepEqual(
      fresh.steps.map((s) => [s.key, s.done]),
      [
        ['verification', false],
        ['place', false],
        ['hours', false],
        ['motives', false],
        ['availability', false],
        ['profile', false],
      ],
    );
    assert.equal(fresh.percent, 0);
    assert.equal(fresh.steps[0]!.waiting, true);
    // No places: a practitioner in someone else's practice does not set the address.
    assert.deepEqual(
      setupSteps({ practitioners: [ready], places: null }).steps.map((s) => s.key),
      ['verification', 'motives', 'availability', 'profile'],
    );
  });

  it('marks a shared step done only when it is done for every practitioner', () => {
    const r = setupSteps({ practitioners: [ready, { ...ready, hasBio: false }], places: null });
    assert.equal(r.steps.find((s) => s.key === 'profile')!.done, false);
    assert.equal(r.percent, 75);
  });
});

describe('Practice setup: API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orgId: string;
  let ownerPractitionerId: string;
  let practiceId: string;
  let agendaId: string;
  let locality: { lat: number; lng: number };

  async function login(email: string) {
    await app.get(RedisService).client.del(`twabibu:otp-rate:${email}`);
    const agent = request.agent(app.getHttpServer());
    await agent.post('/v1/auth/otp/request').send({ email }).expect(200);
    const res = await agent.post('/v1/auth/otp/verify').send({ email, code: '000000' }).expect(200);
    assert.equal(res.body.status, 'LOGGED_IN');
    return agent;
  }

  before(async () => {
    app = await createApp(loadConfig({ ...process.env, NODE_ENV: 'test' }));
    await app.init();
    prisma = app.get(PrismaService);
    const speciality = await prisma.speciality.findUniqueOrThrow({ where: { slug: 'medecin-generaliste' } });
    const town = await prisma.locality.findFirstOrThrow({ where: { isActive: true } });
    locality = { lat: town.lat, lng: town.lng };
    // As right after the online sign-up: pin at the town centre, no hours, motives without a price, no online hours.
    const org = await prisma.organization.create({
      data: {
        name: `Cabinet install ${stamp}`,
        slug: `cabinet-install-${stamp}`,
        type: 'GROUP_PRACTICE',
        status: 'PENDING',
      },
    });
    orgId = org.id;
    const practice = await prisma.practice.create({
      data: {
        organizationId: org.id,
        name: 'Cabinet',
        addressLine: 'Rue du Marché',
        localityId: town.id,
        lat: town.lat,
        lng: town.lng,
      },
    });
    practiceId = practice.id;
    const practitioner = (first: string) =>
      prisma.practitioner.create({
        data: {
          organizationId: org.id,
          slug: `${first.toLowerCase()}-install-${stamp}`,
          firstName: first,
          lastName: `Install${stamp}`,
          specialityId: speciality.id,
          verificationStatus: 'PENDING',
          practices: { create: { practiceId: practice.id } },
          agendas: {
            create: {
              name: 'Agenda',
              practiceId: practice.id,
              isDefault: true,
              motives: { create: [{ name: 'Première consultation', durationMinutes: 30 }] },
            },
          },
        },
        include: { agendas: true },
      });
    const owner = await practitioner('Titulaire');
    const colleague = await practitioner('Collegue');
    ownerPractitionerId = owner.id;
    agendaId = owner.agendas[0]!.id;
    const member = async (
      email: string,
      role: 'OWNER' | 'PRACTITIONER' | 'SECRETARY',
      practitionerId: string | null,
    ) => {
      const user = await prisma.user.create({
        data: { email, emailVerifiedAt: new Date(), kind: 'PROFESSIONAL' },
      });
      await prisma.membership.create({
        data: { userId: user.id, organizationId: org.id, role, practitionerId, acceptedAt: new Date() },
      });
    };
    await member(OWNER, 'OWNER', owner.id);
    await member(COLLEAGUE, 'PRACTITIONER', colleague.id);
    await member(SECRETARY, 'SECRETARY', null);
  });

  after(async () => {
    if (prisma) {
      await prisma.session.deleteMany({ where: { user: { email: { in: EMAILS } } } });
      await prisma.otpCode.deleteMany({ where: { recipient: { in: EMAILS } } });
      await prisma.membership.deleteMany({ where: { organizationId: orgId } });
      await prisma.availabilityRule.deleteMany({
        where: { agenda: { practitioner: { organizationId: orgId } } },
      });
      await prisma.motive.deleteMany({ where: { agenda: { practitioner: { organizationId: orgId } } } });
      await prisma.agenda.deleteMany({ where: { practitioner: { organizationId: orgId } } });
      await prisma.practitionerPractice.deleteMany({ where: { practitioner: { organizationId: orgId } } });
      await prisma.practitioner.deleteMany({ where: { organizationId: orgId } });
      await prisma.practice.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
      await prisma.user.deleteMany({ where: { email: { in: EMAILS } } });
    }
    await app?.close();
  });

  it('starts at zero right after sign-up, waiting for Twabibu’s check', async () => {
    const owner = (await (await login(OWNER)).get(`/v1/pro/orgs/${orgId}/setup`).expect(200)).body;
    assert.equal(owner.percent, 0);
    assert.equal(owner.steps.length, 6);
    assert.deepEqual(owner.steps[0], {
      key: 'verification',
      done: false,
      waiting: true,
      href: '/aide/inscrire-mon-cabinet',
    });
    // A colleague sees their own steps, not the practice's address and hours.
    const colleague = (await (await login(COLLEAGUE)).get(`/v1/pro/orgs/${orgId}/setup`).expect(200)).body;
    assert.deepEqual(
      colleague.steps.map((s: { key: string }) => s.key),
      ['verification', 'motives', 'availability', 'profile'],
    );
    assert.deepEqual((await (await login(SECRETARY)).get(`/v1/pro/orgs/${orgId}/setup`).expect(200)).body, {
      percent: null,
      steps: [],
    });
  });

  it('reaches 100 % once everything is set, for the owner’s own agenda', async () => {
    await prisma.practice.update({
      where: { id: practiceId },
      data: {
        lat: locality.lat + 0.002,
        lng: locality.lng + 0.001,
        openingHours: { mon: [['08:00', '12:00']] },
      },
    });
    await prisma.motive.updateMany({ where: { agendaId }, data: { priceKmf: 5000 } });
    await prisma.availabilityRule.create({
      data: { agendaId, weekday: 1, startMinutes: 480, endMinutes: 720 },
    });
    await prisma.practitioner.update({
      where: { id: ownerPractitionerId },
      data: { bio: 'Médecine générale.', verificationStatus: 'VERIFIED' },
    });
    const owner = (await (await login(OWNER)).get(`/v1/pro/orgs/${orgId}/setup`).expect(200)).body;
    assert.equal(owner.percent, 100);
    assert.ok(owner.steps.every((s: { done: boolean }) => s.done));
  });
});
