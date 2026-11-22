/** Shapes of the medical-record API (apps/api/src/medical). */
import type { Dispensation } from '@/components/DispensationList';

export type VitalType = 'WEIGHT_KG' | 'HEIGHT_CM' | 'SYSTOLIC_MMHG' | 'DIASTOLIC_MMHG' | 'HEART_RATE_BPM' | 'TEMPERATURE_C' | 'SPO2_PERCENT' | 'GLYCEMIA_G_L' | 'HEAD_CIRCUMFERENCE_CM';

export interface RecordSynthesis {
  patient: { id: string; firstName: string; lastName: string; birthDate: string | null; sex: string | null; phone: string | null; hasAccount: boolean };
  shared: boolean;
  bloodGroup: string | null;
  allergies: { id: string; substance: string; drugDci: string | null; reaction: string | null; severity: 'MILD' | 'MODERATE' | 'SEVERE'; source: string; notedAt: string }[];
  history: { id: string; type: 'MEDICAL' | 'SURGICAL' | 'FAMILY' | 'OBSTETRIC' | 'LIFESTYLE'; label: string; occurredOn: string | null; details: string | null }[];
  treatments: { id: string; label: string; posology: string; startedOn: string | null; endsOn: string | null; fromPrescription: boolean }[];
  vaccinations: { id: string; vaccine: string; givenOn: string | null; nextDueOn: string | null }[];
  vitals: Partial<Record<VitalType, { value: number; measuredAt: string }>>;
  vitalSeries: { type: VitalType; value: number; measuredAt: string }[];
  consultations: { id: string; createdAt: string; practitioner: string; mine: boolean; reason: string | null; diagnoses: { label: string; code?: string }[]; closed: boolean }[];
  prescriptions: {
    id: string;
    status: string;
    signedAt: string | null;
    qrCode: string | null;
    lines: { label: string; posologyText: string }[];
    dispensations: Dispensation[];
  }[];
}

export interface ConsultationDetail {
  id: string;
  createdAt: string;
  practitioner: string;
  sections: { reason?: string; history?: string; examination?: string; diagnosis?: string; plan?: string };
  diagnoses: { label: string; code?: string }[];
  vitals: { type: VitalType; value: number }[];
}

export interface DrugHit {
  id: string;
  dci: string;
  brandNames: string[];
  form: string;
  strength: string;
  prescriptionOnly: boolean;
  controlled: boolean;
  label: string;
}

export interface RxAlert {
  type: 'ALLERGY' | 'DUPLICATE_LINE' | 'ALREADY_TREATED' | 'CONTROLLED';
  lineIndex: number;
  message: string;
  blocking: boolean;
}

export interface PrescriptionDoc {
  id: string;
  status: string;
  signedAt: string | null;
  expiresAt: string | null;
  qrCode: string | null;
  contentHash: string | null;
  notes: string | null;
  prescriber: { name: string; speciality: string; licenseNumber: string | null; organization: string; address: string | null; phone: string | null };
  patient: { firstName: string; lastName: string; birthDate: string | null } | null;
  lines: { label: string; form: string | null; brandNames: string[]; posologyText: string; quantity: number | null; durationDays: number | null; substitutable: boolean }[];
}

export const VITALS: { type: VitalType; label: string; unit: string; step: number }[] = [
  { type: 'SYSTOLIC_MMHG', label: 'Tension systolique', unit: 'mmHg', step: 1 },
  { type: 'DIASTOLIC_MMHG', label: 'Tension diastolique', unit: 'mmHg', step: 1 },
  { type: 'HEART_RATE_BPM', label: 'Pouls', unit: 'bpm', step: 1 },
  { type: 'TEMPERATURE_C', label: 'Température', unit: '°C', step: 0.1 },
  { type: 'WEIGHT_KG', label: 'Poids', unit: 'kg', step: 0.1 },
  { type: 'HEIGHT_CM', label: 'Taille', unit: 'cm', step: 1 },
  { type: 'SPO2_PERCENT', label: 'Saturation', unit: '%', step: 1 },
  { type: 'GLYCEMIA_G_L', label: 'Glycémie', unit: 'g/L', step: 0.01 },
];

export const HISTORY_LABEL: Record<RecordSynthesis['history'][number]['type'], string> = {
  MEDICAL: 'Médicaux',
  SURGICAL: 'Chirurgicaux',
  FAMILY: 'Familiaux',
  OBSTETRIC: 'Gynéco-obstétricaux',
  LIFESTYLE: 'Mode de vie',
};

export function ageOf(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const b = new Date(`${birthDate}T00:00:00Z`);
  const now = new Date();
  let years = now.getUTCFullYear() - b.getUTCFullYear();
  if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) years--;
  if (years < 2) {
    const months = (now.getUTCFullYear() - b.getUTCFullYear()) * 12 + now.getUTCMonth() - b.getUTCMonth();
    return `${months} mois`;
  }
  return `${years} ans`;
}
