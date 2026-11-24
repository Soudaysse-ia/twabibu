'use client';

import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import dynamic from 'next/dynamic';
import { Crosshair, LocateFixed } from 'lucide-react';
import { COMOROS_BOUNDS, PracticeUpdateSchema, type OpeningHoursInput } from '@twabibu/contracts';
import { fr } from '@twabibu/i18n';
import { Button, Card, cn } from '@twabibu/ui';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { fieldClass } from './Drawer';
import { HoursEditor } from './HoursEditor';
import type { LatLng } from './PlacePicker';
import { useMembership } from './ProContext';

const PlacePicker = dynamic(() => import('./PlacePicker').then((m) => m.PlacePicker), {
  ssr: false,
  loading: () => <div className="h-64 w-full rounded-md bg-background-soft sm:h-80" />,
});

const t = fr.practiceEdit;
/** 16 px in fields on a phone, so that the browser does not zoom in (CLAUDE.md). */
const inputClass = fieldClass.replace(' text-sm ', ' text-base sm:text-sm ');

interface AccessInfo {
  floor?: string;
  wheelchair?: boolean;
  elevator?: boolean;
  parking?: boolean;
  notes?: string;
}
interface Place {
  id: string;
  name: string;
  addressLine: string;
  locality: { id: string; name: string; island: string };
  phone: string | null;
  position: LatLng | null;
  accessInfo: AccessInfo;
  openingHours: OpeningHoursInput;
}
interface Island {
  code: string;
  frenchName: string;
}
interface Locality {
  id: string;
  name: string;
  island: string;
  lat: number;
  lng: number;
}

const inComoros = (p: LatLng) =>
  p.lat >= COMOROS_BOUNDS.minLat &&
  p.lat <= COMOROS_BOUNDS.maxLat &&
  p.lng >= COMOROS_BOUNDS.minLng &&
  p.lng <= COMOROS_BOUNDS.maxLng;

function PracticeForm({
  place,
  islands,
  localities,
  canEdit,
  onSaved,
}: {
  place: Place;
  islands: Island[];
  localities: Locality[];
  canEdit: boolean;
  onSaved: (p: Place) => void;
}) {
  const membership = useMembership();
  const ids = useId();
  const [draft, setDraft] = useState({ ...place, phone: place.phone ?? '' });
  const [island, setIsland] = useState(
    localities.find((l) => l.id === place.locality.id)?.island ?? islands[0]?.code ?? '',
  );
  const [busy, setBusy] = useState(false);
  const [geo, setGeo] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const locality = localities.find((l) => l.id === draft.locality.id);
  const centre = locality ? { lat: locality.lat, lng: locality.lng } : null;
  const shown = draft.position ?? centre;

  function chooseLocality(id: string) {
    const l = localities.find((x) => x.id === id);
    if (!l) return;
    // A new town: the pin starts again from its centre.
    setDraft({ ...draft, locality: { id: l.id, name: l.name, island: l.island }, position: null });
  }

  function locate() {
    if (!navigator.geolocation) return setGeo(t.geoFailed);
    setGeo(t.locating);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = {
          lat: Math.round(pos.coords.latitude * 1e6) / 1e6,
          lng: Math.round(pos.coords.longitude * 1e6) / 1e6,
        };
        if (!inComoros(p)) return setGeo(t.geoOutside);
        setGeo(null);
        setDraft((d) => ({ ...d, position: p }));
      },
      () => setGeo(t.geoFailed),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const parsed = PracticeUpdateSchema.safeParse({
      name: draft.name,
      addressLine: draft.addressLine,
      localityId: draft.locality.id,
      phone: draft.phone.trim() || null,
      position: draft.position,
      accessInfo: draft.accessInfo,
      openingHours: draft.openingHours,
    });
    if (!parsed.success) {
      const field = String(parsed.error.issues[0]?.path[0] ?? '');
      return setMessage({ tone: 'error', text: t.errors[field] ?? fr.errors.VALIDATION_FAILED });
    }
    setBusy(true);
    try {
      const saved = await api<Place>(`/v1/pro/orgs/${membership.organizationId}/practices/${place.id}`, {
        method: 'PUT',
        body: parsed.data,
      });
      setDraft({ ...saved, phone: saved.phone ?? '' });
      onSaved(saved);
      setMessage({ tone: 'ok', text: t.saved });
    } catch (err) {
      const field =
        err instanceof ApiError ? (err.details as { field?: string } | undefined)?.field : undefined;
      setMessage({ tone: 'error', text: (field && t.errors[field]) || errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  const access = (patch: Partial<AccessInfo>) =>
    setDraft({ ...draft, accessInfo: { ...draft.accessInfo, ...patch } });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-4">
        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-bold">{draft.name || place.name}</h2>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            {t.name}
            <input
              maxLength={120}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            {t.address}
            <input
              maxLength={200}
              value={draft.addressLine}
              onChange={(e) => setDraft({ ...draft, addressLine: e.target.value })}
              aria-describedby={`${ids}-addr`}
              className={inputClass}
            />
            <span id={`${ids}-addr`} className="text-xs font-normal text-text-muted">
              {t.addressHint}
            </span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              {t.island}
              <select
                value={island}
                onChange={(e) => {
                  setIsland(e.target.value);
                  const first = localities.find((l) => l.island === e.target.value);
                  if (first) chooseLocality(first.id);
                }}
                className={inputClass}
              >
                {islands.map((i) => (
                  <option key={i.code} value={i.code}>
                    {i.frenchName}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              {t.locality}
              <select
                value={draft.locality.id}
                onChange={(e) => chooseLocality(e.target.value)}
                className={inputClass}
              >
                {localities
                  .filter((l) => l.island === island)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            {t.phone}
            <input
              type="tel"
              inputMode="tel"
              placeholder="773 12 34"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              aria-describedby={`${ids}-phone`}
              className={cn(inputClass, 'sm:max-w-xs')}
            />
            <span id={`${ids}-phone`} className="text-xs font-normal text-text-muted">
              {t.phoneHint}
            </span>
          </label>
        </Card>

        <Card className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-bold">{t.map}</h2>
            <p className="text-sm text-text-muted">{t.mapHint}</p>
          </div>
          {shown ? (
            <PlacePicker
              value={shown}
              onChange={(p) => canEdit && setDraft((d) => ({ ...d, position: p }))}
            />
          ) : null}
          {!draft.position ? <p className="text-sm text-text-muted">{t.noPin}</p> : null}
          <div className="flex flex-wrap gap-x-5">
            <button
              type="button"
              onClick={locate}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <LocateFixed aria-hidden="true" size={16} />
              {t.useHere}
            </button>
            {draft.position ? (
              <button
                type="button"
                onClick={() => setDraft({ ...draft, position: null })}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <Crosshair aria-hidden="true" size={16} />
                {t.centre}
              </button>
            ) : null}
          </div>
          <p aria-live="polite" className="text-sm text-text-muted">
            {geo}
          </p>
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="text-base font-bold">{t.access}</h2>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            {t.floor}
            <input
              maxLength={60}
              placeholder={t.floorPlaceholder}
              value={draft.accessInfo.floor ?? ''}
              onChange={(e) => access({ floor: e.target.value })}
              className={cn(inputClass, 'sm:max-w-xs')}
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-3">
            {(['wheelchair', 'elevator', 'parking'] as const).map((k) => (
              <label
                key={k}
                className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3 text-sm text-ink"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={!!draft.accessInfo[k]}
                  onChange={(e) => access({ [k]: e.target.checked })}
                />
                {t[k]}
              </label>
            ))}
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            {t.notes}
            <textarea
              rows={2}
              maxLength={300}
              value={draft.accessInfo.notes ?? ''}
              onChange={(e) => access({ notes: e.target.value })}
              className="rounded-md border border-border p-3 text-base text-ink focus:border-primary focus:outline-2 focus:outline-primary/30 sm:text-sm"
            />
          </label>
        </Card>

        <Card className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-bold">{t.hours}</h2>
            <p className="text-sm text-text-muted">{t.hoursHint}</p>
          </div>
          <HoursEditor
            value={draft.openingHours}
            onChange={(openingHours) => setDraft({ ...draft, openingHours })}
          />
        </Card>
      </fieldset>

      <div aria-live="polite">
        {message ? (
          <p
            role={message.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'rounded-md px-3 py-2 text-sm',
              message.tone === 'ok' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
            )}
          >
            {message.text}
          </p>
        ) : null}
      </div>
      {canEdit ? (
        <Button type="submit" size="lg" disabled={busy} className="sm:self-start">
          {busy ? t.saving : t.save}
        </Button>
      ) : null}
    </form>
  );
}

/** /pro/app/reglages/cabinet (PRO-06): every place of consultation of the practice. */
export function PracticeSettings() {
  const membership = useMembership();
  const [data, setData] = useState<{ canEdit: boolean; practices: Place[] } | null>(null);
  const [refs, setRefs] = useState<{ islands: Island[]; localities: Locality[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [practices, islands, localities] = await Promise.all([
        api<{ canEdit: boolean; practices: Place[] }>(`/v1/pro/orgs/${membership.organizationId}/practices`),
        api<Island[]>('/v1/directory/islands'),
        api<Locality[]>('/v1/directory/localities'),
      ]);
      setData(practices);
      setRefs({ islands, localities });
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [membership.organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <p className="rounded-md bg-warning-soft p-3 text-sm text-ink">{error}</p>;
  if (!data || !refs) return <p className="text-text-muted">{t.loading}</p>;
  return (
    <div className="flex flex-col gap-6">
      {!data.canEdit ? (
        <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-ink">{t.readOnly}</p>
      ) : null}
      {data.practices.map((p) => (
        <PracticeForm
          key={p.id}
          place={p}
          islands={refs.islands}
          localities={refs.localities}
          canEdit={data.canEdit}
          onSaved={(saved) =>
            setData({ ...data, practices: data.practices.map((x) => (x.id === saved.id ? saved : x)) })
          }
        />
      ))}
    </div>
  );
}
