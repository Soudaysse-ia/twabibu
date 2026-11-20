import { z } from 'zod';
import { emailSchema } from './auth.js';

/** Contact form (WEB-02). Who is writing, so support can route the message. */
export const ContactTopic = z.enum(['PATIENT', 'PRACTITIONER', 'PHARMACY', 'OTHER']);
export type ContactTopic = z.infer<typeof ContactTopic>;

// Control characters have no place in a name, and only tab and line breaks in a message: others can break e-mails.
const CONTROL = /\p{Cc}/u;
const noControl = (s: string) => !CONTROL.test(s);
const noControlButLines = (s: string) => !CONTROL.test(s.replace(/[\t\r\n]/g, ''));

export const ContactRequestSchema = z.object({
  name: z.string().trim().min(2).max(100).refine(noControl),
  email: emailSchema,
  topic: ContactTopic,
  message: z.string().trim().min(10).max(3000).refine(noControlButLines),
  /** Honeypot: hidden from people, filled in by robots. A filled value is accepted silently and never sent. */
  website: z.string().max(200).optional(),
});
export type ContactRequest = z.infer<typeof ContactRequestSchema>;
