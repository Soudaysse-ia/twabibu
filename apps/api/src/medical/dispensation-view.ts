/**
 * Dispensations as the patient and the prescriber see them (SPEC-14 §Cycle de vie, RX-05): date, pharmacy, what was
 * handed over and any substitution. Built in one place so the patient's list, the printable prescription and the
 * practitioner's record show the same thing.
 */
import type { PrismaService } from '../prisma/prisma.service.js';

export interface DispensationView {
  dispensedAt: string;
  pharmacy: string;
  lines: { label: string; quantity: number; substitutedBy: string | null }[];
}

type PrescriptionRef = { id: string; lines: { id: string; label: string }[] };
type StoredLine = { lineId: string; quantity: number; substitutedBy: string | null };

export async function dispensationViews(prisma: PrismaService, prescriptions: PrescriptionRef[]): Promise<Map<string, DispensationView[]>> {
  const byPrescription = new Map<string, DispensationView[]>(prescriptions.map((p) => [p.id, []]));
  if (!prescriptions.length) return byPrescription;
  const rows = await prisma.dispensation.findMany({ where: { prescriptionId: { in: prescriptions.map((p) => p.id) } }, orderBy: { dispensedAt: 'asc' } });
  const pharmacies = await prisma.organization.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.pharmacyId))] } }, select: { id: true, name: true } });
  for (const r of rows) {
    const labels = new Map(prescriptions.find((p) => p.id === r.prescriptionId)?.lines.map((l) => [l.id, l.label]));
    byPrescription.get(r.prescriptionId)?.push({
      dispensedAt: r.dispensedAt.toISOString(),
      pharmacy: pharmacies.find((p) => p.id === r.pharmacyId)?.name ?? 'Pharmacie',
      lines: (r.lines as StoredLine[]).map((l) => ({ label: labels.get(l.lineId) ?? '', quantity: l.quantity, substitutedBy: l.substitutedBy ?? null })),
    });
  }
  return byPrescription;
}
