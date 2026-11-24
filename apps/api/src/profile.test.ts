import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PractitionerProfileUpdate } from '@twabibu/contracts';
import { canEditProfile, type MembershipContext } from './pro/permissions.js';
import { changedFields, cleanProfile } from './pro/profile-rules.js';
import { createApp } from './bootstrap.js';
import { loadConfig } from './config.js';
import { PrismaService } from './prisma/prisma.service.js';
import { RedisService } from './redis/redis.service.js';

// Public profile edited in Twabibu Pro (SPEC-07 PRO-07). Needs PostgreSQL, Redis and the seeded referentials.
const stamp = Date.now();
const OWNER = `titulaire-profil-${stamp}@test.twabibu.km`;
const COLLEAGUE = `collegue-profil-${stamp}@test.twabibu.km`;
const SECRETARY = `secretaire-profil-${stamp}@test.twabibu.km`;
const OUTSIDER = `autre-profil-${stamp}@test.twabibu.km`;
const EMAILS = [OWNER, COLLEAGUE, SECRETARY, OUTSIDER];

const base: PractitionerProfileUpdate = {
  bio: null,
  acceptsNewPatients: true,
  expertises: [],
  languages: ['fr'],
  paymentMethods: ['CASH'],
  insurances: [],
  educations: [],
};

describe('Public profile editing: rules', () => {
  const member = (role: MembershipContext['role'], practitionerId: string | null): MembershipContext => ({
    id: 'm',
    organizationId: 'o',
    role,
    practitionerId,
    permissions: {},
  });

  it('lets a practitioner edit their own profile, managers every profile, a secretary none', () => {
    assert.equal(canEditProfile(member('PRACTITIONER', 'p1'), 'p1'), true);
    assert.equal(canEditProfile(member('PRACTITIONER', 'p1'), 'p2'), false);
    assert.equal(canEditProfile(member('OWNER', 'p1'), 'p2'), true);
    assert.equal(canEditProfile(member('ADMIN', null), 'p2'), true);
    assert.equal(canEditProfile(member('SECRETARY', null), 'p1'), false);
  });

  it('tidies the input and refuses a diploma dated in the future', () => {
    const r = cleanProfile(
      {
        ...base,
        bio: '  \r\n ',
        expertises: ['Échographie', ' échographie ', 'Suivi  de grossesse'],
        educations: [
          { year: 2005, diploma: 'Doctorat', school: 'Faculté de Dakar' },
          { year: 2012, diploma: 'DU  échographie', school: 'Paris' },
        ],
      },
      2026,
    );
    assert.ok(r.ok);
    assert.equal(r.profile.bio, null);
    assert.deepEqual(r.profile.expertises, ['Échographie', 'Suivi de grossesse']);
    assert.deepEqual(
      r.profile.educations.map((e) => e.year),
      [2012, 2005],
    );
    assert.equal(r.profile.educations[0]!.diploma, 'DU échographie');
    assert.equal(
      cleanProfile({ ...base, educations: [{ year: 2027, diploma: 'Master', school: 'Lyon' }] }, 2026).ok,
      false,
    );
  });

  it('names the changed fields only', () => {
    const a = cleanProfile(base, 2026);
    const b = cleanProfile({ ...base, bio: 'Bonjour', languages: ['fr', 'zdj'] }, 2026);
    assert.ok(a.ok && b.ok);
    assert.deepEqual(changedFields(a.profile, b.profile), ['bio', 'languages']);
  });
});

describe('Public profile editing: API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orgId: string;
  let otherOrgId: string;
  let ownerPractitionerId: string;
  let colleagueId: string;
  let slug: string;

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
    // A practice of its own: the demo profiles are read by the search tests running alongside.
    const speciality = await prisma.speciality.findUniqueOrThrow({ where: { slug: 'medecin-generaliste' } });
    const locality = await prisma.locality.findFirstOrThrow();
    const org = await prisma.organization.create({
      data: {
        name: `Cabinet profil ${stamp}`,
        slug: `cabinet-profil-${stamp}`,
        type: 'GROUP_PRACTICE',
        status: 'ACTIVE',
      },
    });
    orgId = org.id;
    const other = await prisma.organization.create({
      data: {
        name: `Autre profil ${stamp}`,
        slug: `autre-profil-${stamp}`,
        type: 'SOLO_PRACTICE',
        status: 'ACTIVE',
      },
    });
    otherOrgId = other.id;
    const practice = await prisma.practice.create({
      data: {
        organizationId: org.id,
        name: 'Cabinet',
        addressLine: 'Rue de la Corniche',
        localityId: locality.id,
      },
    });
    const practitioner = (first: string, verified: boolean) =>
      prisma.practitioner.create({
        data: {
          organizationId: org.id,
          slug: `${first.toLowerCase()}-profil-${stamp}`,
          title: 'Dr',
          firstName: first,
          lastName: `Profil${stamp}`,
          specialityId: speciality.id,
          verificationStatus: verified ? 'VERIFIED' : 'PENDING',
          isPublished: verified,
          languages: ['fr'],
          practices: { create: { practiceId: practice.id } },
        },
      });
    const owner = await practitioner('Titulaire', true);
    const colleague = await practitioner('Collegue', false);
    ownerPractitionerId = owner.id;
    colleagueId = colleague.id;
    slug = owner.slug;
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
    await member(OWNER, org.id, 'OWNER', owner.id);
    await member(COLLEAGUE, org.id, 'PRACTITIONER', colleague.id);
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

  it('lists the profiles each member may edit, with the choices offered', async () => {
    await (await login(SECRETARY)).get(`/v1/pro/orgs/${orgId}/profiles`).expect(403);
    const colleague = (await (await login(COLLEAGUE)).get(`/v1/pro/orgs/${orgId}/profiles`).expect(200)).body;
    assert.deepEqual(
      colleague.practitioners.map((p: { id: string }) => p.id),
      [colleagueId],
    );
    // Not verified yet: no public page to link to.
    assert.equal(colleague.practitioners[0].publicUrl, null);
    const owner = (await (await login(OWNER)).get(`/v1/pro/orgs/${orgId}/profiles`).expect(200)).body;
    assert.equal(owner.practitioners.length, 2);
    assert.ok(owner.options.languages.some((l: { code: string }) => l.code === 'zdj'));
    assert.deepEqual(owner.options.paymentMethods, ['CASH', 'MVOLA', 'HURI', 'CARD', 'TRANSFER']);
    assert.ok(owner.options.insurances.length > 0);
  });

  it('refuses unknown choices, a future diploma, a colleague’s profile and another practice', async () => {
    const colleague = await login(COLLEAGUE);
    const url = (id: string) => `/v1/pro/orgs/${orgId}/profiles/${id}`;
    assert.equal(
      (
        await colleague
          .put(url(colleagueId))
          .send({ ...base, languages: ['xx'] })
          .expect(400)
      ).body.code,
      'VALIDATION_FAILED',
    );
    await colleague
      .put(url(colleagueId))
      .send({ ...base, insurances: ['Assurance inventée'] })
      .expect(400);
    await colleague
      .put(url(colleagueId))
      .send({ ...base, paymentMethods: ['BITCOIN'] })
      .expect(400);
    await colleague
      .put(url(colleagueId))
      .send({ ...base, bio: 'x'.repeat(2001) })
      .expect(400);
    await colleague
      .put(url(colleagueId))
      .send({
        ...base,
        educations: [{ year: new Date().getUTCFullYear() + 1, diploma: 'Master', school: 'Lyon' }],
      })
      .expect(400);
    await colleague.put(url(ownerPractitionerId)).send(base).expect(403);
    // The other practice's owner, through their own practice: our practitioner does not exist there.
    const outsider = await login(OUTSIDER);
    await outsider.put(`/v1/pro/orgs/${otherOrgId}/profiles/${ownerPractitionerId}`).send(base).expect(404);
    // Through ours: not a member.
    await outsider.put(url(ownerPractitionerId)).send(base).expect(403);
    const untouched = await prisma.practitioner.findUniqueOrThrow({ where: { id: colleagueId } });
    assert.deepEqual(untouched.languages, ['fr']);
  });

  it('saves the profile, shows it on the public page at once and logs the changed fields', async () => {
    const owner = await login(OWNER);
    const insurance = (await prisma.insurance.findFirstOrThrow()).name;
    const saved = (
      await owner
        .put(`/v1/pro/orgs/${orgId}/profiles/${ownerPractitionerId}`)
        .send({
          bio: 'Médecine générale.\nConsultations en français et en shikomori.',
          acceptsNewPatients: false,
          expertises: ['Diabète', 'diabète', 'Hypertension'],
          languages: ['fr', 'zdj'],
          paymentMethods: ['CASH', 'MVOLA'],
          insurances: [insurance],
          educations: [{ year: 2010, diploma: 'Doctorat en médecine', school: 'Université de Tananarive' }],
          // Not editable here: silently dropped, never written.
          lastName: 'Changé',
        })
        .expect(200)
    ).body;
    assert.deepEqual(saved.profile.expertises, ['Diabète', 'Hypertension']);
    assert.ok(saved.publicUrl.endsWith(`/${slug}`));

    const page = (await request(app.getHttpServer()).get(`/v1/practitioners/${slug}`).expect(200)).body;
    assert.equal(page.bio, 'Médecine générale.\nConsultations en français et en shikomori.');
    assert.equal(page.acceptsNewPatients, false);
    assert.equal(page.lastName, `Profil${stamp}`);
    assert.deepEqual(
      page.languages.map((l: { code: string }) => l.code),
      ['fr', 'zdj'],
    );
    assert.deepEqual(page.paymentMethods, ['Espèces', 'MVola']);
    assert.deepEqual(page.insurances, [insurance]);
    assert.equal(page.educations[0].school, 'Université de Tananarive');

    // Saving the same thing again changes nothing and logs nothing.
    await owner
      .put(`/v1/pro/orgs/${orgId}/profiles/${ownerPractitionerId}`)
      .send({ ...saved.profile })
      .expect(200);
    const audit = await prisma.auditLog.findMany({
      where: { entityId: ownerPractitionerId, action: 'practitioner.profile.update' },
    });
    assert.equal(audit.length, 1);
    assert.deepEqual((audit[0]!.changes as { fields: string[] }).fields.sort(), [
      'acceptsNewPatients',
      'bio',
      'educations',
      'expertises',
      'insurancesAccepted',
      'languages',
      'paymentMethods',
    ]);
  });
});
