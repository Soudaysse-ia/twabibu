import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PracticeUpdate } from '@twabibu/contracts';
import { cleanAccessInfo, cleanOpeningHours } from './pro/practice-rules.js';
import { createApp } from './bootstrap.js';
import { loadConfig } from './config.js';
import { PrismaService } from './prisma/prisma.service.js';
import { RedisService } from './redis/redis.service.js';

// Places of consultation edited in Twabibu Pro (SPEC-07 PRO-06). Needs PostgreSQL, Redis and the seeded localities.
const stamp = Date.now();
const OWNER = `titulaire-lieu-${stamp}@test.twabibu.km`;
const DOCTOR = `praticien-lieu-${stamp}@test.twabibu.km`;
const SECRETARY = `secretaire-lieu-${stamp}@test.twabibu.km`;
const OUTSIDER = `autre-lieu-${stamp}@test.twabibu.km`;
const EMAILS = [OWNER, DOCTOR, SECRETARY, OUTSIDER];

describe('Practice settings: rules', () => {
  it('sorts the ranges of a day, leaves closed days out, refuses overlaps and backwards ranges', () => {
    const r = cleanOpeningHours({
      mon: [
        ['14:00', '17:00'],
        ['08:00', '12:00'],
      ],
      sun: [],
    });
    assert.deepEqual(r, {
      ok: true,
      hours: {
        mon: [
          ['08:00', '12:00'],
          ['14:00', '17:00'],
        ],
      },
    });
    assert.deepEqual(cleanOpeningHours({ tue: [['12:00', '08:00']] }), { ok: false, day: 'tue' });
    assert.deepEqual(
      cleanOpeningHours({
        wed: [
          ['08:00', '12:30'],
          ['12:00', '17:00'],
        ],
      }),
      { ok: false, day: 'wed' },
    );
    // Back to back is fine.
    assert.equal(
      cleanOpeningHours({
        thu: [
          ['08:00', '12:00'],
          ['12:00', '13:00'],
        ],
      }).ok,
      true,
    );
  });

  it('keeps only the access information that was filled in', () => {
    assert.deepEqual(
      cleanAccessInfo({ floor: ' 1er étage ', wheelchair: false, parking: true, notes: '  ' }),
      {
        floor: '1er étage',
        parking: true,
      },
    );
  });
});

describe('Practice settings: API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orgId: string;
  let otherOrgId: string;
  let practiceId: string;
  let otherPracticeId: string;
  let slug: string;
  let locality: { id: string; slug: string; lat: number; lng: number };

  async function login(email: string) {
    await app.get(RedisService).client.del(`twabibu:otp-rate:${email}`);
    const agent = request.agent(app.getHttpServer());
    await agent.post('/v1/auth/otp/request').send({ email }).expect(200);
    const res = await agent.post('/v1/auth/otp/verify').send({ email, code: '000000' }).expect(200);
    assert.equal(res.body.status, 'LOGGED_IN');
    return agent;
  }

  const valid = (): PracticeUpdate => ({
    name: 'Cabinet du Port',
    addressLine: 'Rue du Port, face à la mosquée',
    localityId: locality.id,
    phone: '773 12 34',
    position: null,
    accessInfo: { floor: 'Rez-de-chaussée', wheelchair: true },
    openingHours: {
      mon: [
        ['08:00', '12:00'],
        ['14:00', '17:00'],
      ],
      sat: [['08:00', '12:00']],
    },
  });

  before(async () => {
    app = await createApp(loadConfig({ ...process.env, NODE_ENV: 'test' }));
    await app.init();
    prisma = app.get(PrismaService);
    const speciality = await prisma.speciality.findUniqueOrThrow({ where: { slug: 'medecin-generaliste' } });
    const localities = await prisma.locality.findMany({
      where: { isActive: true },
      take: 2,
      orderBy: { name: 'asc' },
    });
    locality = localities[1]!;
    // A practice of its own, in another locality than the one it moves to, so that the move shows.
    const org = await prisma.organization.create({
      data: {
        name: `Cabinet lieu ${stamp}`,
        slug: `cabinet-lieu-${stamp}`,
        type: 'GROUP_PRACTICE',
        status: 'ACTIVE',
      },
    });
    orgId = org.id;
    const other = await prisma.organization.create({
      data: {
        name: `Autre lieu ${stamp}`,
        slug: `autre-lieu-${stamp}`,
        type: 'SOLO_PRACTICE',
        status: 'ACTIVE',
      },
    });
    otherOrgId = other.id;
    const practice = await prisma.practice.create({
      data: {
        organizationId: org.id,
        name: 'Ancien nom',
        addressLine: 'Ancienne adresse',
        localityId: localities[0]!.id,
      },
    });
    practiceId = practice.id;
    otherPracticeId = (
      await prisma.practice.create({
        data: {
          organizationId: other.id,
          name: 'Autre',
          addressLine: 'Ailleurs',
          localityId: localities[0]!.id,
        },
      })
    ).id;
    const doctor = await prisma.practitioner.create({
      data: {
        organizationId: org.id,
        slug: `praticien-lieu-${stamp}`,
        title: 'Dr',
        firstName: 'Lieu',
        lastName: `Test${stamp}`,
        specialityId: speciality.id,
        verificationStatus: 'VERIFIED',
        isPublished: true,
        practices: { create: { practiceId: practice.id } },
      },
    });
    slug = doctor.slug;
    const member = async (
      email: string,
      organizationId: string,
      role: 'OWNER' | 'PRACTITIONER' | 'SECRETARY',
      practitionerId: string | null,
    ) => {
      const user = await prisma.user.create({
        data: { email, emailVerifiedAt: new Date(), kind: 'PROFESSIONAL' },
      });
      await prisma.membership.create({
        data: { userId: user.id, organizationId, role, practitionerId, acceptedAt: new Date() },
      });
    };
    await member(OWNER, org.id, 'OWNER', null);
    await member(DOCTOR, org.id, 'PRACTITIONER', doctor.id);
    await member(SECRETARY, org.id, 'SECRETARY', null);
    await member(OUTSIDER, other.id, 'OWNER', null);
  });

  after(async () => {
    if (prisma) {
      const orgs = [orgId, otherOrgId].filter(Boolean);
      // The audit log is append-only (database trigger): its rows stay.
      await prisma.session.deleteMany({ where: { user: { email: { in: EMAILS } } } });
      await prisma.otpCode.deleteMany({ where: { recipient: { in: EMAILS } } });
      await prisma.membership.deleteMany({ where: { organizationId: { in: orgs } } });
      await prisma.practitionerPractice.deleteMany({
        where: { practitioner: { organizationId: { in: orgs } } },
      });
      await prisma.practitioner.deleteMany({ where: { organizationId: { in: orgs } } });
      await prisma.practice.deleteMany({ where: { organizationId: { in: orgs } } });
      await prisma.organization.deleteMany({ where: { id: { in: orgs } } });
      await prisma.user.deleteMany({ where: { email: { in: EMAILS } } });
    }
    await app?.close();
  });

  it('shows the places to the whole practice, editable by managers only', async () => {
    const secretary = (await (await login(SECRETARY)).get(`/v1/pro/orgs/${orgId}/practices`).expect(200))
      .body;
    assert.equal(secretary.canEdit, false);
    assert.equal(secretary.practices.length, 1);
    assert.equal(
      (await (await login(DOCTOR)).get(`/v1/pro/orgs/${orgId}/practices`).expect(200)).body.canEdit,
      false,
    );
    assert.equal(
      (await (await login(OWNER)).get(`/v1/pro/orgs/${orgId}/practices`).expect(200)).body.canEdit,
      true,
    );
  });

  it('refuses members without the right, another practice’s place and wrong values', async () => {
    const url = (id: string) => `/v1/pro/orgs/${orgId}/practices/${id}`;
    await (await login(DOCTOR)).put(url(practiceId)).send(valid()).expect(403);
    await (await login(SECRETARY)).put(url(practiceId)).send(valid()).expect(403);
    const owner = await login(OWNER);
    await owner.put(url(otherPracticeId)).send(valid()).expect(404);
    await (await login(OUTSIDER)).put(url(practiceId)).send(valid()).expect(403);

    const phone = await owner
      .put(url(practiceId))
      .send({ ...valid(), phone: '12' })
      .expect(400);
    assert.equal(phone.body.details.field, 'phone');
    const overlap = await owner
      .put(url(practiceId))
      .send({
        ...valid(),
        openingHours: {
          fri: [
            ['08:00', '13:00'],
            ['12:00', '17:00'],
          ],
        },
      })
      .expect(400);
    assert.equal(overlap.body.details.day, 'fri');
    await owner
      .put(url(practiceId))
      .send({ ...valid(), openingHours: { mon: [['8h', '12h']] } })
      .expect(400);
    // Paris, not the Comoros: a pin dropped by mistake.
    await owner
      .put(url(practiceId))
      .send({ ...valid(), position: { lat: 48.85, lng: 2.35 } })
      .expect(400);
    await owner
      .put(url(practiceId))
      .send({ ...valid(), localityId: '00000000-0000-7000-8000-000000000000' })
      .expect(400);
    assert.equal((await prisma.practice.findUniqueOrThrow({ where: { id: practiceId } })).name, 'Ancien nom');
  });

  it('saves the place, puts the pin on the locality when none is placed, and shows it on the public profile', async () => {
    const owner = await login(OWNER);
    const saved = (await owner.put(`/v1/pro/orgs/${orgId}/practices/${practiceId}`).send(valid()).expect(200))
      .body;
    assert.equal(saved.phone, '+2697731234');
    assert.deepEqual(saved.position, { lat: locality.lat, lng: locality.lng });

    const page = (await request(app.getHttpServer()).get(`/v1/practitioners/${slug}`).expect(200)).body;
    const place = page.practices[0];
    assert.equal(place.addressLine, 'Rue du Port, face à la mosquée');
    assert.equal(place.locality.slug, locality.slug);
    assert.equal(place.phone, '+2697731234');
    assert.deepEqual(place.accessInfo, { floor: 'Rez-de-chaussée', wheelchair: true });
    assert.deepEqual(place.openingHours.sat, [['08:00', '12:00']]);
    // The profile address follows the move.
    assert.ok(page.url.includes(`/${locality.slug}/`));

    // A pin placed by hand is kept; saving the same thing again logs nothing.
    const pin = { lat: locality.lat + 0.001, lng: locality.lng - 0.001 };
    await owner
      .put(`/v1/pro/orgs/${orgId}/practices/${practiceId}`)
      .send({ ...valid(), position: pin })
      .expect(200);
    await owner
      .put(`/v1/pro/orgs/${orgId}/practices/${practiceId}`)
      .send({ ...valid(), position: pin })
      .expect(200);
    const audit = await prisma.auditLog.findMany({
      where: { entityId: practiceId, action: 'practice.update' },
      orderBy: { createdAt: 'asc' },
    });
    assert.equal(audit.length, 2);
    assert.deepEqual((audit[1]!.changes as { fields: string[] }).fields, ['lat', 'lng']);
  });
});
