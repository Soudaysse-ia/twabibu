import { z } from 'zod';

/** Public profile written by the practitioner in Twabibu Pro (SPEC-02 §Sections, SPEC-07 PRO-07). */
export const PAYMENT_METHODS = ['CASH', 'MVOLA', 'HURI', 'CARD', 'TRANSFER'] as const;
export const PaymentMethod = z.enum(PAYMENT_METHODS);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const EducationSchema = z.object({
  year: z.number().int().min(1950).max(2100),
  diploma: text(2, 120),
  school: text(2, 120),
});
export type Education = z.infer<typeof EducationSchema>;

/** Name, speciality and licence number are checked by Twabibu: they are not editable here (SPEC-02 §Règles 8). */
export const PractitionerProfileUpdateSchema = z.object({
  bio: z.string().trim().max(2000).nullable(),
  acceptsNewPatients: z.boolean(),
  expertises: z.array(text(2, 60)).max(20),
  /** Codes of the language referential (fr, zdj, ar…). */
  languages: z.array(text(2, 8)).max(10),
  paymentMethods: z.array(PaymentMethod).max(PAYMENT_METHODS.length),
  /** Names of the insurance referential. */
  insurances: z.array(text(1, 120)).max(10),
  educations: z.array(EducationSchema).max(10),
});
export type PractitionerProfileUpdate = z.infer<typeof PractitionerProfileUpdateSchema>;
