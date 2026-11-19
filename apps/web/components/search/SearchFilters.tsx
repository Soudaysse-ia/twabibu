'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button, cn } from '@twabibu/ui';
import { Drawer } from '@/components/Drawer';
import type { SearchFacets } from '@/lib/types';

export interface FilterState {
  dispo?: string;
  langues: string[];
  paiement: string[];
  assurance?: string;
  nouveaux: boolean;
  tri: string;
}

const DISPO = [
  ['0', 'Aujourd’hui'],
  ['3', 'Sous 3 jours'],
  ['7', 'Sous 7 jours'],
  ['14', 'Sous 14 jours'],
] as const;

const SORT = [
  ['pertinence', 'Pertinence'],
  ['dispo', 'Prochaine disponibilité'],
  ['distance', 'Distance'],
] as const;

const FILTER_KEYS = ['dispo', 'langues', 'paiement', 'assurance', 'nouveaux', 'tri', 'page'];

/** Writes the filters into the URL (SPEC-01 §7): shareable, restored on reload, back to page 1. */
function hrefFor(base: Record<string, string>, f: FilterState): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) if (v && !FILTER_KEYS.includes(k)) q.set(k, v);
  if (f.dispo) q.set('dispo', f.dispo);
  if (f.langues.length) q.set('langues', f.langues.join(','));
  if (f.paiement.length) q.set('paiement', f.paiement.join(','));
  if (f.assurance) q.set('assurance', f.assurance);
  if (f.nouveaux) q.set('nouveaux', '1');
  if (f.tri !== 'pertinence') q.set('tri', f.tri);
  return `/recherche?${q}`;
}

const chip = (on: boolean) =>
  cn(
    'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary',
    on ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-ink hover:border-primary',
  );

export function SearchFilters({ params, current, facets, aroundMe }: { params: Record<string, string>; current: FilterState; facets: SearchFacets; aroundMe: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterState>(current);
  const go = (f: FilterState) => router.push(hrefFor(params, f));
  const advanced = current.langues.length + current.paiement.length + (current.assurance ? 1 : 0) + (current.tri !== 'pertinence' ? 1 : 0);
  const anything = advanced + (current.dispo ? 1 : 0) + (current.nouveaux ? 1 : 0);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Filtres" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <button
          type="button"
          className={chip(advanced > 0)}
          onClick={() => {
            setDraft(current);
            setOpen(true);
          }}
        >
          <SlidersHorizontal aria-hidden="true" size={16} /> Filtres{advanced ? ` (${advanced})` : ''}
        </button>
        {DISPO.map(([v, label]) => (
          <button key={v} type="button" aria-pressed={current.dispo === v} className={chip(current.dispo === v)} onClick={() => go({ ...current, dispo: current.dispo === v ? undefined : v })}>
            {label}
          </button>
        ))}
        <button type="button" aria-pressed={current.nouveaux} className={chip(current.nouveaux)} onClick={() => go({ ...current, nouveaux: !current.nouveaux })}>
          Nouveaux patients acceptés
        </button>
        {anything ? (
          <button
            type="button"
            className="inline-flex min-h-11 shrink-0 items-center gap-1 px-2 text-sm font-medium text-primary hover:underline"
            onClick={() => go({ langues: [], paiement: [], nouveaux: false, tri: 'pertinence' })}
          >
            <X aria-hidden="true" size={14} /> Effacer les filtres
          </button>
        ) : null}
      </div>

      {open ? (
        <Drawer title="Filtres" onClose={() => setOpen(false)}>
          <form
            className="flex flex-col gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              setOpen(false);
              go(draft);
            }}
          >
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-sm font-bold text-ink">Trier par</legend>
              {SORT.filter(([v]) => v !== 'distance' || aroundMe).map(([v, label]) => (
                <label key={v} className="flex min-h-11 items-center gap-3 text-sm text-text">
                  <input type="radio" name="tri" className="size-4 accent-primary" checked={draft.tri === v} onChange={() => setDraft({ ...draft, tri: v })} />
                  {label}
                </label>
              ))}
            </fieldset>
            {facets.languages.length ? (
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-1 text-sm font-bold text-ink">Langues parlées</legend>
                {facets.languages.map((l) => (
                  <label key={l.code} className="flex min-h-11 items-center gap-3 text-sm text-text">
                    <input type="checkbox" className="size-4 accent-primary" checked={draft.langues.includes(l.code)} onChange={() => setDraft({ ...draft, langues: toggle(draft.langues, l.code) })} />
                    {l.name}
                  </label>
                ))}
              </fieldset>
            ) : null}
            {facets.paymentMethods.length ? (
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-1 text-sm font-bold text-ink">Moyens de paiement</legend>
                {facets.paymentMethods.map((m) => (
                  <label key={m.code} className="flex min-h-11 items-center gap-3 text-sm text-text">
                    <input type="checkbox" className="size-4 accent-primary" checked={draft.paiement.includes(m.code)} onChange={() => setDraft({ ...draft, paiement: toggle(draft.paiement, m.code) })} />
                    {m.name}
                  </label>
                ))}
              </fieldset>
            ) : null}
            {facets.insurances.length ? (
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-1 text-sm font-bold text-ink">Assurance acceptée</legend>
                {[undefined, ...facets.insurances].map((name) => (
                  <label key={name ?? 'any'} className="flex min-h-11 items-center gap-3 text-sm text-text">
                    <input type="radio" name="assurance" className="size-4 accent-primary" checked={draft.assurance === name} onChange={() => setDraft({ ...draft, assurance: name })} />
                    {name ?? 'Peu importe'}
                  </label>
                ))}
              </fieldset>
            ) : null}
            <div className="sticky bottom-0 flex gap-2 border-t border-border bg-surface pt-3">
              <Button type="submit" fullWidth>
                Afficher les résultats
              </Button>
              <Button type="button" variant="secondary" onClick={() => setDraft({ ...draft, langues: [], paiement: [], assurance: undefined, tri: 'pertinence' })}>
                Effacer
              </Button>
            </div>
          </form>
        </Drawer>
      ) : null}
    </div>
  );
}
