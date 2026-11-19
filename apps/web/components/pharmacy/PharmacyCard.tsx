import Link from 'next/link';
import { BadgeCheck, Clock, MapPin, Navigation, Phone, Truck } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { Badge } from '@twabibu/ui';
import { formatDateLong, formatPhone, formatTime } from '@twabibu/utils';
import type { PharmacyCard as Card } from '@/lib/pharmacy-types';

const t = fr.pharmacy;

/** Open / closed / on duty, in words and colour (never colour alone). */
export function OpenState({ p }: { p: Card }) {
  if (p.onDutyUntil)
    return (
      <Badge tone="pharmacy">
        {t.onDutyUntil} {formatTime(new Date(p.onDutyUntil))}
      </Badge>
    );
  return <Badge tone={p.openNow ? 'success' : 'warning'}>{p.openNow ? t.openNow : t.closedNow}</Badge>;
}

/** Duty window: « vendredi 13 novembre, 19:30 → 08:00 ». */
export function dutyWindow(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  return `${formatDateLong(s).replace(/ \d{4}$/, '')}, ${formatTime(s)} → ${formatTime(e)}`;
}

/** Public pharmacy card: name, state, address, call and directions. Partners are always labelled. */
export function PharmacyCard({ p, duty, headingLevel = 'h2' }: { p: Card; duty?: { startsAt: string; endsAt: string; onDutyNow: boolean }; headingLevel?: 'h2' | 'h3' }) {
  const H = headingLevel;
  const directions = p.lat !== null && p.lng !== null ? `https://www.openstreetmap.org/directions?to=${p.lat}%2C${p.lng}` : null;
  return (
    <article className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <H className="font-body text-base font-bold">
            <Link href={`/pharmacie/${p.slug}`} className="text-primary hover:underline">
              {p.name}
            </Link>
          </H>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {p.partner ? (
              <Badge tone="info" title={t.partnerHint}>
                {t.partner}
              </Badge>
            ) : null}
            {p.verified ? (
              <Badge tone="success">
                <BadgeCheck aria-hidden="true" size={12} /> Vérifiée
              </Badge>
            ) : null}
            {p.delivers ? (
              <Badge tone="info">
                <Truck aria-hidden="true" size={12} /> {t.delivers}
              </Badge>
            ) : null}
          </div>
        </div>
        <OpenState p={p} />
      </div>
      <ul className="grid gap-1.5 text-sm text-text">
        {duty ? (
          <li className="flex gap-2 font-medium text-ink">
            <Clock aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-pharmacy" />
            <span>
              {duty.onDutyNow ? `${t.onDutyNow} · ` : `${t.onDutyFrom} `}
              <span className="first-letter:uppercase">{dutyWindow(duty.startsAt, duty.endsAt)}</span>
            </span>
          </li>
        ) : (
          <li className="flex gap-2">
            <Clock aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-text-muted" />
            {p.hoursToday ? `${t.hoursToday} : ${p.hoursToday}` : t.closedToday}
          </li>
        )}
        {p.address ? (
          <li className="flex gap-2">
            <MapPin aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-text-muted" />
            <span>
              {p.address}, {p.locality?.name}
              {p.island ? ` (${p.island.name})` : ''}
            </span>
          </li>
        ) : null}
        {!p.verified ? <li className="text-xs text-text-muted">{t.notVerified}</li> : null}
      </ul>
      <div className="flex flex-wrap gap-2">
        {p.phone ? (
          <a href={`tel:${p.phone}`} className="inline-flex h-11 items-center gap-1.5 rounded-md bg-pharmacy px-4 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pharmacy">
            <Phone aria-hidden="true" size={16} /> {t.call} <span className="font-normal">{formatPhone(p.phone)}</span>
          </a>
        ) : null}
        {directions ? (
          <a href={directions} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-1.5 rounded-md border border-border px-4 text-sm font-medium text-navy hover:bg-background-soft">
            <Navigation aria-hidden="true" size={16} /> {t.directions}
          </a>
        ) : null}
        <Link href={`/pharmacie/${p.slug}`} className="inline-flex h-11 items-center px-2 text-sm font-medium text-primary hover:underline">
          {t.seePharmacy}
        </Link>
      </div>
    </article>
  );
}
