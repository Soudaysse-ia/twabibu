'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';

export interface MapPoint {
  id: string;
  number: number;
  label: string;
  lat: number;
  lng: number;
}

const COMOROS = { lat: -11.9, lng: 43.6, zoom: 8 };
// Literal class names so Tailwind generates them (design tokens only).
const PIN = 'flex size-8 items-center justify-center rounded-full border-2 border-white text-sm font-bold shadow-card transition-transform';
const PIN_IDLE = `${PIN} bg-primary text-white`;
const PIN_ACTIVE = `${PIN} bg-navy text-white scale-125`;

/**
 * OpenStreetMap with numbered pins matching the list (SPEC-01 §9). Leaflet is loaded in the browser only.
 * Hovering a card highlights its pin; clicking a pin highlights and scrolls to the card.
 */
export function ResultsMap({ points, activeId, onSelect }: { points: MapPoint[]; activeId: string | null; onSelect: (id: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    const pins = markers.current;
    void import('leaflet').then((L) => {
      if (cancelled || !el.current) return;
      const m = L.map(el.current, { scrollWheelZoom: false }).setView([COMOROS.lat, COMOROS.lng], COMOROS.zoom);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; contributeurs OpenStreetMap' }).addTo(m);
      // Several practitioners at the same address (a clinic): spread their pins side by side instead of stacking them.
      const sameSpot = new Map<string, MapPoint[]>();
      for (const p of points) sameSpot.set(`${p.lat},${p.lng}`, [...(sameSpot.get(`${p.lat},${p.lng}`) ?? []), p]);
      for (const p of points) {
        const group = sameSpot.get(`${p.lat},${p.lng}`)!;
        const shift = (group.indexOf(p) - (group.length - 1) / 2) * 34;
        const marker = L.marker([p.lat, p.lng], {
          icon: L.divIcon({ className: '', html: `<span class="${PIN_IDLE}">${p.number}</span>`, iconSize: [32, 32], iconAnchor: [16 - shift, 16] }),
          title: p.label,
          alt: p.label,
          keyboard: true,
        }).addTo(m);
        marker.on('click', () => select.current(p.id));
        pins.set(p.id, marker);
      }
      if (points.length) m.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])).pad(0.3), { maxZoom: 14 });
      map.current = m;
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      pins.clear();
    };
  }, [points]);

  useEffect(() => {
    for (const [id, marker] of markers.current) {
      const pin = marker.getElement()?.querySelector('span');
      if (pin) pin.className = id === activeId ? PIN_ACTIVE : PIN_IDLE;
      marker.setZIndexOffset(id === activeId ? 1000 : 0);
    }
  }, [activeId]);

  return <div ref={el} className="z-0 size-full min-h-80 rounded-md border border-border bg-background-soft" role="region" aria-label="Carte des résultats" />;
}
