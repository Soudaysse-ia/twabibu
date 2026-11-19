import { z } from 'zod';

export const UserKind = z.enum(['PATIENT', 'PROFESSIONAL', 'PHARMACY_STAFF', 'PLATFORM_ADMIN']);
export type UserKind = z.infer<typeof UserKind>;

export const OrganizationType = z.enum(['SOLO_PRACTICE', 'GROUP_PRACTICE', 'HEALTH_CENTER', 'CLINIC', 'HOSPITAL', 'LAB', 'PHARMACY']);
export type OrganizationType = z.infer<typeof OrganizationType>;

export const MembershipRole = z.enum(['OWNER', 'ADMIN', 'PRACTITIONER', 'SECRETARY', 'PHARMACIST', 'PHARMACY_STAFF']);
export type MembershipRole = z.infer<typeof MembershipRole>;

export const VerificationStatus = z.enum(['UNVERIFIED', 'PENDING', 'CHANGES_REQUESTED', 'VERIFIED', 'REJECTED']);
export type VerificationStatus = z.infer<typeof VerificationStatus>;

export const AppointmentStatus = z.enum([
  'PENDING_VALIDATION', 'CONFIRMED', 'ARRIVED', 'IN_CONSULTATION', 'DONE', 'NO_SHOW', 'CANCELLED_BY_PATIENT', 'CANCELLED_BY_PRACTICE',
]);
export type AppointmentStatus = z.infer<typeof AppointmentStatus>;

/** Statuses that occupy a slot in the agenda. */
export const ACTIVE_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = ['PENDING_VALIDATION', 'CONFIRMED', 'ARRIVED', 'IN_CONSULTATION', 'DONE', 'NO_SHOW'];

export const AppointmentSource = z.enum(['ONLINE', 'PRACTICE', 'PHONE', 'WALK_IN']);
export type AppointmentSource = z.infer<typeof AppointmentSource>;

export const NotificationChannel = z.enum(['SMS', 'EMAIL', 'WHATSAPP', 'PUSH']);
export type NotificationChannel = z.infer<typeof NotificationChannel>;

export const PrescriptionStatus = z.enum(['DRAFT', 'SIGNED', 'SENT_TO_PHARMACY', 'PARTIALLY_DISPENSED', 'DISPENSED', 'EXPIRED', 'CANCELLED']);
export type PrescriptionStatus = z.infer<typeof PrescriptionStatus>;

export const OrderStatus = z.enum(['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const IslandCode = z.enum(['NGAZIDJA', 'NDZUANI', 'MWALI']);
export type IslandCode = z.infer<typeof IslandCode>;
