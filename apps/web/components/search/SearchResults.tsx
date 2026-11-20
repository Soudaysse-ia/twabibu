'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { Button, cn } from '@twabibu/ui';
import { PractitionerCard } from '@/components/PractitionerCard';
import type { SearchItem } from '@/lib/types';
import type { MapPoint } from './ResultsMap';

// Leaflet needs the browser: no server rendering for the map.
const ResultsMap = dynamic(() => import('./ResultsMap').then((m) => m.ResultsMap), { ssr: false, loading: () => <div className="size-full min-h-80 rounded-md bg-background-soft" /> });

/**
 * Result list and map side by side (SPEC-01 §9): numbered cards and pins, hover a card to highlight its pin.
 * Desktop: the map stays visible in a sticky right column. Mobile: « Afficher la carte » loads it on demand.
 */
export function SearchResults({ items, offset }: { items: SearchItem[]; offset: number }) {
  const [active, setActive] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  // The desktop column only exists on large screens: phones never download the map unless asked.
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  const points = useMemo<MapPoint[]>(
    () => items.flatMap((item, i) => (item.practice ? [{ id: item.id, number: offset + i + 1, label: `${offset + i + 1}. ${item.displayName}`, lat: item.practice.lat, lng: item.practice.lng }] : [])),
    [items, offset],
  );
  const select = useCallback((id: string) => {
    setActive(id);
    document.getElementById(`resultat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex flex-col gap-4">
        <Button variant="secondary" className="self-start lg:hidden" onClick={() => setShowMap(!showMap)} aria-expanded={showMap}>
          <MapIcon aria-hidden="true" size={16} /> {showMap ? 'Masquer la carte' : 'Afficher la carte'}
        </Button>
        {showMap && !desktop ? (
          <div className="h-72 lg:hidden">
            <ResultsMap points={points} activeId={active} onSelect={select} />
          </div>
        ) : null}
        <ol className="flex flex-col gap-4">
          {items.map((item, i) => (
            <li
              key={item.id}
              id={`resultat-${item.id}`}
              onMouseEnter={() => setActive(item.id)}
              onFocusCapture={() => setActive(item.id)}
              className={cn('relative rounded-md transition-shadow', active === item.id && 'ring-2 ring-primary')}
            >
              <span aria-hidden="true" className="absolute -top-2 -left-2 z-10 flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-card">
                {offset + i + 1}
              </span>
              <PractitionerCard item={item} />
            </li>
          ))}
        </ol>
      </div>
      {desktop ? (
        <div className="hidden lg:block">
          <div className="sticky top-4 h-[calc(100dvh-2rem)] max-h-[720px]">
            <ResultsMap points={points} activeId={active} onSelect={select} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
