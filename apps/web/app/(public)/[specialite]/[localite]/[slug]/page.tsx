import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { Accessibility, BadgeCheck, CalendarCheck, Clock, Flag, GraduationCap, Landmark, Languages, MapPin, Phone, UserRound, Wallet } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { Badge, buttonClasses, Card, CardTitle, Container } from '@twabibu/ui';
import { formatKmf, formatPhone } from '@twabibu/utils';
import { apiGet } from '@/lib/api-server';
import { SITE_URL } from '@/lib/env';
import type { Practice, Profile } from '@/lib/types';

type Params = { specialite: string; localite: string; slug: string };

const DAYS: [keyof Practice['openingHours'], string, string][] = [
  ['mon', 'Lundi', 'Mo'], ['tue', 'Mardi', 'Tu'], ['wed', 'Mercredi', 'We'], ['thu', 'Jeudi', 'Th'],
  ['fri', 'Vendredi', 'Fr'], ['sat', 'Samedi', 'Sa'], ['sun', 'Dimanche', 'Su'],
];

async function load(slug: string): Promise<Profile | null> {
  const res = await apiGet<Profile>(`/v1/practitioners/${encodeURIComponent(slug)}`);
  return res.ok ? res.data : null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) return { title: 'Soignant introuvable' };
  const place = p.practices[0]?.locality.name ?? 'Comores';
  return {
    title: `${p.displayName}, ${p.speciality.name} à ${place} : prenez RDV en ligne`,
    description: `Prenez rendez-vous en ligne avec ${p.displayName}, ${p.speciality.name.toLowerCase()} à ${place}. Adresse, horaires, tarifs et disponibilités.`,
    alternates: { canonical: p.url },
  };
}

function itinerary(pr: Practice): string {
  return pr.lat !== null && pr.lng !== null
    ? `https://www.openstreetmap.org/directions?to=${pr.lat}%2C${pr.lng}`
    : `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${pr.addressLine}, ${pr.locality.name}, Comores`)}`;
}

export default async function PractitionerPage({ params }: { params: Promise<Params> }) {
  const { specialite, localite, slug } = await params;
  const p = await load(slug);
  if (!p) notFound();
  if (p.url !== `/${specialite}/${localite}/${slug}`) permanentRedirect(p.url);

  const practice = p.practices[0];
  const access = practice
    ? [
        practice.accessInfo.floor,
        practice.accessInfo.wheelchair ? 'Accessible en fauteuil roulant' : null,
        practice.accessInfo.elevator ? 'Ascenseur' : null,
        practice.accessInfo.parking ? 'Stationnement possible' : null,
      ].filter(Boolean)
    : [];
  const motives = p.agenda?.motives ?? [];
  const canBook = !!p.agenda?.onlineBookingEnabled && motives.length > 0;
  const bookHref = `${p.url}/reserver`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Physician',
    name: p.displayName,
    medicalSpecialty: p.speciality.name,
    url: `${SITE_URL}${p.url}`,
    telephone: practice?.phone ?? undefined,
    address: practice && { '@type': 'PostalAddress', streetAddress: practice.addressLine, addressLocality: practice.locality.name, addressRegion: practice.island.name, addressCountry: 'KM' },
    geo: practice?.lat != null ? { '@type': 'GeoCoordinates', latitude: practice.lat, longitude: practice.lng } : undefined,
    openingHoursSpecification: practice
      ? DAYS.flatMap(([key, , code]) => (practice.openingHours[key] ?? []).map(([opens, closes]) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: code, opens, closes })))
      : undefined,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <section className="bg-primary text-white">
        <Container className="flex items-center gap-4 py-6 sm:py-8">
          <div aria-hidden="true" className="flex size-[72px] shrink-0 items-center justify-center rounded-full bg-surface font-heading text-xl font-bold text-primary">
            {p.initials}
          </div>
          <div className="min-w-0">
            <h1 className="font-heading text-xl font-bold text-white sm:text-2xl">{p.displayName}</h1>
            <p className="text-white/90">{p.speciality.name}</p>
            {p.verified ? (
              <p className="mt-1 inline-flex items-center gap-1 text-sm text-white/90">
                <BadgeCheck aria-hidden="true" size={16} /> Profil vérifié par Twabibu
              </p>
            ) : null}
          </div>
        </Container>
      </section>

      <Container className="grid gap-5 py-6 pb-28 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-10">
        <div className="flex min-w-0 flex-col gap-4">
          {practice ? (
            <Card className="flex flex-col gap-3">
              <CardTitle as="h2" icon={<MapPin aria-hidden="true" size={16} />}>Adresse</CardTitle>
              <div className="text-text">
                <p className="font-medium text-ink">{practice.name}</p>
                <p>{practice.addressLine}</p>
                <p>
                  {practice.locality.name}, {practice.island.name} ({practice.island.frenchName})
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={itinerary(practice)} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
                  Itinéraire
                </a>
                {practice.phone ? (
                  <a href={`tel:${practice.phone}`} className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
                    <Phone aria-hidden="true" size={14} /> {formatPhone(practice.phone)}
                  </a>
                ) : null}
              </div>
              {access.length || practice.accessInfo.notes ? (
                <div className="flex gap-2 border-t border-border pt-3 text-sm text-text">
                  <Accessibility aria-hidden="true" size={16} className="mt-1 shrink-0 text-text-muted" />
                  <div className="flex flex-col gap-1">
                    {access.length ? <span>{access.join(' · ')}</span> : null}
                    {practice.accessInfo.notes ? <span className="whitespace-pre-line text-text-muted">{practice.accessInfo.notes}</span> : null}
                  </div>
                </div>
              ) : null}
            </Card>
          ) : null}

          {p.bio || p.expertises.length ? (
            <Card className="flex flex-col gap-3">
              <CardTitle as="h2" icon={<UserRound aria-hidden="true" size={16} />}>Présentation</CardTitle>
              {p.bio ? <p className="whitespace-pre-line text-text">{p.bio}</p> : null}
              {p.expertises.length ? (
                <ul className="flex flex-wrap gap-2">
                  {p.expertises.map((e) => (
                    <li key={e}>
                      <Badge>{e}</Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ) : null}

          {motives.some((m) => m.priceKmf !== null) || p.paymentMethods.length ? (
            <Card className="flex flex-col gap-3">
              <CardTitle as="h2" icon={<Wallet aria-hidden="true" size={16} />}>Tarifs et paiement</CardTitle>
              <ul className="divide-y divide-border">
                {motives
                  .filter((m) => m.priceKmf !== null)
                  .map((m) => (
                    <li key={m.id} className="flex items-baseline justify-between gap-4 py-2 text-text">
                      <span>{m.name}</span>
                      <span className="shrink-0 font-medium text-ink tabular-nums">{formatKmf(m.priceKmf!)}</span>
                    </li>
                  ))}
              </ul>
              <p className="text-xs text-text-muted">Tarifs indicatifs communiqués par le soignant.</p>
              {p.paymentMethods.length ? <p className="text-sm text-text">Moyens de paiement : {p.paymentMethods.join(', ')}</p> : null}
              {p.insurances.length ? <p className="text-sm text-text">Assurances acceptées : {p.insurances.join(', ')}</p> : null}
            </Card>
          ) : null}

          {practice && Object.keys(practice.openingHours).length ? (
            <Card className="flex flex-col gap-3">
              <CardTitle as="h2" icon={<Clock aria-hidden="true" size={16} />}>Horaires d’ouverture</CardTitle>
              <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1.5 text-sm">
                {DAYS.map(([key, label]) => {
                  const ranges = practice.openingHours[key] ?? [];
                  return (
                    <div key={key} className="contents">
                      <dt className="font-medium text-ink">{label}</dt>
                      <dd className="text-text tabular-nums">{ranges.length ? ranges.map(([a, b]) => `${a} – ${b}`).join(', ') : 'Fermé'}</dd>
                    </div>
                  );
                })}
              </dl>
            </Card>
          ) : null}

          {p.languages.length ? (
            <Card className="flex flex-col gap-3">
              <CardTitle as="h2" icon={<Languages aria-hidden="true" size={16} />}>Langues parlées</CardTitle>
              <p className="text-text">{p.languages.map((l) => l.name).join(', ')}</p>
            </Card>
          ) : null}

          {p.educations.length ? (
            <Card className="flex flex-col gap-3">
              <CardTitle as="h2" icon={<GraduationCap aria-hidden="true" size={16} />}>Formations</CardTitle>
              <ul className="flex flex-col gap-2">
                {p.educations.map((e) => (
                  <li key={`${e.year}-${e.diploma}`} className="flex gap-3 text-text">
                    <span className="w-12 shrink-0 font-medium text-ink">{e.year}</span>
                    <span>
                      {e.diploma}, {e.school}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card className="flex flex-col gap-2">
            <CardTitle as="h2" icon={<Landmark aria-hidden="true" size={16} />}>Établissement</CardTitle>
            <p className="text-text">{p.organization.name}</p>
          </Card>
          <Link href={`${p.url}/signaler`} className="inline-flex min-h-11 items-center gap-2 self-start text-sm text-text-muted hover:text-primary hover:underline">
            <Flag aria-hidden="true" size={14} /> {fr.report.link}
          </Link>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="flex flex-col gap-4">
            <h2 className="font-heading text-sm font-bold">En résumé</h2>
            <ul className="grid gap-2 text-sm text-text">
              <li className="flex gap-2">
                <UserRound aria-hidden="true" size={16} className="mt-1 shrink-0 text-text-muted" />
                {p.acceptsNewPatients ? 'Accepte les nouveaux patients sur Twabibu' : 'Réserve la prise de rendez-vous aux patients déjà suivis'}
              </li>
              {practice ? (
                <li className="flex gap-2">
                  <MapPin aria-hidden="true" size={16} className="mt-1 shrink-0 text-text-muted" />
                  {practice.addressLine}, {practice.locality.name}
                </li>
              ) : null}
              {p.priceFromKmf !== null ? (
                <li className="flex gap-2">
                  <Wallet aria-hidden="true" size={16} className="mt-1 shrink-0 text-text-muted" />
                  À partir de {formatKmf(p.priceFromKmf)}
                </li>
              ) : null}
            </ul>
            {canBook ? (
              <Link href={bookHref} className={buttonClasses({ variant: 'primary', fullWidth: true })}>
                <CalendarCheck aria-hidden="true" size={16} /> Prendre rendez-vous
              </Link>
            ) : (
              <p className="rounded-md bg-background-soft p-3 text-sm text-text">
                Réservation en ligne indisponible.{practice?.phone ? ` Appelez le cabinet au ${formatPhone(practice.phone)}.` : ''}
              </p>
            )}
          </Card>
        </aside>
      </Container>

      {canBook ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
          <Link href={bookHref} className={buttonClasses({ variant: 'primary', size: 'lg', fullWidth: true })}>
            Prendre rendez-vous
          </Link>
        </div>
      ) : null}
    </>
  );
}
