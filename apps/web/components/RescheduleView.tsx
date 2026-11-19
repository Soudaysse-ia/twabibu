'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, CalendarX } from 'lucide-react';
import { Button, buttonClasses, Card, cn } from '@twabibu/ui';
import { addDaysToDateKey, formatDateLong, formatDayHeader, formatPhone, formatTime, toDateKey, zonedToUtc } from '@twabibu/utils';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import type { AvailabilityDays, PatientAppointment } from '@/lib/types';

const WINDOW = 14;

/** Free slots of the same practitioner and motive, then a confirmation showing old and new time. */
export function RescheduleView({ appointment: a }: { appointment: PatientAppointment }) {
  const router = useRouter();
  const [days, setDays] = useState<AvailabilityDays['days']>([]);
  const [until, setUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<PatientAppointment | null>(null);
  const from = new Date(a.startsAt);

  const load = useCallback(
    async (start: string, reset: boolean) => {
      setLoading(true);
      try {
        const to = addDaysToDateKey(start, WINDOW - 1);
        const res = await api<AvailabilityDays>(`/v1/practitioners/${a.practitioner.slug}/availabilities?motiveId=${a.motiveId}&from=${start}&to=${to}`);
        const free = res.days.map((d) => ({ ...d, slots: d.slots.filter((s) => s.startsAt !== a.startsAt) })).filter((d) => d.slots.length);
        setDays((prev) => (reset ? free : [...prev, ...free]));
        setUntil(to);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [a.practitioner.slug, a.motiveId, a.startsAt],
  );

  useEffect(() => {
    void load(toDateKey(new Date()), true);
  }, [load]);

  async function pick(startsAt: string) {
    setError(null);
    setBusy(true);
    try {
      if (chosen) await api(`/v1/booking/locks?agendaId=${a.agendaId}&startsAt=${encodeURIComponent(chosen)}`, { method: 'DELETE' }).catch(() => undefined);
      await api('/v1/booking/locks', { method: 'POST', body: { agendaId: a.agendaId, motiveId: a.motiveId, startsAt } });
      setChosen(startsAt);
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'SLOT_UNAVAILABLE' ? 'Ce créneau vient d’être pris. Choisissez-en un autre.' : errorMessage(err));
      void load(toDateKey(new Date()), true);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      setDone(await api<PatientAppointment>(`/v1/booking/appointments/${a.id}/reschedule`, { method: 'POST', body: { startsAt: chosen } }));
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CANCELLATION_DEADLINE_PASSED')
        setError(`Le délai pour déplacer en ligne est dépassé.${a.practice.phone ? ` Appelez le cabinet au ${formatPhone(a.practice.phone)}.` : ''}`);
      else if (err instanceof ApiError && (err.code === 'SLOT_LOCK_EXPIRED' || err.code === 'SLOT_UNAVAILABLE')) {
        setError('Ce créneau n’est plus disponible. Choisissez-en un autre.');
        setChosen(null);
        void load(toDateKey(new Date()), true);
      } else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const at = new Date(done.startsAt);
    return (
      <Card className="flex flex-col items-start gap-3" aria-live="polite">
        <p className="flex items-center gap-2 font-heading text-lg font-bold text-navy">
          <CalendarCheck aria-hidden="true" size={20} className="text-success" /> Rendez-vous déplacé
        </p>
        <p className="text-text first-letter:uppercase">
          {formatDateLong(at)} à {formatTime(at)} avec {done.practitioner.name}.
        </p>
        <p className="text-sm text-text-muted">{done.status === 'PENDING_VALIDATION' ? 'Le cabinet doit valider ce nouvel horaire : vous recevrez sa réponse par e-mail.' : 'Un e-mail de confirmation vous a été envoyé.'}</p>
        <Link href="/mon-compte/rendez-vous" className={buttonClasses({ variant: 'primary', size: 'md' })}>
          Voir mes rendez-vous
        </Link>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-1 text-sm">
        <p className="font-medium text-ink">
          {a.practitioner.name} · {a.motive}
        </p>
        <p className="text-text">
          Rendez-vous actuel : <span className="font-medium">{formatDateLong(from)} à {formatTime(from)}</span>
        </p>
        <p className="text-text-muted">Il n’est annulé qu’une fois le nouvel horaire confirmé.</p>
      </Card>

      {error ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {chosen ? (
        <Card className="flex flex-col gap-3 border-primary" aria-live="polite">
          <p className="text-sm text-text">
            <span className="inline-block line-through first-letter:uppercase">
              {formatDateLong(from)} à {formatTime(from)}
            </span>
          </p>
          <p className="font-heading text-base font-bold text-navy first-letter:uppercase">
            {formatDateLong(new Date(chosen))} à {formatTime(new Date(chosen))}
          </p>
          <p className="text-xs text-text-muted">Ce créneau vous est réservé pendant 10 minutes.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={confirm} disabled={busy}>
              {busy ? 'Déplacement…' : 'Confirmer le nouvel horaire'}
            </Button>
            <Button variant="secondary" onClick={() => setChosen(null)} disabled={busy}>
              Choisir un autre créneau
            </Button>
          </div>
        </Card>
      ) : null}

      <section aria-labelledby="slots" className="flex flex-col gap-3">
        <h2 id="slots" className="text-lg font-bold">
          Nouveaux horaires disponibles
        </h2>
        {!days.length && !loading ? (
          <Card className="flex items-center gap-2 text-sm text-text">
            <CalendarX aria-hidden="true" size={18} className="text-text-muted" /> Aucun créneau libre sur cette période.
          </Card>
        ) : null}
        {days.map((d) => {
          const h = formatDayHeader(zonedToUtc(d.date, 12 * 60));
          return (
            <Card key={d.date} className="flex flex-col gap-2">
              <p className="text-sm font-bold text-ink capitalize">
                {h.weekday} {h.day}
              </p>
              <div className="flex flex-wrap gap-2">
                {d.slots.map((s) => (
                  <button
                    key={s.startsAt}
                    type="button"
                    disabled={busy}
                    aria-pressed={chosen === s.startsAt}
                    onClick={() => pick(s.startsAt)}
                    className={cn(
                      'min-h-11 min-w-16 rounded-md px-3 text-sm font-medium tabular-nums focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50',
                      chosen === s.startsAt ? 'bg-primary text-white' : 'bg-slot text-primary hover:bg-primary-soft',
                    )}
                  >
                    {formatTime(new Date(s.startsAt))}
                  </button>
                ))}
              </div>
            </Card>
          );
        })}
        {until ? (
          <Button variant="secondary" className="self-start" disabled={loading} onClick={() => load(addDaysToDateKey(until, 1), false)}>
            {loading ? 'Chargement…' : 'Voir les 2 semaines suivantes'}
          </Button>
        ) : null}
      </section>
    </div>
  );
}
