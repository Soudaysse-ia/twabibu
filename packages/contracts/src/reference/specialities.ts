export interface ReferenceSpeciality { name: string; slug: string; group: 'MEDICAL' | 'DENTAL' | 'MIDWIFERY' | 'PARAMEDICAL' | 'PHARMACY' | 'LAB' | 'WELLBEING'; canPrescribe: boolean; defaultMotives: readonly { name: string; durationMinutes: number }[] }

const consult = (minutes: number) => [
  { name: 'Consultation', durationMinutes: minutes },
  { name: 'Consultation de suivi', durationMinutes: Math.max(10, minutes - 5) },
] as const;

/** Starter list adapted from the Doctolib speciality list to the Comorian context. */
export const REFERENCE_SPECIALITIES: readonly ReferenceSpeciality[] = [
  { name: 'Médecin généraliste', slug: 'medecin-generaliste', group: 'MEDICAL', canPrescribe: true, defaultMotives: [
    { name: 'Adulte - Consultation de médecine générale', durationMinutes: 20 },
    { name: 'Enfant - Consultation de médecine générale', durationMinutes: 20 },
    { name: 'Consultation de suivi', durationMinutes: 15 },
    { name: 'Certificat médical', durationMinutes: 15 },
    { name: 'Vaccination', durationMinutes: 10 },
  ] },
  { name: 'Pédiatre', slug: 'pediatre', group: 'MEDICAL', canPrescribe: true, defaultMotives: [
    { name: 'Consultation de pédiatrie', durationMinutes: 20 },
    { name: 'Suivi du nourrisson', durationMinutes: 20 },
    { name: 'Vaccination', durationMinutes: 15 },
  ] },
  { name: 'Gynécologue', slug: 'gynecologue', group: 'MEDICAL', canPrescribe: true, defaultMotives: [
    { name: 'Consultation de gynécologie', durationMinutes: 20 },
    { name: 'Suivi de grossesse', durationMinutes: 30 },
    { name: 'Échographie', durationMinutes: 30 },
  ] },
  { name: 'Cardiologue', slug: 'cardiologue', group: 'MEDICAL', canPrescribe: true, defaultMotives: consult(30) },
  { name: 'Dermatologue', slug: 'dermatologue', group: 'MEDICAL', canPrescribe: true, defaultMotives: consult(20) },
  { name: 'Ophtalmologue', slug: 'ophtalmologue', group: 'MEDICAL', canPrescribe: true, defaultMotives: consult(20) },
  { name: 'ORL', slug: 'orl', group: 'MEDICAL', canPrescribe: true, defaultMotives: consult(20) },
  { name: 'Diabétologue - Endocrinologue', slug: 'endocrinologue', group: 'MEDICAL', canPrescribe: true, defaultMotives: consult(30) },
  { name: 'Gastro-entérologue', slug: 'gastro-enterologue', group: 'MEDICAL', canPrescribe: true, defaultMotives: consult(30) },
  { name: 'Pneumologue', slug: 'pneumologue', group: 'MEDICAL', canPrescribe: true, defaultMotives: consult(30) },
  { name: 'Neurologue', slug: 'neurologue', group: 'MEDICAL', canPrescribe: true, defaultMotives: consult(30) },
  { name: 'Néphrologue', slug: 'nephrologue', group: 'MEDICAL', canPrescribe: true, defaultMotives: consult(30) },
  { name: 'Urologue', slug: 'urologue', group: 'MEDICAL', canPrescribe: true, defaultMotives: consult(20) },
  { name: 'Rhumatologue', slug: 'rhumatologue', group: 'MEDICAL', canPrescribe: true, defaultMotives: consult(30) },
  { name: 'Psychiatre', slug: 'psychiatre', group: 'MEDICAL', canPrescribe: true, defaultMotives: consult(30) },
  { name: 'Chirurgien', slug: 'chirurgien', group: 'MEDICAL', canPrescribe: true, defaultMotives: consult(20) },
  { name: 'Chirurgien orthopédiste', slug: 'chirurgien-orthopediste', group: 'MEDICAL', canPrescribe: true, defaultMotives: consult(20) },
  { name: 'Anesthésiste', slug: 'anesthesiste', group: 'MEDICAL', canPrescribe: true, defaultMotives: [{ name: 'Consultation pré-anesthésie', durationMinutes: 20 }] },
  { name: 'Radiologue', slug: 'radiologue', group: 'MEDICAL', canPrescribe: true, defaultMotives: [
    { name: 'Radiographie', durationMinutes: 15 },
    { name: 'Échographie', durationMinutes: 30 },
  ] },
  { name: 'Médecin infectiologue', slug: 'infectiologue', group: 'MEDICAL', canPrescribe: true, defaultMotives: consult(30) },
  { name: 'Médecin interniste', slug: 'medecin-interniste', group: 'MEDICAL', canPrescribe: true, defaultMotives: consult(30) },
  { name: 'Chirurgien-dentiste', slug: 'chirurgien-dentiste', group: 'DENTAL', canPrescribe: true, defaultMotives: [
    { name: 'Consultation dentaire', durationMinutes: 20 },
    { name: 'Urgence dentaire', durationMinutes: 20 },
    { name: 'Détartrage', durationMinutes: 30 },
    { name: 'Soin dentaire', durationMinutes: 30 },
  ] },
  { name: 'Sage-femme', slug: 'sage-femme', group: 'MIDWIFERY', canPrescribe: true, defaultMotives: [
    { name: 'Suivi de grossesse', durationMinutes: 30 },
    { name: 'Consultation post-natale', durationMinutes: 30 },
    { name: 'Planification familiale', durationMinutes: 20 },
  ] },
  { name: 'Infirmier', slug: 'infirmier', group: 'PARAMEDICAL', canPrescribe: false, defaultMotives: [
    { name: 'Soins infirmiers', durationMinutes: 15 },
    { name: 'Injection - Pansement', durationMinutes: 15 },
    { name: 'Prise de sang', durationMinutes: 10 },
  ] },
  { name: 'Masseur-kinésithérapeute', slug: 'kinesitherapeute', group: 'PARAMEDICAL', canPrescribe: false, defaultMotives: [
    { name: 'Première séance (bilan)', durationMinutes: 45 },
    { name: 'Séance de rééducation', durationMinutes: 30 },
  ] },
  { name: 'Opticien', slug: 'opticien', group: 'PARAMEDICAL', canPrescribe: false, defaultMotives: [{ name: 'Examen de vue', durationMinutes: 20 }] },
  { name: 'Orthophoniste', slug: 'orthophoniste', group: 'PARAMEDICAL', canPrescribe: false, defaultMotives: consult(30) },
  { name: 'Diététicien - Nutritionniste', slug: 'dieteticien', group: 'PARAMEDICAL', canPrescribe: false, defaultMotives: consult(30) },
  { name: 'Psychologue', slug: 'psychologue', group: 'WELLBEING', canPrescribe: false, defaultMotives: consult(45) },
  { name: "Laboratoire d'analyses", slug: 'laboratoire', group: 'LAB', canPrescribe: false, defaultMotives: [{ name: 'Prélèvement', durationMinutes: 10 }] },
  { name: 'Pharmacie', slug: 'pharmacie', group: 'PHARMACY', canPrescribe: false, defaultMotives: [] },
];
