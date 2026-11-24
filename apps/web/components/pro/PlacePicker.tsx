'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';
import { fr } from '@twabibu/i18n';

export interface LatLng {
  lat: number;
  lng: number;
}

// Literal class names so Tailwind generates them (design tokens only).
const PIN = 'block size-6 rounded-full border-4 border-white bg-primary shadow-card';

/**
 * OpenStreetMap with one draggable pin (PRO-06). Dragging the pin or tapping the map moves it.
 * Leaflet is loaded in the browser only; the buttons next to the map are the keyboard alternative.
 */
export function PlacePicker({ value, onChange }: { value: LatLng; onChange: (p: LatLng) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const pin = useRef<Marker | null>(null);
  const change = useRef(onChange);
  useEffect(() => {
    change.current = onChange;
  }, [onChange]);

  // Built once; later moves only shift the pin.
  const initial = useRef(value);
  useEffect(() => {
    let cancelled = false;
    void import('leaflet').then((L) => {
      if (cancelled || !el.current) return;
      const start = initial.current;
      const m = L.map(el.current, { scrollWheelZoom: false }).setView([start.lat, start.lng], 16);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; contributeurs OpenStreetMap',
      }).addTo(m);
      const marker = L.marker([start.lat, start.lng], {
        draggable: true,
        icon: L.divIcon({
          className: '',
          html: `<span class="${PIN}"></span>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
        title: fr.practiceEdit.pinLabel,
        alt: fr.practiceEdit.pinLabel,
      }).addTo(m);
      const round = (n: number) => Math.round(n * 1e6) / 1e6;
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        change.current({ lat: round(p.lat), lng: round(p.lng) });
      });
      m.on('click', (e) => change.current({ lat: round(e.latlng.lat), lng: round(e.latlng.lng) }));
      map.current = m;
      pin.current = marker;
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      pin.current = null;
    };
  }, []);

  useEffect(() => {
    const marker = pin.current;
    if (!marker) return;
    const at = marker.getLatLng();
    if (at.lat === value.lat && at.lng === value.lng) return;
    marker.setLatLng([value.lat, value.lng]);
    map.current?.panTo([value.lat, value.lng]);
  }, [value]);

  return (
    <div
      ref={el}
      className="z-0 h-64 w-full rounded-md border border-border bg-background-soft sm:h-80"
      role="region"
      aria-label={fr.practiceEdit.mapLabel}
    />
  );
}
