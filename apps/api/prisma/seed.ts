/**
 * Seed: reference data (always) + fictional demo data (never in production).
 * Run: pnpm db:seed   — idempotent, safe to run several times.
 */
import { PrismaClient, type IslandCode } from '@prisma/client';
import { REFERENCE_ISLANDS, REFERENCE_LOCALITIES, REFERENCE_SPECIALITIES } from '@twabibu/contracts';
import { addDaysToDateKey, slugify, zonedToUtc } from '@twabibu/utils';
import { FieldCrypto } from '../src/common/field-crypto.js';

const prisma = new PrismaClient();
const TZ = 'Indian/Comoro';

const LANGUAGES = [
  ['fr', 'Français'], ['zdj', 'Shikomori'], ['ar', 'Arabe'], ['en', 'Anglais'], ['sw', 'Swahili'], ['mg', 'Malgache'],
] as const;

const INSURANCES = ['Assurance maladie généralisée (AMG)', 'Assurance privée', "Mutuelle d'entreprise"];

/**
 * Public holidays. Fixed dates are certain; Islamic holidays are ESTIMATES (lunar calendar)
 * and must be confirmed each year by the back-office (isEstimated = true).
 */
const HOLIDAYS: { date: string; name: string; isEstimated?: boolean }[] = [
  { date: '2026-01-01', name: "Jour de l'an" },
  { date: '2026-01-16', name: "Isra' wal Mi'raj", isEstimated: true },
  { date: '2026-03-18', name: 'Journée Cheikh Al-Maarouf' },
  { date: '2026-03-20', name: 'Aïd el-Fitr', isEstimated: true },
  { date: '2026-05-01', name: 'Fête du travail' },
  { date: '2026-05-27', name: 'Aïd el-Kebir', isEstimated: true },
  { date: '2026-06-16', name: 'Nouvel an musulman', isEstimated: true },
  { date: '2026-07-06', name: "Fête de l'indépendance" },
  { date: '2026-08-25', name: 'Maoulid', isEstimated: true },
  { date: '2026-11-12', name: 'Journée Maoré' },
  { date: '2027-01-01', name: "Jour de l'an" },
  { date: '2027-01-05', name: "Isra' wal Mi'raj", isEstimated: true },
  { date: '2027-03-10', name: 'Aïd el-Fitr', isEstimated: true },
  { date: '2027-03-18', name: 'Journée Cheikh Al-Maarouf' },
  { date: '2027-05-01', name: 'Fête du travail' },
  { date: '2027-05-17', name: 'Aïd el-Kebir', isEstimated: true },
  { date: '2027-06-06', name: 'Nouvel an musulman', isEstimated: true },
  { date: '2027-07-06', name: "Fête de l'indépendance" },
  { date: '2027-08-15', name: 'Maoulid', isEstimated: true },
  { date: '2027-11-12', name: 'Journée Maoré' },
];

/** A few essential medicines to start the reference (full import: ticket REF-01). */
const DRUGS: { dci: string; form: string; strength: string; atc: string; prescriptionOnly: boolean; brands?: string[] }[] = [
  { dci: 'Paracétamol', form: 'comprimé', strength: '500 mg', atc: 'N02BE01', prescriptionOnly: false, brands: ['Doliprane', 'Efferalgan'] },
  { dci: 'Paracétamol', form: 'sirop', strength: '120 mg/5 ml', atc: 'N02BE01', prescriptionOnly: false },
  { dci: 'Ibuprofène', form: 'comprimé', strength: '400 mg', atc: 'M01AE01', prescriptionOnly: false },
  { dci: 'Amoxicilline', form: 'gélule', strength: '500 mg', atc: 'J01CA04', prescriptionOnly: true, brands: ['Clamoxyl'] },
  { dci: 'Amoxicilline', form: 'poudre pour suspension buvable', strength: '250 mg/5 ml', atc: 'J01CA04', prescriptionOnly: true },
  { dci: 'Amoxicilline + acide clavulanique', form: 'comprimé', strength: '1 g/125 mg', atc: 'J01CR02', prescriptionOnly: true, brands: ['Augmentin'] },
  { dci: 'Artéméther + luméfantrine', form: 'comprimé', strength: '20 mg/120 mg', atc: 'P01BF01', prescriptionOnly: true, brands: ['Coartem'] },
  { dci: 'Métronidazole', form: 'comprimé', strength: '500 mg', atc: 'P01AB01', prescriptionOnly: true, brands: ['Flagyl'] },
  { dci: 'Cotrimoxazole', form: 'comprimé', strength: '800 mg/160 mg', atc: 'J01EE01', prescriptionOnly: true },
  { dci: 'Metformine', form: 'comprimé', strength: '850 mg', atc: 'A10BA02', prescriptionOnly: true, brands: ['Glucophage'] },
  { dci: 'Amlodipine', form: 'comprimé', strength: '5 mg', atc: 'C08CA01', prescriptionOnly: true },
  { dci: 'Hydrochlorothiazide', form: 'comprimé', strength: '25 mg', atc: 'C03AA03', prescriptionOnly: true },
  { dci: 'Oméprazole', form: 'gélule', strength: '20 mg', atc: 'A02BC01', prescriptionOnly: true },
  { dci: 'Salbutamol', form: 'aérosol doseur', strength: '100 µg/dose', atc: 'R03AC02', prescriptionOnly: true, brands: ['Ventoline'] },
  { dci: 'Sels de réhydratation orale', form: 'poudre', strength: 'sachet', atc: 'A07CA', prescriptionOnly: false },
  { dci: 'Zinc', form: 'comprimé dispersible', strength: '20 mg', atc: 'A12CB01', prescriptionOnly: false },
  { dci: 'Fer + acide folique', form: 'comprimé', strength: '60 mg/0,4 mg', atc: 'B03AD03', prescriptionOnly: false },
  { dci: 'Diazépam', form: 'comprimé', strength: '5 mg', atc: 'N05BA01', prescriptionOnly: true },
];
/** Controlled substances: never orderable online (SPEC-15 §7). */
const CONTROLLED = new Set(['Diazépam']);

async function seedReference() {
  const islandIds = new Map<IslandCode, string>();
  for (const i of REFERENCE_ISLANDS) {
    const row = await prisma.island.upsert({ where: { code: i.code }, update: { name: i.name, frenchName: i.frenchName, slug: i.slug }, create: { code: i.code, name: i.name, frenchName: i.frenchName, slug: i.slug } });
    islandIds.set(i.code, row.id);
  }
  for (const l of REFERENCE_LOCALITIES) {
    const data = { name: l.name, islandId: islandIds.get(l.island)!, lat: l.lat, lng: l.lng };
    // Reference data belongs to the back-office once created (ADR-019): the seed only adds what is missing.
    await prisma.locality.upsert({ where: { slug: l.slug }, update: {}, create: { ...data, slug: l.slug } });
  }
  for (const [index, s] of REFERENCE_SPECIALITIES.entries()) {
    const data = { name: s.name, group: s.group, canPrescribe: s.canPrescribe, defaultMotives: s.defaultMotives as unknown as object, sortOrder: index };
    await prisma.speciality.upsert({ where: { slug: s.slug }, update: {}, create: { ...data, slug: s.slug } });
  }
  for (const [code, name] of LANGUAGES) await prisma.language.upsert({ where: { code }, update: { name }, create: { code, name } });
  for (const name of INSURANCES) await prisma.insurance.upsert({ where: { name }, update: {}, create: { name } });
  // A year's holidays are seeded once, while that year is still empty: dates confirmed, moved or removed in the
  // back-office (estimated Islamic holidays) must not come back on the next deployment.
  for (const year of new Set(HOLIDAYS.map((h) => h.date.slice(0, 4)))) {
    const existing = await prisma.holiday.count({ where: { date: { gte: new Date(`${year}-01-01T00:00:00Z`), lte: new Date(`${year}-12-31T00:00:00Z`) } } });
    if (existing) continue;
    await prisma.holiday.createMany({ data: HOLIDAYS.filter((h) => h.date.startsWith(year)).map((h) => ({ date: new Date(`${h.date}T00:00:00Z`), name: h.name, isEstimated: !!h.isEstimated })) });
  }
  for (const d of DRUGS) {
    const slug = slugify(`${d.dci} ${d.strength} ${d.form}`);
    const data = { dci: d.dci, form: d.form, strength: d.strength, atcCode: d.atc, prescriptionOnly: d.prescriptionOnly, controlled: CONTROLLED.has(d.dci), brandNames: d.brands ?? [], essential: true };
    await prisma.drug.upsert({ where: { slug }, update: {}, create: { ...data, slug } });
  }
  return islandIds;
}

// ─────────── Demo data: fictional people and places, development and staging only ───────────

interface DemoPractitioner { first: string; last: string; title: string; speciality: string; languages: string[]; price: number; bio: string }

/**
 * Demo professional accounts: sign in on /pro/connexion with the e-mail below and the fake code 000000.
 * Practitioners: <prenom>.<nom>@demo.twabibu.km (e.g. amina.said@demo.twabibu.km).
 * Secretary: secretariat@demo.twabibu.km. Owner: direction@demo.twabibu.km.
 * The legacy phone numbers (phase 1, +269 440 00 xx) are migrated to these e-mails.
 */
const DEMO_PRO_EMAIL = (p: { first: string; last: string }) => `${slugify(p.first)}.${slugify(p.last)}@demo.twabibu.km`;
const LEGACY_PRO_PHONE = (index: number) => `+269440000${index + 1}`;
const DEMO_SECRETARY = { email: 'secretariat@demo.twabibu.km', legacyPhone: '+2694400010' };
const DEMO_OWNER = { email: 'direction@demo.twabibu.km', legacyPhone: '+2694400020' };

/** Fictional patients without an account, as a practice would register them at the desk. */
const DEMO_PATIENTS = [
  { firstName: 'Mariama', lastName: 'Houmadi', phone: '+2693201101', email: 'mariama.houmadi@demo.twabibu.km', birthDate: '1985-02-11' },
  { firstName: 'Ahmed', lastName: 'Mze', phone: '+2693201102', email: 'ahmed.mze@demo.twabibu.km', birthDate: '1978-09-23' },
  { firstName: 'Soifia', lastName: 'Bacar', phone: null, email: 'soifia.bacar@demo.twabibu.km', birthDate: '1999-06-05' },
  { firstName: 'Nassur', lastName: 'Attoumani', phone: '+2693201104', email: null, birthDate: '1964-12-30' },
  { firstName: 'Hadidja', lastName: 'Msa', phone: '+2693201105', email: null, birthDate: '2017-03-14' },
  { firstName: 'Zaïnaba', lastName: 'Ali', phone: '+2693201106', email: null, birthDate: '1958-04-02' },
  { firstName: 'Youssouf', lastName: 'Hamada', phone: '+2693201107', email: 'youssouf.hamada@demo.twabibu.km', birthDate: '1992-11-19' },
  { firstName: 'Abdallah', lastName: 'Mmadi', phone: '+2693201108', email: null, birthDate: '1949-05-15' },
  { firstName: 'Naïma', lastName: 'Said Omar', phone: null, email: 'naima.saidomar@demo.twabibu.km', birthDate: '1988-10-03' },
];

const DEMO_PRACTITIONERS: DemoPractitioner[] = [
  { first: 'Amina', last: 'Saïd', title: 'Dr', speciality: 'medecin-generaliste', languages: ['fr', 'zdj', 'ar'], price: 5000, bio: 'Médecine générale adulte et enfant, suivi des maladies chroniques (diabète, hypertension).' },
  { first: 'Ibrahim', last: 'Mohamed', title: 'Dr', speciality: 'pediatre', languages: ['fr', 'zdj'], price: 7500, bio: 'Pédiatre, suivi du nourrisson, vaccinations et consultations de l’enfant.' },
  { first: 'Fatima', last: 'Ali', title: 'Dr', speciality: 'gynecologue', languages: ['fr', 'zdj', 'en'], price: 10000, bio: 'Gynécologie médicale, suivi de grossesse et échographie.' },
  { first: 'Youssouf', last: 'Ahmed', title: 'Dr', speciality: 'chirurgien-dentiste', languages: ['fr', 'zdj'], price: 6000, bio: 'Soins dentaires, détartrage et urgences dentaires.' },
  { first: 'Zaïnaba', last: 'Abdallah', title: '', speciality: 'sage-femme', languages: ['fr', 'zdj', 'sw'], price: 4000, bio: 'Sage-femme : suivi de grossesse, consultations post-natales et planification familiale.' },
  { first: 'Said', last: 'Omar', title: 'Dr', speciality: 'cardiologue', languages: ['fr', 'ar'], price: 15000, bio: 'Cardiologie, électrocardiogramme, suivi de l’hypertension.' },
];

async function upsertOrganization(slug: string, data: { name: string; type: 'CLINIC' | 'PHARMACY' | 'SOLO_PRACTICE'; phone: string }) {
  return prisma.organization.upsert({ where: { slug }, update: { ...data, status: 'ACTIVE' }, create: { slug, ...data, status: 'ACTIVE' } });
}

async function upsertPractice(organizationId: string, name: string, localitySlug: string, addressLine: string, lat: number, lng: number) {
  const locality = await prisma.locality.findUniqueOrThrow({ where: { slug: localitySlug } });
  const existing = await prisma.practice.findFirst({ where: { organizationId, name } });
  const openingHours = { mon: [['08:00', '12:30'], ['14:30', '17:30']], tue: [['08:00', '12:30'], ['14:30', '17:30']], wed: [['08:00', '12:30']], thu: [['08:00', '12:30'], ['14:30', '17:30']], fri: [['08:00', '11:30']], sat: [['08:30', '12:00']] };
  const data = { organizationId, name, addressLine, localityId: locality.id, lat, lng, openingHours, accessInfo: { floor: 'Rez-de-chaussée', wheelchair: true } };
  return existing ? prisma.practice.update({ where: { id: existing.id }, data }) : prisma.practice.create({ data });
}

async function upsertProUser(
  email: string,
  legacyPhone: string,
  organizationId: string,
  role: 'OWNER' | 'PRACTITIONER' | 'SECRETARY' | 'PHARMACY_STAFF',
  practitionerId: string | null,
  kind: 'PROFESSIONAL' | 'PHARMACY_STAFF' = 'PROFESSIONAL',
) {
  // Professionals sign in by e-mail (ADR-016). A demo account created by phone in phase 1 is converted.
  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, ...(legacyPhone ? [{ phone: legacyPhone }] : [])] } });
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { email, emailVerifiedAt: existing.emailVerifiedAt ?? new Date(), phone: null, phoneVerifiedAt: null } })
    : await prisma.user.create({ data: { email, emailVerifiedAt: new Date(), kind } });
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId } },
    update: { role, practitionerId },
    create: { userId: user.id, organizationId, role, practitionerId, acceptedAt: new Date() },
  });
}

/** A realistic week for the demo clinic: walk-ins and phone bookings on the next working days. */
async function seedDemoAppointments(organizationId: string) {
  const records = [];
  for (const p of DEMO_PATIENTS) {
    const existing = await prisma.patientRecord.findFirst({ where: { organizationId, firstName: p.firstName, lastName: p.lastName } });
    const data = { organizationId, ...p, birthDate: new Date(`${p.birthDate}T00:00:00Z`) };
    records.push(existing ? await prisma.patientRecord.update({ where: { id: existing.id }, data: { email: p.email } }) : await prisma.patientRecord.create({ data }));
  }
  if ((await prisma.appointment.count({ where: { patientRecordId: { in: records.map((r) => r.id) } } })) > 0) return;
  const agendas = await prisma.agenda.findMany({ where: { practitioner: { organizationId } }, include: { motives: { orderBy: { sortOrder: 'asc' } } }, orderBy: { createdAt: 'asc' } });
  const today = new Date().toISOString().slice(0, 10);
  const plan = [
    [1, 8 * 60 + 40], [1, 10 * 60], [2, 9 * 60], [2, 15 * 60], [3, 8 * 60 + 20], [4, 10 * 60 + 40], [5, 9 * 60 + 20],
  ] as const;
  let n = 0;
  for (const agenda of agendas.slice(0, 3)) {
    const motive = agenda.motives[0];
    if (!motive) continue;
    for (const [dayOffset, minutes] of plan) {
      const date = new Date(`${today}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + dayOffset);
      const day = date.toISOString().slice(0, 10);
      const startsAt = zonedToUtc(day, minutes + n * 20 % 60, TZ);
      const record = records[n % records.length]!;
      n++;
      await prisma.appointment
        .create({
          data: {
            agendaId: agenda.id, motiveId: motive.id, patientRecordId: record.id, startsAt,
            endsAt: new Date(startsAt.getTime() + motive.durationMinutes * 60_000),
            status: 'CONFIRMED', source: n % 3 === 0 ? 'WALK_IN' : 'PHONE',
            events: { create: { type: 'BOOKED', payload: { source: 'seed' } } },
          },
        })
        .catch(() => undefined); // overlapping slot: skip
    }
  }

  // Dr Amina Saïd's demo day: a morning appointment never closed (« À clôturer » on her home page)
  // and two online requests waiting for an answer (« Demandes à valider », SPEC-05 §Règles 6).
  const amina = await prisma.agenda.findFirst({ where: { practitioner: { organizationId, firstName: 'Amina' } }, include: { motives: { orderBy: { sortOrder: 'asc' } } } });
  const aminaMotive = amina?.motives[0];
  if (!amina || !aminaMotive) return;
  const extra = [
    { dayOffset: 0, minutes: 8 * 60, status: 'CONFIRMED' as const, source: 'PHONE' as const, record: records[3] },
    { dayOffset: 2, minutes: 11 * 60, status: 'PENDING_VALIDATION' as const, source: 'ONLINE' as const, record: records[4], patientMessage: 'Douleurs au dos depuis une semaine.' },
    { dayOffset: 3, minutes: 14 * 60 + 30, status: 'PENDING_VALIDATION' as const, source: 'ONLINE' as const, record: records[5] },
  ];
  for (const e of extra) {
    if (!e.record) continue;
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + e.dayOffset);
    const startsAt = zonedToUtc(date.toISOString().slice(0, 10), e.minutes, TZ);
    await prisma.appointment
      .create({
        data: {
          agendaId: amina.id, motiveId: aminaMotive.id, patientRecordId: e.record.id, startsAt,
          endsAt: new Date(startsAt.getTime() + aminaMotive.durationMinutes * 60_000),
          status: e.status, source: e.source, patientMessage: e.patientMessage ?? null,
          events: { create: { type: 'BOOKED', payload: { source: 'seed' } } },
        },
      })
      .catch(() => undefined);
  }
}

async function seedDemo() {
  const clinic = await upsertOrganization('clinique-demo-al-kamar', { name: 'Clinique de démonstration Al-Kamar', type: 'CLINIC', phone: '+2697730000' });
  const practice = await upsertPractice(clinic.id, 'Clinique Al-Kamar — Moroni', 'moroni', 'Route de la Corniche', -11.7015, 43.2560);

  for (const [index, p] of DEMO_PRACTITIONERS.entries()) {
    const speciality = await prisma.speciality.findUniqueOrThrow({ where: { slug: p.speciality } });
    const slug = slugify(`${p.first} ${p.last}`);
    const data = {
      organizationId: clinic.id, title: p.title || null, firstName: p.first, lastName: p.last, specialityId: speciality.id,
      bio: p.bio, languages: p.languages, acceptsNewPatients: true, verificationStatus: 'VERIFIED' as const, verifiedAt: new Date(),
      canPrescribe: speciality.canPrescribe, isPublished: true, paymentMethods: ['CASH', 'MVOLA', 'HURI'], insurancesAccepted: [INSURANCES[0]!],
    };
    const practitioner = await prisma.practitioner.upsert({ where: { slug }, update: data, create: { ...data, slug } });
    await prisma.practitionerPractice.upsert({
      where: { practitionerId_practiceId: { practitionerId: practitioner.id, practiceId: practice.id } },
      update: {}, create: { practitionerId: practitioner.id, practiceId: practice.id },
    });

    // One agenda with the speciality's default motives and Monday–Saturday online windows.
    const agenda = (await prisma.agenda.findFirst({ where: { practitionerId: practitioner.id, isDefault: true } }))
      ?? (await prisma.agenda.create({ data: { practitionerId: practitioner.id, practiceId: practice.id, name: 'Consultations', isDefault: true, slotStepMinutes: 20, minNoticeMinutes: 120 } }));
    if ((await prisma.motive.count({ where: { agendaId: agenda.id } })) === 0) {
      const motives = speciality.defaultMotives as { name: string; durationMinutes: number }[];
      await prisma.motive.createMany({
        data: motives.map((m, i) => ({ agendaId: agenda.id, name: m.name, durationMinutes: m.durationMinutes, priceKmf: p.price, sortOrder: i, instructions: 'Merci d’arriver 10 minutes avant l’heure du rendez-vous avec votre carnet de santé.' })),
      });
    }
    await upsertProUser(DEMO_PRO_EMAIL(p), LEGACY_PRO_PHONE(index), clinic.id, 'PRACTITIONER', practitioner.id);
    if ((await prisma.availabilityRule.count({ where: { agendaId: agenda.id } })) === 0) {
      const weekdays = [1, 2, 3, 4, 6];
      await prisma.availabilityRule.createMany({
        data: [
          ...weekdays.map((weekday) => ({ agendaId: agenda.id, weekday, startMinutes: 8 * 60, endMinutes: 12 * 60 })),
          ...[1, 2, 4].map((weekday) => ({ agendaId: agenda.id, weekday, startMinutes: 14 * 60 + 30, endMinutes: 17 * 60 })),
          { agendaId: agenda.id, weekday: 5, startMinutes: 8 * 60, endMinutes: 11 * 60 },
        ],
      });
    }
  }

  await upsertProUser(DEMO_SECRETARY.email, DEMO_SECRETARY.legacyPhone, clinic.id, 'SECRETARY', null);
  await upsertProUser(DEMO_OWNER.email, DEMO_OWNER.legacyPhone, clinic.id, 'OWNER', null);
  await seedDemoAppointments(clinic.id);

  await seedDemoPharmacies();
  await seedDemoBackOffice();
  await seedDemoMedicalHistories(clinic.id);
}

const DEMO_PHARMACIES = [
  { slug: 'pharmacie-demo-du-port', name: 'Pharmacie de démonstration du Port', locality: 'moroni', island: 'NGAZIDJA' as const, address: 'Place du marché', lat: -11.6985, lng: 43.254, verified: true, zones: [['moroni', 1000], ['itsandra', 1500], ['iconi', 1500], ['mitsoudje', 2000]] as [string, number][] },
  { slug: 'pharmacie-demo-de-mitsamiouli', name: 'Pharmacie de démonstration de Mitsamiouli', locality: 'mitsamiouli', island: 'NGAZIDJA' as const, address: 'Route de la plage', lat: -11.3846, lng: 43.2869, verified: true, zones: [['mitsamiouli', 1000]] as [string, number][] },
  { slug: 'pharmacie-demo-d-iconi', name: 'Pharmacie de démonstration d’Iconi', locality: 'iconi', island: 'NGAZIDJA' as const, address: 'Rue de la mosquée', lat: -11.7123, lng: 43.2384, verified: false, zones: [] as [string, number][] },
  { slug: 'pharmacie-demo-de-la-medina', name: 'Pharmacie de démonstration de la Médina', locality: 'mutsamudu', island: 'NDZUANI' as const, address: 'Place du marché', lat: -12.166, lng: 44.398, verified: true, zones: [['mutsamudu', 1000], ['mirontsi', 1500]] as [string, number][] },
  { slug: 'pharmacie-demo-de-domoni', name: 'Pharmacie de démonstration de Domoni', locality: 'domoni', island: 'NDZUANI' as const, address: 'Route du port', lat: -12.2569, lng: 44.5317, verified: true, zones: [] as [string, number][] },
  { slug: 'pharmacie-demo-de-fomboni', name: 'Pharmacie de démonstration de Fomboni', locality: 'fomboni', island: 'MWALI' as const, address: 'Avenue de l’hôpital', lat: -12.28, lng: 43.7425, verified: true, zones: [['fomboni', 1000]] as [string, number][] },
];

const FREE_PRODUCTS: { name: string; category: 'parapharmacy' | 'equipment'; priceKmf: number }[] = [
  { name: 'Moustiquaire imprégnée (2 places)', category: 'equipment', priceKmf: 6500 },
  { name: 'Thermomètre digital', category: 'equipment', priceKmf: 3500 },
  { name: 'Tensiomètre au bras', category: 'equipment', priceKmf: 22000 },
  { name: 'Gel hydroalcoolique 100 ml', category: 'parapharmacy', priceKmf: 1500 },
  { name: 'Crème solaire SPF 50, 50 ml', category: 'parapharmacy', priceKmf: 7500 },
  { name: 'Couches bébé taille 3 (paquet de 30)', category: 'parapharmacy', priceKmf: 5000 },
  { name: 'Répulsif anti-moustiques 100 ml', category: 'parapharmacy', priceKmf: 4000 },
];

/** Fictional pharmacies on the three islands, a 4-week duty rota, catalogues and the pharmacy demo accounts. */
async function seedDemoPharmacies() {
  const TZ_DAY = (offset: number) => {
    const d = new Date(Date.now() + offset * 24 * 3600 * 1000);
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
  };
  const orgs: Record<string, string> = {};
  for (const [index, ph] of DEMO_PHARMACIES.entries()) {
    const org = await upsertOrganization(ph.slug, { name: ph.name, type: 'PHARMACY', phone: `+269773000${index + 1}` });
    await prisma.organization.update({ where: { id: org.id }, data: { email: `contact.${ph.slug.replace('pharmacie-demo-', '').replace(/^(du|de-la|de|d)-/, '')}@demo.twabibu.km` } });
    orgs[ph.slug] = org.id;
    const practice = await upsertPractice(org.id, ph.name, ph.locality, ph.address, ph.lat, ph.lng);
    // Pharmacies keep longer hours than the demo clinic.
    const day: [string, string][] = [['08:00', '12:30'], ['15:00', '19:30']];
    await prisma.practice.update({ where: { id: practice.id }, data: { openingHours: { mon: day, tue: day, wed: day, thu: day, fri: [['08:00', '12:00'], ['15:00', '19:30']], sat: [['08:00', '13:00']] } } });
    const zones = [];
    for (const [slug, feeKmf] of ph.zones) zones.push({ localityId: (await prisma.locality.findUniqueOrThrow({ where: { slug } })).id, feeKmf });
    const profile = {
      pharmacistName: 'Pharmacien de démonstration',
      services: zones.length ? ['DELIVERY', 'PARAPHARMACY', 'MEDICAL_EQUIPMENT'] : ['PARAPHARMACY'],
      paymentMethods: ['CASH', 'MVOLA', 'HURI'],
      deliveryZones: zones,
      verifiedAt: ph.verified ? new Date('2026-11-01T08:00:00Z') : null,
    };
    await prisma.pharmacyProfile.upsert({ where: { organizationId: org.id }, update: profile, create: { organizationId: org.id, ...profile } });

    for (const drug of await prisma.drug.findMany()) {
      if (drug.controlled && index !== 0) continue;
      const exists = await prisma.pharmacyProduct.findFirst({ where: { pharmacyId: org.id, drugId: drug.id } });
      const availability = (drug.dci.length + index) % 9 === 0 ? 'OUT_OF_STOCK' : (drug.dci.length + index) % 7 === 0 ? 'LOW' : 'IN_STOCK';
      const data = {
        name: `${drug.dci} ${drug.strength} (${drug.form})`,
        priceKmf: 500 + (((drug.dci.length + index * 3) * 137) % 40) * 50,
        prescriptionOnly: drug.prescriptionOnly,
        controlled: drug.controlled,
        availability: availability as 'IN_STOCK' | 'LOW' | 'OUT_OF_STOCK',
      };
      if (exists) await prisma.pharmacyProduct.update({ where: { id: exists.id }, data: { prescriptionOnly: data.prescriptionOnly, controlled: data.controlled } });
      else await prisma.pharmacyProduct.create({ data: { ...data, pharmacyId: org.id, drugId: drug.id } });
    }
    for (const [i, p] of FREE_PRODUCTS.entries()) {
      if ((i + index) % 4 === 3) continue; // not every pharmacy sells everything
      const exists = await prisma.pharmacyProduct.findFirst({ where: { pharmacyId: org.id, name: p.name } });
      if (!exists) await prisma.pharmacyProduct.create({ data: { ...p, pharmacyId: org.id, priceKmf: p.priceKmf + index * 250 } });
    }
  }

  // Duty rota: rebuilt on every seed so that "today" always has duty pharmacies (demo source only).
  await prisma.dutySchedule.deleteMany({ where: { source: 'demo' } });
  const rota: Record<'NGAZIDJA' | 'NDZUANI' | 'MWALI', string[]> = {
    NGAZIDJA: ['pharmacie-demo-du-port', 'pharmacie-demo-de-mitsamiouli'],
    NDZUANI: ['pharmacie-demo-de-la-medina', 'pharmacie-demo-de-domoni'],
    MWALI: ['pharmacie-demo-de-fomboni'],
  };
  const duties = [];
  for (let d = -1; d < 28; d++) {
    const key = TZ_DAY(d);
    for (const [island, slugs] of Object.entries(rota) as [keyof typeof rota, string[]][]) {
      // Each pharmacy takes the night for 3 days in a row: 19:30 to 08:00 the next morning.
      const slug = slugs[Math.floor((d + 1) / 3) % slugs.length]!;
      const startsAt = zonedToUtc(key, 19 * 60 + 30, TZ);
      duties.push({ pharmacyId: orgs[slug]!, island, startsAt, endsAt: new Date(startsAt.getTime() + 12.5 * 3600 * 1000), source: 'demo' });
      // Sundays: also on duty during the day.
      if (new Date(`${key}T12:00:00Z`).getUTCDay() === 0) duties.push({ pharmacyId: orgs[slug]!, island, startsAt: zonedToUtc(key, 8 * 60, TZ), endsAt: startsAt, source: 'demo' });
    }
  }
  await prisma.dutySchedule.createMany({ data: duties });

  // One sponsored pharmacy on Ngazidja (labelled « Partenaire » everywhere it shows).
  const port = orgs['pharmacie-demo-du-port']!;
  if (!(await prisma.sponsoredPlacement.count({ where: { pharmacyId: port } }))) {
    const startsAt = new Date('2026-11-01T00:00:00Z');
    const endsAt = new Date('2027-02-01T00:00:00Z');
    await prisma.sponsoredPlacement.createMany({
      data: (['LOCALITY_TOP', 'DUTY_PAGE', 'DRUG_PAGE'] as const).map((slot) => ({ pharmacyId: port, slot, island: 'NGAZIDJA' as const, startsAt, endsAt, priceKmf: 80_000 })),
    });
  }

  // Twabibu Pharma demo accounts (code 000000 by e-mail in dev).
  await upsertProUser('titulaire.port@demo.twabibu.km', '', port, 'OWNER', null, 'PHARMACY_STAFF');
  await upsertProUser('preparateur.port@demo.twabibu.km', '', port, 'PHARMACY_STAFF', null, 'PHARMACY_STAFF');
  await upsertProUser('titulaire.medina@demo.twabibu.km', '', orgs['pharmacie-demo-de-la-medina']!, 'OWNER', null, 'PHARMACY_STAFF');
}

const FEATURE_FLAGS = [
  ['WHATSAPP_NOTIFICATIONS', 'Messages WhatsApp en plus de l’e-mail (V2, modèles à faire approuver).'],
  ['WAITLIST', 'Liste d’attente : prévenir un patient quand un créneau se libère.'],
  ['MESSAGING', 'Messagerie sécurisée patient ↔ cabinet.'],
  ['MOBILE_MONEY', 'Paiement MVola / Huri Money des commandes en pharmacie.'],
] as const;

/** Back-office demo: one account per role, a practitioner waiting for verification, feature flags. */
async function seedDemoBackOffice() {
  for (const [key, description] of FEATURE_FLAGS) await prisma.featureFlag.upsert({ where: { key }, update: { description }, create: { key, description } });

  const admins: [string, string[]][] = [
    ['admin@demo.twabibu.km', ['SUPERADMIN']],
    ['verification@demo.twabibu.km', ['VERIFIER']],
    ['support@demo.twabibu.km', ['SUPPORT']],
  ];
  for (const [email, adminRoles] of admins) {
    // Second factor: in dev (EMAIL_PROVIDER=fake) the code 000000 is accepted after scanning or skipping the QR code.
    await prisma.user.upsert({ where: { email }, update: { adminRoles, kind: 'PLATFORM_ADMIN' }, create: { email, emailVerifiedAt: new Date(), kind: 'PLATFORM_ADMIN', adminRoles } });
  }

  const org = await prisma.organization.upsert({
    where: { slug: 'cabinet-demo-dr-nadjma-youssouf' },
    update: {},
    create: { slug: 'cabinet-demo-dr-nadjma-youssouf', name: 'Cabinet de démonstration du Dr Nadjma Youssouf', type: 'SOLO_PRACTICE', status: 'PENDING', phone: '+2697730100' },
  });
  const practice = await upsertPractice(org.id, 'Cabinet du Dr Nadjma Youssouf', 'mutsamudu', 'Rue de la Citadelle', -12.1675, 44.3995);
  const speciality = await prisma.speciality.findUniqueOrThrow({ where: { slug: 'pediatre' } });
  const slug = 'nadjma-youssouf';
  const practitioner = await prisma.practitioner.upsert({
    where: { slug },
    update: {},
    create: {
      slug, organizationId: org.id, title: 'Dr', firstName: 'Nadjma', lastName: 'Youssouf', specialityId: speciality.id, licenseNumber: 'KM-ORD-2026-0142',
      verificationStatus: 'PENDING', isPublished: false, canPrescribe: speciality.canPrescribe, languages: ['fr', 'zdj'], bio: 'Pédiatre installée à Mutsamudu (profil de démonstration en attente de vérification).',
    },
  });
  await prisma.practitionerPractice.upsert({
    where: { practitionerId_practiceId: { practitionerId: practitioner.id, practiceId: practice.id } },
    update: {},
    create: { practitionerId: practitioner.id, practiceId: practice.id },
  });
  if (!(await prisma.verificationDocument.count({ where: { practitionerId: practitioner.id } }))) {
    await prisma.verificationDocument.createMany({
      data: (['DIPLOMA', 'LICENSE', 'ID_CARD'] as const).map((type) => ({ practitionerId: practitioner.id, type, status: 'PENDING' as const, fileKey: `demo/verification/${slug}/${type.toLowerCase()}.pdf` })),
    });
  }
  await upsertProUser('nadjma.youssouf@demo.twabibu.km', '', org.id, 'OWNER', null);
  const membership = await prisma.membership.findFirstOrThrow({ where: { organizationId: org.id, user: { email: 'nadjma.youssouf@demo.twabibu.km' } } });
  if (!membership.practitionerId) await prisma.membership.update({ where: { id: membership.id }, data: { practitionerId: practitioner.id } });
}

type Vitals = Partial<Record<'WEIGHT_KG' | 'HEIGHT_CM' | 'SYSTOLIC_MMHG' | 'DIASTOLIC_MMHG' | 'HEART_RATE_BPM' | 'TEMPERATURE_C' | 'SPO2_PERCENT' | 'GLYCEMIA_G_L', number>>;
interface DemoStory {
  bloodGroup?: string;
  allergies?: { substance: string; drugDci?: string; reaction: string; severity: 'MILD' | 'MODERATE' | 'SEVERE' }[];
  history?: { type: 'MEDICAL' | 'SURGICAL' | 'FAMILY' | 'OBSTETRIC' | 'LIFESTYLE'; label: string; occurredOn?: string; details?: string }[];
  treatments?: { drug: string; posology: string; startedOn: string }[];
  vaccinations?: { vaccine: string; givenOn: string; nextDueOn?: string }[];
  /** Past consultations with Dr Amina Saïd: days ago, local time, sections, diagnosis, vitals. */
  consultations?: { daysAgo: number; at: string; reason: string; history: string; examination: string; diagnosis: string; plan: string; vitals: Vitals }[];
  noShowDaysAgo?: number[];
}

/** Fictional medical stories for the demo clinic (never real people), so the practitioner's screens are not empty. */
const DEMO_STORIES: Record<string, DemoStory> = {
  'Ahmed Mze': {
    bloodGroup: 'O+',
    history: [
      { type: 'MEDICAL', label: 'Hypertension artérielle', occurredOn: '2019-03-01', details: 'Découverte lors d’un bilan de travail.' },
      { type: 'MEDICAL', label: 'Diabète de type 2', occurredOn: '2021-06-01' },
      { type: 'FAMILY', label: 'Père diabétique' },
      { type: 'LIFESTYLE', label: 'Ancien fumeur (arrêt en 2018)' },
    ],
    treatments: [
      { drug: 'amlodipine-5-mg-comprime', posology: '1 comprimé le matin', startedOn: '2019-03-15' },
      { drug: 'metformine-850-mg-comprime', posology: '1 comprimé matin et soir au cours des repas', startedOn: '2021-06-20' },
    ],
    consultations: [
      { daysAgo: 118, at: '08:40', reason: 'Suivi hypertension et diabète', history: 'Bonne observance. Pas de douleur thoracique.', examination: 'Auscultation normale. Pas d’œdème.', diagnosis: 'Hypertension insuffisamment contrôlée', plan: 'Régime pauvre en sel, marche 30 min par jour. Contrôle dans 2 mois.', vitals: { SYSTOLIC_MMHG: 152, DIASTOLIC_MMHG: 94, WEIGHT_KG: 86, GLYCEMIA_G_L: 1.48 } },
      { daysAgo: 61, at: '09:00', reason: 'Contrôle tension', history: 'Marche régulière depuis 2 mois.', examination: 'Examen cardio-vasculaire normal.', diagnosis: 'Hypertension en amélioration', plan: 'Poursuivre le traitement. Bilan sanguin (HbA1c, créatinine).', vitals: { SYSTOLIC_MMHG: 141, DIASTOLIC_MMHG: 88, WEIGHT_KG: 84, GLYCEMIA_G_L: 1.31 } },
      { daysAgo: 12, at: '08:20', reason: 'Résultats du bilan', history: 'HbA1c 7,1 %. Créatinine normale.', examination: 'Pieds : pas de plaie.', diagnosis: 'Diabète de type 2 équilibré', plan: 'Même traitement. Prochain contrôle dans 3 mois.', vitals: { SYSTOLIC_MMHG: 134, DIASTOLIC_MMHG: 84, WEIGHT_KG: 83, GLYCEMIA_G_L: 1.18 } },
    ],
  },
  'Mariama Houmadi': {
    bloodGroup: 'A+',
    allergies: [{ substance: 'Pénicillines', drugDci: 'Amoxicilline', reaction: 'Urticaire généralisée en 2016', severity: 'SEVERE' }],
    history: [
      { type: 'MEDICAL', label: 'Asthme léger', occurredOn: '2005-01-01' },
      { type: 'OBSTETRIC', label: 'Césarienne', occurredOn: '2015-08-12', details: 'Premier enfant, sans complication.' },
    ],
    treatments: [{ drug: 'salbutamol-100-g-dose-aerosol-doseur', posology: '2 bouffées si gêne respiratoire', startedOn: '2020-02-01' }],
    consultations: [
      { daysAgo: 203, at: '10:00', reason: 'Gêne respiratoire depuis 3 jours', history: 'Rhume, toux sèche nocturne.', examination: 'Sibilants discrets. Pas de fièvre.', diagnosis: 'Exacerbation d’asthme léger', plan: 'Salbutamol à la demande. Revoir si aggravation.', vitals: { SPO2_PERCENT: 96, HEART_RATE_BPM: 92, TEMPERATURE_C: 37.1 } },
    ],
    noShowDaysAgo: [88],
  },
  'Soifia Bacar': {
    vaccinations: [{ vaccine: 'Tétanos (rappel)', givenOn: '2024-05-10', nextDueOn: '2034-05-10' }],
    history: [{ type: 'MEDICAL', label: 'Paludisme simple', occurredOn: '2023-02-14' }],
    consultations: [
      { daysAgo: 41, at: '15:00', reason: 'Fièvre et courbatures', history: 'Fièvre à 39 °C depuis 2 jours, frissons.', examination: 'Test de diagnostic rapide du paludisme positif.', diagnosis: 'Paludisme simple', plan: 'Artéméther-luméfantrine 3 jours. Hydratation. Revoir si vomissements.', vitals: { TEMPERATURE_C: 39.2, HEART_RATE_BPM: 104, WEIGHT_KG: 58 } },
    ],
  },
  'Nassur Attoumani': {
    bloodGroup: 'B+',
    allergies: [{ substance: 'Ibuprofène', drugDci: 'Ibuprofène', reaction: 'Douleurs gastriques importantes', severity: 'MODERATE' }],
    history: [
      { type: 'MEDICAL', label: 'Hypertension artérielle', occurredOn: '2012-01-01' },
      { type: 'MEDICAL', label: 'Goutte', occurredOn: '2020-09-01' },
      { type: 'SURGICAL', label: 'Appendicectomie', occurredOn: '1990-07-01' },
    ],
    treatments: [{ drug: 'hydrochlorothiazide-25-mg-comprime', posology: '1 comprimé le matin', startedOn: '2012-02-01' }],
    consultations: [
      { daysAgo: 75, at: '09:20', reason: 'Douleur du gros orteil', history: 'Douleur brutale nocturne, orteil rouge.', examination: 'Arthrite de la 1re métatarso-phalangienne droite.', diagnosis: 'Crise de goutte', plan: 'Paracétamol (allergie à l’ibuprofène). Boire beaucoup. Uricémie à contrôler.', vitals: { SYSTOLIC_MMHG: 146, DIASTOLIC_MMHG: 90, WEIGHT_KG: 79 } },
    ],
  },
  'Hadidja Msa': {
    vaccinations: [
      { vaccine: 'BCG', givenOn: '2017-03-20' },
      { vaccine: 'Pentavalent (3 doses)', givenOn: '2017-07-15' },
      { vaccine: 'Rougeole-rubéole (2e dose)', givenOn: '2018-09-14' },
    ],
    history: [{ type: 'MEDICAL', label: 'Bronchiolite', occurredOn: '2018-01-10' }],
    consultations: [
      { daysAgo: 30, at: '16:00', reason: 'Fièvre depuis hier', history: 'Fièvre 38,5 °C, mange moins. Pas de diarrhée.', examination: 'Gorge rouge. Test paludisme négatif.', diagnosis: 'Rhinopharyngite', plan: 'Paracétamol sirop selon le poids. Lavages de nez. Revoir si fièvre > 3 jours.', vitals: { TEMPERATURE_C: 38.4, WEIGHT_KG: 27, HEIGHT_CM: 131 } },
    ],
  },
  'Zaïnaba Ali': {
    bloodGroup: 'AB+',
    allergies: [{ substance: 'Sulfamides', drugDci: 'Cotrimoxazole', reaction: 'Éruption cutanée étendue', severity: 'SEVERE' }],
    history: [
      { type: 'MEDICAL', label: 'Diabète de type 2', occurredOn: '2010-01-01' },
      { type: 'SURGICAL', label: 'Cataracte opérée (œil gauche)', occurredOn: '2022-04-05' },
      { type: 'FAMILY', label: 'Mère : accident vasculaire cérébral' },
    ],
    treatments: [{ drug: 'metformine-850-mg-comprime', posology: '1 comprimé matin, midi et soir', startedOn: '2010-02-01' }],
    consultations: [
      { daysAgo: 96, at: '10:40', reason: 'Suivi diabète', history: 'Fatigue, soif.', examination: 'Pas de plaie aux pieds. Sensibilité conservée.', diagnosis: 'Diabète déséquilibré', plan: 'Renforcer le régime. Bilan HbA1c. Contrôle dans 6 semaines.', vitals: { GLYCEMIA_G_L: 2.1, WEIGHT_KG: 72, SYSTOLIC_MMHG: 138, DIASTOLIC_MMHG: 82 } },
      { daysAgo: 47, at: '10:40', reason: 'Contrôle diabète', history: 'Régime mieux suivi.', examination: 'Examen sans particularité.', diagnosis: 'Diabète en amélioration', plan: 'Poursuivre. Consultation ophtalmologique annuelle.', vitals: { GLYCEMIA_G_L: 1.52, WEIGHT_KG: 70, SYSTOLIC_MMHG: 132, DIASTOLIC_MMHG: 80 } },
    ],
  },
  'Youssouf Hamada': {
    history: [{ type: 'LIFESTYLE', label: 'Travail de manutention au port' }],
    consultations: [
      { daysAgo: 19, at: '11:00', reason: 'Douleur lombaire', history: 'Douleur depuis 5 jours après un port de charge.', examination: 'Contracture paravertébrale, pas de signe neurologique.', diagnosis: 'Lombalgie commune', plan: 'Paracétamol, rester actif, gestes de manutention. Arrêt de travail 3 jours.', vitals: { WEIGHT_KG: 74 } },
    ],
    noShowDaysAgo: [54],
  },
  'Abdallah Mmadi': {
    bloodGroup: 'O-',
    history: [
      { type: 'MEDICAL', label: 'Hypertension artérielle', occurredOn: '2005-01-01' },
      { type: 'MEDICAL', label: 'Accident vasculaire cérébral', occurredOn: '2020-11-02', details: 'Séquelle : faiblesse de la main droite.' },
    ],
    treatments: [{ drug: 'amlodipine-5-mg-comprime', posology: '1 comprimé le matin', startedOn: '2020-11-20' }],
    consultations: [
      { daysAgo: 133, at: '08:00', reason: 'Renouvellement de traitement', history: 'Pas de nouvel épisode neurologique.', examination: 'Force de la main droite stable.', diagnosis: 'Hypertension contrôlée, séquelle d’AVC stable', plan: 'Même traitement. Kinésithérapie de la main.', vitals: { SYSTOLIC_MMHG: 136, DIASTOLIC_MMHG: 80, HEART_RATE_BPM: 70, WEIGHT_KG: 68 } },
      { daysAgo: 26, at: '08:00', reason: 'Suivi', history: 'Vertiges au lever.', examination: 'Tension couchée 130/78, debout 112/70.', diagnosis: 'Hypotension orthostatique', plan: 'Se lever lentement, boire davantage. Contrôle dans 1 mois.', vitals: { SYSTOLIC_MMHG: 130, DIASTOLIC_MMHG: 78, HEART_RATE_BPM: 74, WEIGHT_KG: 67 } },
    ],
  },
};

/**
 * Medical histories for the demo patients, written as Dr Amina Saïd. Idempotent: a patient whose record already
 * holds a seeded consultation (template « demo ») is left untouched. Clinical text is encrypted like in the API.
 */
async function seedDemoMedicalHistories(organizationId: string) {
  const crypto = new FieldCrypto(process.env.ENCRYPTION_KEY ?? 'dev-only-encryption-key-change-me');
  const amina = await prisma.practitioner.findUniqueOrThrow({ where: { slug: 'amina-said' }, include: { membership: true, agendas: { include: { motives: { orderBy: { sortOrder: 'asc' } } } } } });
  const authorId = amina.membership!.userId;
  const agenda = amina.agendas.find((a) => a.isDefault) ?? amina.agendas[0]!;
  const motive = agenda.motives[0]!;
  const today = new Date().toISOString().slice(0, 10);
  const day = (iso?: string) => (iso ? new Date(`${iso}T00:00:00Z`) : null);

  for (const [fullName, story] of Object.entries(DEMO_STORIES)) {
    const record = (await prisma.patientRecord.findMany({ where: { organizationId } })).find((r) => `${r.firstName} ${r.lastName}` === fullName);
    if (!record) continue;
    const medical = (await prisma.medicalRecord.findUnique({ where: { patientRecordId: record.id } })) ?? (await prisma.medicalRecord.create({ data: { patientRecordId: record.id } }));
    if (await prisma.consultation.count({ where: { recordId: medical.id, template: 'demo' } })) continue;
    const owned = { recordId: medical.id, organizationId, authorId };

    if (story.bloodGroup && !medical.bloodGroup) await prisma.medicalRecord.update({ where: { id: medical.id }, data: { bloodGroup: story.bloodGroup } });
    for (const a of story.allergies ?? []) {
      if (await prisma.allergy.count({ where: { recordId: medical.id, substance: a.substance, resolvedAt: null } })) continue;
      await prisma.allergy.create({ data: { ...owned, substance: a.substance, drugDci: a.drugDci ?? null, reaction: a.reaction, severity: a.severity, source: 'PRACTITIONER' } });
    }
    for (const h of story.history ?? []) {
      await prisma.medicalHistoryItem.create({ data: { ...owned, type: h.type, label: h.label, occurredOn: day(h.occurredOn), detailsEncrypted: h.details ? crypto.encrypt(h.details) : null, source: 'PRACTITIONER' } });
    }
    for (const t of story.treatments ?? []) {
      const drug = await prisma.drug.findUnique({ where: { slug: t.drug } });
      if (!drug) continue;
      await prisma.currentTreatment.create({ data: { ...owned, drugId: drug.id, label: `${drug.dci} ${drug.strength}`, posology: t.posology, startedOn: day(t.startedOn)! } });
    }
    for (const v of story.vaccinations ?? []) {
      await prisma.vaccination.create({ data: { ...owned, vaccine: v.vaccine, givenOn: day(v.givenOn)!, nextDueOn: day(v.nextDueOn) } });
    }
    for (const c of story.consultations ?? []) {
      const [h, min] = c.at.split(':').map(Number) as [number, number];
      const startsAt = zonedToUtc(addDaysToDateKey(today, -c.daysAgo), h * 60 + min, TZ);
      const appointment = await prisma.appointment
        .create({
          data: {
            agendaId: agenda.id, motiveId: motive.id, patientRecordId: record.id, startsAt, endsAt: new Date(startsAt.getTime() + motive.durationMinutes * 60_000),
            status: 'DONE', source: 'PHONE', createdAt: new Date(startsAt.getTime() - 3 * 86_400_000),
            events: { create: { type: 'BOOKED', payload: { source: 'seed' } } },
          },
        })
        .catch(() => null); // overlap with another demo appointment: keep the consultation without it
      const consultation = await prisma.consultation.create({
        data: {
          recordId: medical.id, organizationId, practitionerId: amina.id, appointmentId: appointment?.id ?? null, template: 'demo',
          sectionsEncrypted: crypto.encryptJson({ reason: c.reason, history: c.history, examination: c.examination, diagnosis: c.diagnosis, plan: c.plan }),
          diagnoses: [{ label: c.diagnosis }], closedAt: new Date(startsAt.getTime() + 20 * 60_000), createdAt: startsAt,
        },
      });
      for (const [type, value] of Object.entries(c.vitals)) {
        await prisma.vital.create({ data: { ...owned, consultationId: consultation.id, type: type as keyof Vitals, value, measuredAt: startsAt } });
      }
    }
    for (const daysAgo of story.noShowDaysAgo ?? []) {
      const startsAt = zonedToUtc(addDaysToDateKey(today, -daysAgo), 14 * 60 + 30, TZ);
      const created = await prisma.appointment
        .create({ data: { agendaId: agenda.id, motiveId: motive.id, patientRecordId: record.id, startsAt, endsAt: new Date(startsAt.getTime() + motive.durationMinutes * 60_000), status: 'NO_SHOW', source: 'PHONE', createdAt: new Date(startsAt.getTime() - 86_400_000) } })
        .catch(() => null);
      if (created) await prisma.patientRecord.update({ where: { id: record.id }, data: { noShowCount: { increment: 1 } } });
    }
  }
}

async function main() {
  await seedReference();
  const counts = {
    islands: await prisma.island.count(), localities: await prisma.locality.count(), specialities: await prisma.speciality.count(),
    holidays: await prisma.holiday.count(), drugs: await prisma.drug.count(),
  };
  console.log('Référentiels :', counts);
  if (process.env.NODE_ENV === 'production') {
    console.log('Production : aucune donnée de démonstration.');
    return;
  }
  await seedDemo();
  console.log('Démo :', {
    practitioners: await prisma.practitioner.count(), agendas: await prisma.agenda.count(), motives: await prisma.motive.count(),
    proAccounts: await prisma.membership.count(), demoAppointments: await prisma.appointment.count({ where: { source: { in: ['PHONE', 'WALK_IN'] } } }),
    pharmacies: await prisma.pharmacyProfile.count(), products: await prisma.pharmacyProduct.count(), duties: await prisma.dutySchedule.count(), placements: await prisma.sponsoredPlacement.count(),
    admins: await prisma.user.count({ where: { kind: 'PLATFORM_ADMIN' } }), demoConsultations: await prisma.consultation.count({ where: { template: 'demo' } }), pendingVerifications: await prisma.practitioner.count({ where: { verificationStatus: 'PENDING' } }),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
