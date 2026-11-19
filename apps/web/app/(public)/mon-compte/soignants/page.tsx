import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MapPin, Stethoscope } from 'lucide-react';
import { buttonClasses, Card, Container } from '@twabibu/ui';
import { formatDateLong } from '@twabibu/utils';
import { apiGet } from '@/lib/api-server';
import type { PatientAppointment } from '@/lib/types';

export const metadata: Metadata = { title: 'Mes soignants', robots: { index: false } };

interface Carer {
  slug: string;
  name: string;
  speciality: string;
  url: string;
  practice: string;
  lastVisit: string | null;
  next: string | null;
  forNames: Set<string>;
}

/** Practitioners the patient (or a relative) has seen or booked, to book again in one click (SPEC-04, ACCOUNT-04). */
export default async function MyCarersPage() {
  const [upcoming, past] = await Promise.all([apiGet<PatientAppointment[]>('/v1/me/appointments?scope=upcoming'), apiGet<PatientAppointment[]>('/v1/me/appointments?scope=past')]);
  if (!upcoming.ok && (upcoming.status === 401 || upcoming.status === 403)) redirect('/connexion?next=/mon-compte/soignants');
  const carers = new Map<string, Carer>();
  const all = [...(upcoming.ok ? upcoming.data : []), ...(past.ok ? past.data : [])];
  const now = new Date();
  for (const a of all) {
    const c = carers.get(a.practitioner.slug) ?? { slug: a.practitioner.slug, name: a.practitioner.name, speciality: a.practitioner.speciality, url: a.practitioner.url, practice: `${a.practice.name}, ${a.practice.locality}`, lastVisit: null, next: null, forNames: new Set<string>() };
    c.forNames.add(a.forName);
    const at = new Date(a.startsAt);
    if (at < now && a.status === 'DONE' && (!c.lastVisit || a.startsAt > c.lastVisit)) c.lastVisit = a.startsAt;
    if (at >= now && (a.status === 'CONFIRMED' || a.status === 'PENDING_VALIDATION') && (!c.next || a.startsAt < c.next)) c.next = a.startsAt;
    carers.set(a.practitioner.slug, c);
  }
  const list = [...carers.values()].sort((x, y) => (y.next ?? y.lastVisit ?? '').localeCompare(x.next ?? x.lastVisit ?? ''));

  return (
    <Container className="flex flex-col gap-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">Mes soignants</h1>
        <div className="flex flex-wrap gap-4 text-sm font-medium">
          <Link href="/mon-compte/rendez-vous" className="text-primary hover:underline">
            Mes rendez-vous
          </Link>
          <Link href="/mon-compte/dossier" className="text-primary hover:underline">
            Partage de mon dossier
          </Link>
        </div>
      </div>
      {list.length === 0 ? (
        <Card className="flex flex-col items-start gap-3 text-text">
          Les soignants que vous consultez sur Twabibu apparaîtront ici, pour reprendre rendez-vous en un clic.
          <Link href="/" className={buttonClasses({ variant: 'primary', size: 'md' })}>
            Trouver un soignant
          </Link>
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((c) => (
            <li key={c.slug}>
              <Card className="flex h-full flex-col gap-3">
                <div>
                  <Link href={c.url} className="font-heading text-base font-bold text-navy hover:text-primary">
                    {c.name}
                  </Link>
                  <p className="flex items-center gap-1.5 text-sm text-text">
                    <Stethoscope aria-hidden="true" size={14} className="text-text-muted" /> {c.speciality}
                  </p>
                  <p className="flex items-center gap-1.5 text-sm text-text">
                    <MapPin aria-hidden="true" size={14} className="text-text-muted" /> {c.practice}
                  </p>
                </div>
                <ul className="grid gap-0.5 text-sm text-text-muted">
                  {c.next ? <li className="font-medium text-ink">Prochain rendez-vous : {formatDateLong(new Date(c.next))}</li> : null}
                  {c.lastVisit ? <li>Dernière consultation : {formatDateLong(new Date(c.lastVisit))}</li> : null}
                  <li>Pour {[...c.forNames].join(', ')}</li>
                </ul>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Link href={`${c.url}/reserver`} className={buttonClasses({ variant: 'primary', size: 'md' })}>
                    Prendre rendez-vous
                  </Link>
                  <Link href={c.url} className={buttonClasses({ variant: 'secondary', size: 'md' })}>
                    Voir le profil
                  </Link>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
