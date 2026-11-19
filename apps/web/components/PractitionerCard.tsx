import Link from 'next/link';
import { BadgeCheck, CalendarX, Languages, MapPin, Wallet } from 'lucide-react';
import { Badge, SlotChip } from '@twabibu/ui';
import { formatDateLong, formatDayHeader, formatKmf, formatTime, zonedToUtc } from '@twabibu/utils';
import type { SearchItem } from '@/lib/types';

const SLOTS_PER_DAY = 4;

function bookingHref(item: SearchItem, startsAt?: string): string {
  const params = new URLSearchParams();
  if (item.motiveId) params.set('motif', item.motiveId);
  if (startsAt) params.set('creneau', startsAt);
  return `${item.url}/reserver${params.size ? `?${params}` : ''}`;
}

function Message({ item }: { item: SearchItem }) {
  if (item.reason === 'NEW_PATIENTS_NOT_ACCEPTED')
    return <>Ce soignant réserve la prise de rendez-vous en ligne aux patients déjà suivis.</>;
  if (item.reason) return <>Réservation en ligne indisponible. Contactez le cabinet.</>;
  if (item.nextAvailabilityAt)
    return (
      <>
        Prochaine disponibilité le <strong className="font-medium">{formatDateLong(new Date(item.nextAvailabilityAt))}</strong>
      </>
    );
  return <>Aucune disponibilité en ligne pour le moment.</>;
}

/** Search result card with the 5-day slot grid (SPEC-01 §5). */
export function PractitionerCard({ item }: { item: SearchItem }) {
  const hasSlots = item.days.some((d) => d.slots.length > 0);
  return (
    <article className="grid gap-5 rounded-md border border-border bg-surface p-4 shadow-card sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-start gap-3">
          <div aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-soft font-heading text-base font-bold text-primary">
            {item.initials}
          </div>
          <div className="min-w-0">
            <h2 className="font-body text-base font-bold">
              <Link href={item.url} className="text-primary hover:underline">
                {item.displayName}
              </Link>
            </h2>
            <p className="text-sm text-ink">{item.speciality.name}</p>
            {item.verified ? (
              <Badge tone="success" className="mt-1">
                <BadgeCheck aria-hidden="true" size={12} /> Profil vérifié
              </Badge>
            ) : null}
          </div>
        </div>
        <ul className="grid gap-1.5 text-sm text-text">
          {item.practice ? (
            <li className="flex gap-2">
              <MapPin aria-hidden="true" size={16} className="mt-1 shrink-0 text-text-muted" />
              <span>
                {item.practice.addressLine}, {item.practice.locality} ({item.practice.island})
                {item.practice.distanceKm !== null ? <span className="text-text-muted"> · {item.practice.distanceKm} km</span> : null}
              </span>
            </li>
          ) : null}
          {item.priceFromKmf !== null ? (
            <li className="flex gap-2">
              <Wallet aria-hidden="true" size={16} className="mt-1 shrink-0 text-text-muted" />
              Consultation à partir de {formatKmf(item.priceFromKmf)}
            </li>
          ) : null}
          {item.languages.length > 0 ? (
            <li className="flex gap-2">
              <Languages aria-hidden="true" size={16} className="mt-1 shrink-0 text-text-muted" />
              <span>{item.languages.length} langue{item.languages.length > 1 ? 's' : ''} parlée{item.languages.length > 1 ? 's' : ''}</span>
            </li>
          ) : null}
        </ul>
      </div>

      <div className="min-w-0 border-t border-border pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
        {hasSlots ? (
          <>
            <div className="hidden grid-cols-5 gap-2 text-center sm:grid">
              {item.days.map((day) => {
                const header = formatDayHeader(zonedToUtc(day.date, 12 * 60));
                return (
                  <div key={day.date} className="flex min-w-0 flex-col gap-1.5">
                    <div className="mb-1 leading-tight">
                      <p className="text-sm font-bold text-ink capitalize">{header.weekday}</p>
                      <p className="text-xs text-text-muted">{header.day}</p>
                    </div>
                    {Array.from({ length: SLOTS_PER_DAY }, (_, i) => {
                      const slot = day.slots[i];
                      return slot ? (
                        <Link
                          key={slot}
                          href={bookingHref(item, slot)}
                          className="flex h-10 items-center justify-center rounded-md bg-slot text-sm font-medium text-ink tabular-nums transition-colors hover:bg-primary hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          aria-label={`Réserver le ${formatDateLong(new Date(slot))} à ${formatTime(new Date(slot))}`}
                        >
                          {formatTime(new Date(slot))}
                        </Link>
                      ) : (
                        <SlotChip key={i} label={null} />
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col gap-2 sm:mt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-text sm:hidden">
                Prochain créneau :{' '}
                <strong className="font-medium">
                  {(() => {
                    const first = item.days.flatMap((d) => d.slots)[0]!;
                    return `${formatDateLong(new Date(first))} à ${formatTime(new Date(first))}`;
                  })()}
                </strong>
              </p>
              <Link
                href={bookingHref(item)}
                className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium tracking-wide text-white uppercase hover:bg-primary-hover sm:h-auto sm:bg-transparent sm:px-0 sm:text-primary sm:normal-case sm:tracking-normal sm:hover:bg-transparent sm:hover:underline"
              >
                <span className="sm:hidden">Prendre rendez-vous</span>
                <span className="hidden sm:inline">Voir plus de créneaux</span>
              </Link>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-start justify-center gap-3 rounded-md bg-background-soft p-4 text-sm text-text">
            <p className="flex gap-2">
              <CalendarX aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-text-muted" />
              <span>
                <Message item={item} />
              </span>
            </p>
            {item.nextAvailabilityAt ? (
              <Link href={bookingHref(item)} className="font-medium text-primary hover:underline">
                Voir les disponibilités
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
}
