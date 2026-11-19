'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ChevronRight, LocateFixed, MapPin, Search } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { cn } from '@twabibu/ui';
import { API_PUBLIC_BASE } from '@/lib/env';
import { localWhatSuggestions, localWhereSuggestions, type WhatSuggestion, type WhereSuggestion } from '@/lib/suggestions';

type Option = { key: string; slug: string; label: string; detail?: string; group: string };

function useSuggestions(term: string, kind: 'what' | 'where'): Option[] {
  const [options, setOptions] = useState<Option[]>([]);
  useEffect(() => {
    const local = (): Option[] =>
      kind === 'what'
        ? localWhatSuggestions(term).map((s) => toOption(s))
        : localWhereSuggestions(term).map((s) => toOption(s));
    if (term.trim().length < 2) {
      setOptions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const path = kind === 'what' ? 'suggest' : 'places';
        const res = await fetch(`${API_PUBLIC_BASE}/v1/search/${path}?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (kind === 'what') {
          setOptions([
            ...data.specialities.map((s: { slug: string; name: string }) => toOption({ kind: 'speciality', slug: s.slug, label: s.name })),
            ...data.practitioners.map((p: { slug: string; name: string; speciality: string; locality: string }) =>
              toOption({ kind: 'practitioner', slug: p.slug, label: p.name, detail: [p.speciality, p.locality].filter(Boolean).join(' · ') }),
            ),
          ]);
        } else {
          setOptions([
            ...data.islands.map((i: { slug: string; name: string; frenchName?: string }) =>
              toOption({ kind: 'island', slug: i.slug, label: i.name, detail: i.frenchName || undefined }),
            ),
            ...data.localities.map((l: { slug: string; name: string; island: string }) =>
              toOption({ kind: 'locality', slug: l.slug, label: l.name, detail: l.island }),
            ),
          ]);
        }
      } catch (error) {
        // API unreachable or slow network: fall back to the reference list shipped with the site.
        if ((error as Error).name !== 'AbortError') setOptions(local());
      }
    }, 150);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [term, kind]);
  return options;
}

const GROUP_LABEL: Record<string, string> = {
  speciality: fr.search.groupSpecialities,
  practitioner: 'Soignants',
  island: fr.search.groupIslands,
  locality: fr.search.groupLocalities,
};

function toOption(s: WhatSuggestion | WhereSuggestion): Option {
  return { key: `${s.kind}:${s.slug}`, slug: s.slug, label: s.label, detail: s.detail, group: s.kind };
}

interface ComboProps {
  id: string;
  label: string;
  placeholder: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  onPick: (o: Option) => void;
  className?: string;
  trailing?: React.ReactNode;
}

/** Accessible combobox (ARIA 1.2 pattern): arrows to move, Enter to pick, Escape to close. */
function Combo({ id, label, placeholder, icon, value, onChange, options, onPick, className, trailing }: ComboProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = `${id}-list`;
  const visible = open && options.length > 0;

  useEffect(() => setActive(-1), [options]);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!visible) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      onPick(options[active]!);
      setOpen(false);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className={cn('relative flex min-w-0 items-center gap-2.5 px-4 sm:px-5', className)}>
      <span className="shrink-0 text-navy-700">{icon}</span>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        className="h-14 w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-text-muted focus:outline-none sm:h-[60px]"
      />
      {trailing}
      {visible ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute top-full right-0 left-0 z-30 mt-2 max-h-80 overflow-auto rounded-md border border-border bg-surface py-2 shadow-float"
        >
          {options.map((o, i) => {
            const showGroup = i === 0 || options[i - 1]!.group !== o.group;
            return (
              <li key={o.key} role="presentation">
                {showGroup ? <div className="px-4 pt-2 pb-1 text-xs font-bold tracking-wide text-text-muted uppercase">{GROUP_LABEL[o.group]}</div> : null}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onPick(o);
                    setOpen(false);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn('cursor-pointer px-4 py-2 text-sm', i === active ? 'bg-primary-soft text-primary' : 'text-ink')}
                >
                  <span className="font-medium">{o.label}</span>
                  {o.detail ? <span className="ml-2 text-text-muted">{o.detail}</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** The pill search bar (60 px, radius 32): "what" + "where" + Rechercher. Stacks on phones. */
export function SearchBar({ initialWhat = '', initialWhere = '', className }: { initialWhat?: string; initialWhere?: string; className?: string }) {
  const router = useRouter();
  const uid = useId();
  const [what, setWhat] = useState(initialWhat);
  const [where, setWhere] = useState(initialWhere);
  const whatSlug = useRef<string | null>(null);
  const whereSlug = useRef<string | null>(null);
  const coords = useRef<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const whatOptions = useSuggestions(what, 'what');
  const whereOptions = useSuggestions(where, 'where');

  function go(next?: { what?: string; where?: string }) {
    const params = new URLSearchParams();
    const q = next?.what ?? (whatSlug.current ?? what.trim());
    const ou = next?.where ?? (whereSlug.current ?? where.trim());
    if (q) params.set('q', q);
    if (ou) params.set('ou', ou);
    if (coords.current && ou === 'autour-de-moi') {
      params.set('lat', coords.current.lat.toFixed(4));
      params.set('lng', coords.current.lng.toFixed(4));
    }
    router.push(`/recherche${params.size ? `?${params}` : ''}`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    go();
  }

  function aroundMe() {
    if (!('geolocation' in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        coords.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        whereSlug.current = 'autour-de-moi';
        setWhere(fr.search.aroundMe);
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000, maximumAge: 300_000 },
    );
  }

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      className={cn(
        'relative flex w-full flex-col rounded-lg bg-surface shadow-float sm:flex-row sm:items-stretch sm:rounded-pill',
        className,
      )}
    >
      <Combo
        id={`${uid}-what`}
        label={fr.search.whatLabel}
        placeholder={fr.search.whatPlaceholder}
        icon={<Search aria-hidden="true" size={18} />}
        value={what}
        onChange={(v) => {
          setWhat(v);
          whatSlug.current = null;
        }}
        options={whatOptions}
        onPick={(o) => {
          setWhat(o.label);
          whatSlug.current = o.group === 'practitioner' ? `soignant:${o.slug}` : o.slug;
        }}
        className="border-b border-background sm:flex-[1.2] sm:border-r sm:border-b-0"
      />
      <Combo
        id={`${uid}-where`}
        label={fr.search.whereLabel}
        placeholder={fr.search.wherePlaceholder}
        icon={<MapPin aria-hidden="true" size={18} />}
        value={where}
        onChange={(v) => {
          setWhere(v);
          whereSlug.current = null;
          coords.current = null;
        }}
        options={whereOptions}
        onPick={(o) => {
          setWhere(o.label);
          whereSlug.current = o.slug;
        }}
        className="sm:flex-1"
        trailing={
          <button
            type="button"
            onClick={aroundMe}
            aria-label={fr.search.aroundMe}
            title={fr.search.aroundMe}
            className={cn(
              'inline-flex size-9 shrink-0 items-center justify-center rounded-full text-navy-700 hover:bg-primary-soft hover:text-primary focus-visible:outline-2 focus-visible:outline-primary',
              locating && 'animate-pulse text-primary',
            )}
          >
            <LocateFixed aria-hidden="true" size={18} />
          </button>
        }
      />
      <button
        type="submit"
        className="m-2 inline-flex h-12 items-center justify-center gap-2 rounded-md bg-navy px-6 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:m-0 sm:h-auto sm:rounded-none sm:rounded-r-pill sm:border-4 sm:border-surface"
      >
        {fr.search.submit}
        <ChevronRight aria-hidden="true" size={18} />
      </button>
    </form>
  );
}
