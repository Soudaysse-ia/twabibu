'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CalendarCheck, Check, ChevronDown, Clock, MapPin, Stethoscope, UserRound } from 'lucide-react';
import { Button, buttonClasses, Card, cn } from '@twabibu/ui';
import { addDaysToDateKey, formatDateLong, formatKmf, formatTime, toDateKey } from '@twabibu/utils';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { buildIcs } from '@/lib/ics';
import type { AvailabilityDays, Me, Motive, PatientAppointment, Profile } from '@/lib/types';
import { EmailOtpForm } from './EmailOtpForm';

type StepId = 'motif' | 'creneau' | 'identification' | 'pour-qui' | 'consignes' | 'confirmation';
type Person = { kind: 'me' } | { kind: 'relative'; id: string } | { kind: 'new' };
interface Lock { agendaId: string; motiveId: string; startsAt: string; endsAt: string; expiresAt: number }

const WINDOW_DAYS = 7;
const RELATIONSHIPS = [
  ['ENFANT', 'Mon enfant'],
  ['PARENT', 'Mon parent'],
  ['CONJOINT', 'Mon conjoint ou ma conjointe'],
  ['AUTRE', 'Autre proche'],
] as const;
const inputClass = 'h-12 w-full rounded-md border border-border bg-surface px-3 text-ink focus:border-primary focus:outline-2 focus:outline-primary/30';

function Countdown({ expiresAt, onExpire }: { expiresAt: number; onExpire: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, expiresAt - Date.now()));
  useEffect(() => {
    const t = setInterval(() => {
      const ms = Math.max(0, expiresAt - Date.now());
      setLeft(ms);
      if (ms === 0) onExpire();
    }, 1000);
    return () => clearInterval(t);
  }, [expiresAt, onExpire]);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000).toString().padStart(2, '0');
  return (
    <p className="flex items-center gap-1.5 text-xs text-text-muted" aria-live="off">
      <Clock aria-hidden="true" size={14} /> Créneau réservé pour vous pendant {m}:{s}
    </p>
  );
}

/** The booking funnel (SPEC-03): one card per step on the left, a summary that fills in on the right. */
export function BookingFunnel({ profile, initialMe, initialMotiveId, initialSlot }: { profile: Profile; initialMe: Me | null; initialMotiveId?: string; initialSlot?: string }) {
  const router = useRouter();
  const motives = profile.agenda?.motives ?? [];
  const practice = profile.practices[0]!;
  const [me, setMe] = useState<Me | null>(initialMe);
  const [motive, setMotive] = useState<Motive | null>(() => motives.find((m) => m.id === initialMotiveId) ?? (motives.length === 1 ? motives[0]! : null));
  const [lock, setLock] = useState<Lock | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [relative, setRelative] = useState({ firstName: '', lastName: '', birthDate: '', relationship: 'ENFANT' });
  const [accepted, setAccepted] = useState(false);
  const [message, setMessage] = useState('');
  const [booked, setBooked] = useState<PatientAppointment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState<AvailabilityDays['days']>([]);
  const [reason, setReason] = useState<string | null>(null);
  const [loadedUntil, setLoadedUntil] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const headingRef = useRef<HTMLHeadingElement>(null);
  const triedInitialSlot = useRef(false);

  const step: StepId = booked
    ? 'confirmation'
    : !motive
      ? 'motif'
      : !lock
        ? 'creneau'
        : !me
          ? 'identification'
          : !person
            ? 'pour-qui'
            : 'consignes';

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const today = useMemo(() => toDateKey(new Date()), []);
  const horizonEnd = addDaysToDateKey(today, profile.agenda?.bookingHorizonDays ?? 90);

  const loadSlots = useCallback(
    async (from: string, reset: boolean) => {
      if (!motive) return;
      setLoadingSlots(true);
      try {
        const to = addDaysToDateKey(from, WINDOW_DAYS - 1);
        const res = await api<AvailabilityDays>(`/v1/practitioners/${profile.slug}/availabilities?motiveId=${motive.id}&from=${from}&to=${to}`);
        setReason(res.reason);
        setDays((prev) => (reset ? res.days : [...prev, ...res.days]));
        setLoadedUntil(to);
        if (reset) setOpenDay(res.days[0]?.date ?? null);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoadingSlots(false);
      }
    },
    [motive, profile.slug],
  );

  // Fill the first two weeks, skipping empty weeks so the patient sees slots straight away.
  useEffect(() => {
    if (step !== 'creneau') return;
    (async () => {
      setDays([]);
      await loadSlots(today, true);
    })();
  }, [step, loadSlots, today]);

  async function pickSlot(startsAt: string) {
    if (!motive || !profile.agenda) return;
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ agendaId: string; motiveId: string; startsAt: string; endsAt: string; expiresInSeconds: number }>('/v1/booking/locks', {
        method: 'POST',
        body: { agendaId: profile.agenda.id, motiveId: motive.id, startsAt },
      });
      setLock({ ...res, expiresAt: Date.now() + res.expiresInSeconds * 1000 });
    } catch (err) {
      setError(errorMessage(err));
      void loadSlots(today, true);
    } finally {
      setBusy(false);
    }
  }

  // A slot chosen on the search results page: hold it right away.
  useEffect(() => {
    if (triedInitialSlot.current || !initialSlot || !motive || lock) return;
    triedInitialSlot.current = true;
    void pickSlot(initialSlot);
  }, [initialSlot, motive]);

  const releaseLock = useCallback(async () => {
    if (!lock) return;
    const params = new URLSearchParams({ agendaId: lock.agendaId, startsAt: lock.startsAt });
    setLock(null);
    await api(`/v1/booking/locks?${params}`, { method: 'DELETE' }).catch(() => undefined);
  }, [lock]);

  const onLockExpired = useCallback(() => {
    setLock(null);
    setPerson(null);
    setError('Le créneau n’est plus réservé pour vous. Choisissez à nouveau un horaire.');
  }, []);

  async function confirm() {
    if (!lock || !person || !motive) return;
    setError(null);
    if (!accepted) {
      setError('Confirmez avoir lu les consignes du cabinet.');
      return;
    }
    if (person.kind === 'new' && (!relative.firstName.trim() || !relative.lastName.trim() || !relative.birthDate)) {
      setError('Renseignez le prénom, le nom et la date de naissance de votre proche.');
      return;
    }
    setBusy(true);
    try {
      const appointment = await api<PatientAppointment>('/v1/booking/appointments', {
        method: 'POST',
        body: {
          agendaId: lock.agendaId,
          motiveId: lock.motiveId,
          startsAt: lock.startsAt,
          instructionsAccepted: true,
          patientMessage: message.trim() || undefined,
          relativeId: person.kind === 'relative' ? person.id : undefined,
          newRelative: person.kind === 'new' ? relative : undefined,
        },
      });
      setBooked(appointment);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'SLOT_LOCK_EXPIRED' || err.code === 'SLOT_UNAVAILABLE')) {
        setLock(null);
        setPerson(null);
      }
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function back() {
    setError(null);
    if (step === 'consignes') setPerson(null);
    else if (step === 'pour-qui' || step === 'identification') void releaseLock();
    else if (step === 'creneau') {
      if (motives.length > 1) setMotive(null);
      else router.push(profile.url);
    } else router.push(profile.url);
  }

  const forName =
    person?.kind === 'me'
      ? `${me?.profile?.firstName} ${me?.profile?.lastName}`
      : person?.kind === 'relative'
        ? (() => {
            const r = me?.relatives.find((x) => x.id === person.id);
            return r ? `${r.firstName} ${r.lastName}` : '';
          })()
        : person?.kind === 'new' && relative.firstName
          ? `${relative.firstName} ${relative.lastName}`
          : null;

  const ics = booked
    ? `data:text/calendar;charset=utf-8,${encodeURIComponent(
        buildIcs({
          uid: booked.id,
          startsAt: booked.startsAt,
          endsAt: booked.endsAt,
          title: `Rendez-vous avec ${booked.practitioner.name}`,
          location: `${booked.practice.name}, ${booked.practice.addressLine}, ${booked.practice.locality}`,
        }),
      )}`
    : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="flex min-w-0 flex-col gap-5 p-5 sm:p-6">
        {step !== 'confirmation' ? (
          <button type="button" onClick={back} className="inline-flex items-center gap-1.5 self-start text-sm font-bold text-navy hover:text-primary">
            <ArrowLeft aria-hidden="true" size={16} /> Étape précédente
          </button>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {step === 'motif' ? (
          <section className="flex flex-col gap-4">
            <h2 ref={headingRef} tabIndex={-1} className="text-lg font-bold outline-none">
              Choisissez votre motif de consultation
            </h2>
            {motives.length === 0 ? (
              <p className="text-text">Ce soignant ne propose pas de réservation en ligne pour le moment.</p>
            ) : (
              <ul className="overflow-hidden rounded-md border border-border">
                {motives.map((m) => (
                  <li key={m.id} className="border-b border-border last:border-b-0">
                    <button type="button" onClick={() => setMotive(m)} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-ink hover:bg-primary-soft focus-visible:bg-primary-soft focus-visible:outline-none">
                      <span>{m.name}</span>
                      <span className="shrink-0 text-sm text-text-muted">
                        {m.durationMinutes} min{m.priceKmf !== null ? ` · ${formatKmf(m.priceKmf)}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {step === 'creneau' ? (
          <section className="flex flex-col gap-4" aria-busy={loadingSlots || busy}>
            <h2 ref={headingRef} tabIndex={-1} className="text-lg font-bold outline-none">
              Choisissez la date de consultation
            </h2>
            {reason === 'NEW_PATIENTS_NOT_ACCEPTED' ? (
              <p className="text-text">Ce motif est réservé aux patients déjà suivis par ce soignant.</p>
            ) : null}
            {days.length === 0 && !loadingSlots && !reason ? <p className="text-text">Aucun créneau disponible sur ces dates.</p> : null}
            <ul className="flex flex-col gap-2">
              {days.map((d) => {
                const open = openDay === d.date;
                const visible = showAll[d.date] ? d.slots : d.slots.slice(0, 8);
                return (
                  <li key={d.date} className="overflow-hidden rounded-md border border-border">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenDay(open ? null : d.date)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold text-ink first-letter:uppercase hover:bg-background-soft"
                    >
                      <span className="first-letter:uppercase">{formatDateLong(new Date(d.slots[0]!.startsAt))}</span>
                      <ChevronDown aria-hidden="true" size={18} className={cn('transition-transform', open && 'rotate-180')} />
                    </button>
                    {open ? (
                      <div className="border-t border-border p-4">
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {visible.map((s) => (
                            <button
                              key={s.startsAt}
                              type="button"
                              disabled={busy}
                              onClick={() => pickSlot(s.startsAt)}
                              className="h-11 rounded-md bg-slot text-sm font-medium text-ink tabular-nums hover:bg-primary hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
                            >
                              {formatTime(new Date(s.startsAt))}
                            </button>
                          ))}
                        </div>
                        {d.slots.length > visible.length ? (
                          <button type="button" onClick={() => setShowAll({ ...showAll, [d.date]: true })} className="mt-3 w-full text-center text-sm font-medium text-primary uppercase hover:underline">
                            Voir plus
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {loadedUntil && loadedUntil < horizonEnd && !reason ? (
              <Button variant="secondary" onClick={() => loadSlots(addDaysToDateKey(loadedUntil, 1), false)} disabled={loadingSlots}>
                {loadingSlots ? 'Chargement…' : 'Voir plus de dates'}
              </Button>
            ) : null}
          </section>
        ) : null}

        {step === 'identification' ? (
          <section className="flex flex-col gap-3">
            <h2 ref={headingRef} tabIndex={-1} className="sr-only outline-none">
              Identification
            </h2>
            {lock ? <Countdown expiresAt={lock.expiresAt} onExpire={onLockExpired} /> : null}
            <EmailOtpForm
              title="Identifiez-vous pour confirmer"
              onDone={(account) => {
                setMe(account);
                router.refresh();
              }}
            />
          </section>
        ) : null}

        {step === 'pour-qui' && me ? (
          <section className="flex flex-col gap-4">
            <h2 ref={headingRef} tabIndex={-1} className="text-lg font-bold outline-none">
              Pour qui prenez-vous rendez-vous ?
            </h2>
            {lock ? <Countdown expiresAt={lock.expiresAt} onExpire={onLockExpired} /> : null}
            <ul className="overflow-hidden rounded-md border border-border">
              <li className="border-b border-border">
                <button type="button" onClick={() => setPerson({ kind: 'me' })} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-primary-soft">
                  <UserRound aria-hidden="true" size={18} className="text-primary" />
                  <span className="text-ink">
                    Pour moi, {me.profile?.firstName} {me.profile?.lastName}
                  </span>
                </button>
              </li>
              {me.relatives.map((r) => (
                <li key={r.id} className="border-b border-border">
                  <button type="button" onClick={() => setPerson({ kind: 'relative', id: r.id })} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-primary-soft">
                    <UserRound aria-hidden="true" size={18} className="text-text-muted" />
                    <span className="text-ink">
                      {r.firstName} {r.lastName}
                    </span>
                  </button>
                </li>
              ))}
              <li>
                <button type="button" onClick={() => setPerson({ kind: 'new' })} className="flex w-full items-center gap-3 px-4 py-3.5 text-left font-medium text-primary hover:bg-primary-soft">
                  + Pour un proche (enfant, parent…)
                </button>
              </li>
            </ul>
          </section>
        ) : null}

        {step === 'consignes' && motive ? (
          <section className="flex flex-col gap-4">
            <h2 ref={headingRef} tabIndex={-1} className="text-lg font-bold outline-none">
              Vérifiez et confirmez
            </h2>
            {lock ? <Countdown expiresAt={lock.expiresAt} onExpire={onLockExpired} /> : null}
            {person?.kind === 'new' ? (
              <fieldset className="flex flex-col gap-3 rounded-md border border-border p-4">
                <legend className="px-1 text-sm font-bold text-ink">Votre proche</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
                    Prénom
                    <input value={relative.firstName} onChange={(e) => setRelative({ ...relative, firstName: e.target.value })} className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
                    Nom
                    <input value={relative.lastName} onChange={(e) => setRelative({ ...relative, lastName: e.target.value })} className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
                    Date de naissance
                    <input type="date" max={today} value={relative.birthDate} onChange={(e) => setRelative({ ...relative, birthDate: e.target.value })} className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
                    Lien
                    <select value={relative.relationship} onChange={(e) => setRelative({ ...relative, relationship: e.target.value })} className={inputClass}>
                      {RELATIONSHIPS.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </fieldset>
            ) : null}
            <div className="rounded-md bg-background-soft p-4 text-sm text-text">
              <p className="mb-1 font-bold text-ink">Consignes du cabinet</p>
              <p>{motive.instructions ?? 'Présentez-vous quelques minutes avant l’heure du rendez-vous.'}</p>
              <p className="mt-2">
                Annulation en ligne possible jusqu’à {motive.cancellationDeadlineHours} h avant le rendez-vous. Ensuite, appelez le cabinet.
              </p>
            </div>
            <label className="flex gap-3 text-sm text-text">
              <input type="checkbox" className="mt-1 size-4 accent-primary" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
              J’ai lu et j’accepte les consignes du cabinet.
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              Message pour le cabinet (facultatif)
              <textarea
                maxLength={200}
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Information pratique uniquement. Ne décrivez pas vos symptômes."
                className="rounded-md border border-border bg-surface p-3 text-ink focus:border-primary focus:outline-2 focus:outline-primary/30"
              />
              <span className="text-xs font-normal text-text-muted">{message.length}/200</span>
            </label>
            <Button size="lg" fullWidth onClick={confirm} disabled={busy}>
              {busy ? 'Confirmation…' : 'Confirmer le rendez-vous'}
            </Button>
          </section>
        ) : null}

        {step === 'confirmation' && booked ? (
          <section className="flex flex-col items-start gap-4" aria-live="polite">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
              <Check aria-hidden="true" size={26} />
            </span>
            <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold outline-none">
              {booked.status === 'CONFIRMED' ? 'Votre rendez-vous est confirmé' : 'Votre demande est envoyée'}
            </h2>
            <p className="text-text">
              <span className="first-letter:uppercase">{formatDateLong(new Date(booked.startsAt))}</span> à {formatTime(new Date(booked.startsAt))} avec {booked.practitioner.name}, pour {booked.forName}.
            </p>
            <p className="text-sm text-text">
              {booked.status === 'CONFIRMED'
                ? 'Vous allez recevoir un e-mail de confirmation, puis un rappel la veille.'
                : 'Le cabinet doit valider votre demande. Vous recevrez sa réponse par e-mail.'}
            </p>
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Link href="/mon-compte/rendez-vous" className={buttonClasses({ variant: 'primary' })}>
                Voir mes rendez-vous
              </Link>
              {ics ? (
                <a href={ics} download="rendez-vous-twabibu.ics" className={buttonClasses({ variant: 'secondary' })}>
                  <CalendarCheck aria-hidden="true" size={16} /> Ajouter à mon calendrier
                </a>
              ) : null}
            </div>
          </section>
        ) : null}
      </Card>

      <aside className="order-first lg:order-none">
        <Card className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft font-heading text-sm font-bold text-primary">
              {profile.initials}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-ink">{profile.displayName}</p>
              <p className="text-sm text-text">{profile.speciality.name}</p>
            </div>
          </div>
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-sm font-bold text-ink">Votre rendez-vous en détail</p>
            <ul className="grid gap-2 text-sm text-text">
              <li className="flex gap-2">
                <MapPin aria-hidden="true" size={16} className="mt-1 shrink-0 text-success" />
                {practice.addressLine}, {practice.locality.name}
              </li>
              {motive ? (
                <li className="flex gap-2">
                  <Stethoscope aria-hidden="true" size={16} className="mt-1 shrink-0 text-success" />
                  {motive.name}
                  {motive.priceKmf !== null ? ` · ${formatKmf(motive.priceKmf)}` : ''}
                </li>
              ) : null}
              {lock ? (
                <li className="flex gap-2">
                  <CalendarCheck aria-hidden="true" size={16} className="mt-1 shrink-0 text-success" />
                  <span className="first-letter:uppercase">
                    {formatDateLong(new Date(lock.startsAt))} à {formatTime(new Date(lock.startsAt))}
                  </span>
                </li>
              ) : booked ? (
                <li className="flex gap-2">
                  <CalendarCheck aria-hidden="true" size={16} className="mt-1 shrink-0 text-success" />
                  {formatDateLong(new Date(booked.startsAt))} à {formatTime(new Date(booked.startsAt))}
                </li>
              ) : null}
              {forName ? (
                <li className="flex gap-2">
                  <UserRound aria-hidden="true" size={16} className="mt-1 shrink-0 text-success" />
                  Pour {forName}
                </li>
              ) : null}
            </ul>
          </div>
        </Card>
      </aside>
    </div>
  );
}
