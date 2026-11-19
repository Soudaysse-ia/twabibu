'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Globe, Phone, Plus, Store } from 'lucide-react';
import { Button, cn } from '@twabibu/ui';
import { addDaysToDateKey, formatDayHeader, formatTime, toDateKey, toMinutesOfDay, weekdayOf, zonedToUtc } from '@twabibu/utils';
import { api, errorMessage } from '@/lib/api-client';
import { layoutLanes } from '@/lib/agenda-layout';
import { AGENDA_COLORS, type AgendaEvents, type ProAgenda, type ProAppointment } from '@/lib/pro-types';
import { AppointmentDrawer } from './AppointmentDrawer';
import { NewAppointmentDrawer, type NewAppointmentDraft } from './NewAppointmentDrawer';
import { useMembership } from './ProContext';

const START = 7 * 60;
const END = 20 * 60;
const PX_PER_MIN = 1.15;
const HEIGHT = (END - START) * PX_PER_MIN;

// Literal class names so Tailwind generates them (tokens calendar-*).
const COLOR_CLASS: Record<string, string> = {
  blue: 'bg-calendar-blue',
  teal: 'bg-calendar-teal',
  green: 'bg-calendar-green',
  yellow: 'bg-calendar-yellow',
  orange: 'bg-calendar-orange',
  pink: 'bg-calendar-pink',
  purple: 'bg-calendar-purple',
  grey: 'bg-calendar-grey',
};

const STATUS_STYLE: Partial<Record<ProAppointment['status'], string>> = {
  ARRIVED: 'ring-2 ring-success',
  IN_CONSULTATION: 'ring-2 ring-primary',
  DONE: 'opacity-55',
  NO_SHOW: 'opacity-60 line-through decoration-danger',
  PENDING_VALIDATION: 'border-dashed border-warning',
};

function mondayOf(dateKey: string): string {
  const wd = weekdayOf(dateKey);
  return addDaysToDateKey(dateKey, wd === 0 ? -6 : 1 - wd);
}

interface Column {
  key: string;
  date: string;
  agendaId: string | null;
  label: { top: string; bottom: string };
}

/** The practice agenda (SPEC-05): week or day grid, online windows, absences, live "now" line. */
export function AgendaView() {
  const membership = useMembership();
  const org = membership.organizationId;
  const [agendas, setAgendas] = useState<ProAgenda[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<'week' | 'day'>('week');
  const [date, setDate] = useState(() => toDateKey(new Date()));
  const [events, setEvents] = useState<AgendaEvents | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<NewAppointmentDraft | null>(null);
  const [opened, setOpened] = useState<ProAppointment | null>(null);
  const [now, setNow] = useState(() => new Date());
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) setMode('day');
    // Deep link from the home page (« Demandes à valider »): /pro/app/agenda?rdv=<id> opens that appointment on its day.
    const rdv = new URLSearchParams(window.location.search).get('rdv');
    if (rdv)
      api<ProAppointment>(`/v1/pro/orgs/${org}/appointments/${encodeURIComponent(rdv)}`)
        .then((a) => {
          setDate(toDateKey(new Date(a.startsAt)));
          setOpened(a);
        })
        .catch((err) => setError(errorMessage(err)));
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, [org]);

  useEffect(() => {
    api<ProAgenda[]>(`/v1/pro/orgs/${org}/agendas`)
      .then((list) => {
        setAgendas(list);
        const mine = list.filter((a) => a.mine);
        setSelected((mine.length ? mine : list.slice(0, 1)).map((a) => a.id));
      })
      .catch((err) => setError(errorMessage(err)));
  }, [org]);

  const from = mode === 'week' ? mondayOf(date) : date;
  const to = mode === 'week' ? addDaysToDateKey(from, 6) : date;

  // Only the latest request may update the grid: a slower, older response must not overwrite it.
  const latest = useRef(0);
  const load = useCallback(async () => {
    const id = ++latest.current;
    if (!selected.length) {
      setEvents(null);
      return;
    }
    try {
      const data = await api<AgendaEvents>(`/v1/pro/orgs/${org}/agenda/events?from=${from}&to=${to}&agendaIds=${selected.join(',')}`);
      if (id !== latest.current) return;
      setEvents(data);
      setError(null);
    } catch (err) {
      if (id === latest.current) setError(errorMessage(err));
    }
  }, [org, from, to, selected]);

  useEffect(() => {
    void load();
  }, [load]);

  // Start the view around 07:30 / the current hour.
  useEffect(() => {
    if (!scroller.current) return;
    const minutes = Math.max(START, Math.min(END - 120, toMinutesOfDay(new Date()) - 60));
    scroller.current.scrollTop = (minutes - START) * PX_PER_MIN - 20;
  }, [mode]);

  const colorOf = useMemo(() => {
    const map = new Map(agendas.map((a, i) => [a.id, AGENDA_COLORS[i % AGENDA_COLORS.length]!]));
    return (agendaId: string) => (selected.length > 1 ? map.get(agendaId)! : 'blue');
  }, [agendas, selected]);

  const columns: Column[] =
    mode === 'week'
      ? Array.from({ length: 7 }, (_, i) => {
          const d = addDaysToDateKey(from, i);
          const h = formatDayHeader(zonedToUtc(d, 12 * 60));
          return { key: d, date: d, agendaId: null, label: { top: h.weekday, bottom: h.day } };
        })
      : selected.map((id) => {
          const a = agendas.find((x) => x.id === id);
          return { key: id, date, agendaId: id, label: { top: a?.practitioner.name ?? '', bottom: a?.practitioner.speciality ?? '' } };
        });

  function inColumn<T extends { agendaId: string }>(items: T[], col: Column, dayOf: (t: T) => string) {
    return items.filter((x) => dayOf(x) === col.date && (col.agendaId === null || x.agendaId === col.agendaId));
  }

  function openCreate(col: Column, y: number) {
    const minutes = Math.round((y / PX_PER_MIN + START) / 15) * 15;
    setDraft({ agendaId: col.agendaId ?? selected[0]!, startsAt: zonedToUtc(col.date, Math.min(minutes, END - 15)) });
  }

  const today = toDateKey(now);
  const nowMinutes = toMinutesOfDay(now);
  const title =
    mode === 'week'
      ? `Semaine du ${formatDayHeader(zonedToUtc(from, 12 * 60)).day} au ${formatDayHeader(zonedToUtc(to, 12 * 60)).day}`
      : (() => {
          const h = formatDayHeader(zonedToUtc(date, 12 * 60));
          return `${h.weekday} ${h.day}`;
        })();
  const counts = events ? events.appointments.length : 0;
  const holidays = new Map(events?.holidays.map((h) => [h.date, h.name]) ?? []);

  return (
    <div className="flex h-[calc(100dvh-3.5rem-5rem)] flex-col lg:h-[calc(100dvh-3.5rem)]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" onClick={() => setDate(toDateKey(new Date()))}>
            Aujourd’hui
          </Button>
          <button type="button" aria-label={mode === 'week' ? 'Semaine précédente' : 'Jour précédent'} onClick={() => setDate(addDaysToDateKey(date, mode === 'week' ? -7 : -1))} className="rounded-md p-1.5 text-text hover:bg-background-soft">
            <ChevronLeft aria-hidden="true" size={20} />
          </button>
          <button type="button" aria-label={mode === 'week' ? 'Semaine suivante' : 'Jour suivant'} onClick={() => setDate(addDaysToDateKey(date, mode === 'week' ? 7 : 1))} className="rounded-md p-1.5 text-text hover:bg-background-soft">
            <ChevronRight aria-hidden="true" size={20} />
          </button>
        </div>
        <h1 className="order-first min-w-0 basis-full truncate font-heading text-base font-bold first-letter:uppercase sm:order-none sm:flex-1 sm:basis-0 sm:text-lg">{title}</h1>
        <span className="hidden text-sm text-text-muted sm:inline">
          {counts} rendez-vous
        </span>
        <div role="group" aria-label="Affichage" className="flex overflow-hidden rounded-md border border-border">
          {(
            [
              ['day', 'Jour'],
              ['week', 'Semaine'],
            ] as const
          ).map(([v, l]) => (
            <button key={v} type="button" aria-pressed={mode === v} onClick={() => setMode(v)} className={cn('px-3 py-1.5 text-sm', mode === v ? 'bg-primary text-white' : 'bg-surface text-text hover:bg-background-soft')}>
              {l}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setDraft({ agendaId: selected[0] ?? agendas[0]?.id ?? '', startsAt: zonedToUtc(date, Math.max(8 * 60, Math.ceil(toMinutesOfDay(new Date()) / 15) * 15)) })} disabled={!agendas.length}>
          <Plus aria-hidden="true" size={16} /> <span className="hidden sm:inline">Rendez-vous</span>
        </Button>
      </div>

      {agendas.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto border-b border-border bg-surface px-3 py-2 sm:px-4" role="group" aria-label="Agendas affichés">
          {agendas.map((a) => {
            const on = selected.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={on}
                onClick={() => setSelected(on ? selected.filter((x) => x !== a.id) || [] : [...selected, a.id])}
                className={cn('flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1 text-sm', on ? 'border-primary bg-primary-soft text-primary' : 'border-border text-text')}
              >
                <span aria-hidden="true" className={cn('size-2.5 rounded-full', COLOR_CLASS[AGENDA_COLORS[agendas.indexOf(a) % AGENDA_COLORS.length]!])} />
                {a.practitioner.name}
              </button>
            );
          })}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mx-4 mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {!selected.length && agendas.length ? <p className="p-6 text-text">Sélectionnez au moins un agenda.</p> : null}

      {/* Grid */}
      <div ref={scroller} className="relative flex-1 overflow-auto bg-surface">
        <div className="sticky top-0 z-20 flex border-b border-border bg-surface" style={{ minWidth: columns.length * 120 + 56 }}>
          <div className="w-14 shrink-0" />
          {columns.map((c) => (
            <div key={c.key} className={cn('min-w-0 flex-1 border-l border-border px-2 py-2 text-center', c.date === today && mode === 'week' && 'bg-primary-soft')}>
              <p className="truncate text-sm font-bold text-ink capitalize">{c.label.top}</p>
              <p className="truncate text-xs text-text-muted">{c.label.bottom}</p>
              {mode === 'week' && holidays.get(c.date) ? <p className="truncate text-[11px] text-warning">{holidays.get(c.date)}</p> : null}
            </div>
          ))}
        </div>
        <div className="relative flex" style={{ height: HEIGHT, minWidth: columns.length * 120 + 56 }}>
          {/* Hours */}
          <div className="relative w-14 shrink-0">
            {Array.from({ length: (END - START) / 60 + 1 }, (_, i) => (
              <span key={i} className="absolute right-2 -translate-y-1/2 text-[11px] text-text-muted tabular-nums" style={{ top: i * 60 * PX_PER_MIN }}>
                {String(7 + i).padStart(2, '0')}:00
              </span>
            ))}
          </div>
          {columns.map((col) => {
            const windows = events ? inColumn(events.windows, col, (w) => w.date) : [];
            const absences = events ? inColumn(events.absences, col, (a) => toDateKey(new Date(a.startsAt))) : [];
            const appts = events ? inColumn(events.appointments, col, (a) => toDateKey(new Date(a.startsAt))) : [];
            const placed = layoutLanes(appts, (a) => new Date(a.startsAt).getTime(), (a) => new Date(a.endsAt).getTime());
            return (
              <div
                key={col.key}
                className="relative min-w-0 flex-1 cursor-copy border-l border-border"
                onClick={(e) => {
                  if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.slotbg) return;
                  openCreate(col, e.clientY - e.currentTarget.getBoundingClientRect().top);
                }}
              >
                {/* Hour lines */}
                {Array.from({ length: (END - START) / 30 }, (_, i) => (
                  <div key={i} data-slotbg="1" className={cn('absolute inset-x-0 border-t', i % 2 ? 'border-border/40 border-dashed' : 'border-border')} style={{ top: i * 30 * PX_PER_MIN, height: 30 * PX_PER_MIN }} />
                ))}
                {/* Online windows */}
                {windows.map((w, i) => (
                  <div key={i} data-slotbg="1" title="Plage réservable en ligne" className="absolute inset-x-0 bg-slot/70" style={{ top: (Math.max(w.startMinutes, START) - START) * PX_PER_MIN, height: (Math.min(w.endMinutes, END) - Math.max(w.startMinutes, START)) * PX_PER_MIN }} />
                ))}
                {/* Absences */}
                {absences.map((a) => {
                  const s = Math.max(START, toDateKey(new Date(a.startsAt)) < col.date ? START : toMinutesOfDay(new Date(a.startsAt)));
                  const e = Math.min(END, toDateKey(new Date(a.endsAt)) > col.date ? END : toMinutesOfDay(new Date(a.endsAt)));
                  return (
                    <div key={a.id} className="absolute inset-x-0 z-[1] bg-[repeating-linear-gradient(45deg,var(--color-background-soft),var(--color-background-soft)_6px,var(--color-border)_6px,var(--color-border)_7px)] px-1.5 pt-1 text-[11px] text-text-muted" style={{ top: (s - START) * PX_PER_MIN, height: Math.max(0, e - s) * PX_PER_MIN }}>
                      Absence{a.reason ? ` · ${a.reason}` : ''}
                    </div>
                  );
                })}
                {/* Appointments */}
                {placed.map(({ item: a, lane, lanes }) => {
                  const s = toMinutesOfDay(new Date(a.startsAt));
                  const e = toMinutesOfDay(new Date(a.endsAt)) || 24 * 60;
                  if (e <= START || s >= END) return null;
                  const top = (Math.max(s, START) - START) * PX_PER_MIN;
                  const height = Math.max(18, (Math.min(e, END) - Math.max(s, START)) * PX_PER_MIN - 2);
                  const SourceIcon = a.source === 'ONLINE' ? Globe : a.source === 'WALK_IN' ? Store : Phone;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setOpened(a)}
                      className={cn(
                        'absolute z-[2] overflow-hidden rounded-md border border-ink/10 px-1.5 py-0.5 text-left text-[11px] leading-tight text-ink shadow-card hover:z-10 hover:shadow-float focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-primary',
                        COLOR_CLASS[colorOf(a.agendaId)],
                        STATUS_STYLE[a.status],
                      )}
                      style={{ top, height, left: `calc(${(lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)` }}
                      aria-label={`${formatTime(new Date(a.startsAt))}, ${a.patient.firstName} ${a.patient.lastName}, ${a.motive.name}`}
                    >
                      <span className="flex items-center gap-1 font-medium tabular-nums">
                        <SourceIcon aria-hidden="true" size={10} className="shrink-0" />
                        {formatTime(new Date(a.startsAt))}
                        <span className="truncate font-bold">
                          {a.patient.firstName} {a.patient.lastName}
                        </span>
                      </span>
                      {height > 30 ? <span className="block truncate text-text">{a.motive.name}</span> : null}
                    </button>
                  );
                })}
                {/* Now line */}
                {col.date === today && nowMinutes >= START && nowMinutes <= END ? (
                  <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-[3] border-t-2 border-danger" style={{ top: (nowMinutes - START) * PX_PER_MIN }}>
                    <span className="absolute -top-1.5 -left-1 size-3 rounded-full bg-danger" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border bg-surface px-4 py-2 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3 rounded-sm bg-slot" /> Plage ouverte en ligne
        </span>
        <span className="flex items-center gap-1.5">
          <Globe aria-hidden="true" size={12} /> En ligne
        </span>
        <span className="flex items-center gap-1.5">
          <Phone aria-hidden="true" size={12} /> Téléphone
        </span>
        <span className="flex items-center gap-1.5">
          <Store aria-hidden="true" size={12} /> Sur place
        </span>
        <span>Cliquez sur un horaire libre pour ajouter un rendez-vous.</span>
      </div>

      {draft ? (
        <NewAppointmentDrawer
          agendas={agendas.filter((a) => selected.includes(a.id)).length ? agendas.filter((a) => selected.includes(a.id)) : agendas}
          draft={draft}
          onClose={() => setDraft(null)}
          onCreated={() => {
            setDraft(null);
            void load();
          }}
        />
      ) : null}
      {opened ? (
        <AppointmentDrawer
          key={opened.id + opened.status + opened.startsAt}
          appointment={opened}
          onClose={() => setOpened(null)}
          onChanged={() => {
            setOpened(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
