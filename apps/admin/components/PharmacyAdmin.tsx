'use client';

import { useState } from 'react';
import { Badge, Button, Card, cn } from '@twabibu/ui';
import { formatKmf } from '@twabibu/utils';
import { api, errorMessage } from '@/lib/api';
import { dateOnly, dateTime, fieldClass, ISLAND, SLOT } from '@/lib/ui';
import { Empty, Loading, Notice, PageTitle } from './Page';
import { useApi } from './useApi';

interface Pharmacy { id: string; name: string; slug: string; status: string; verifiedAt: string | null; licenseNumber: string | null; locality: string | null; island: string | null }
interface Duty { id: string; pharmacyId: string; pharmacy: string; startsAt: string; endsAt: string; source: string; updatedAt: string }
interface Placement { id: string; pharmacyId: string; pharmacy: string; slot: string; island: string; startsAt: string; endsAt: string; priceKmf: number; active: boolean }

const ISLANDS = [['ngazidja', 'Ngazidja'], ['ndzuani', 'Ndzuani'], ['mwali', 'Mwali']] as const;

/** Pharmacy verification: a verified pharmacy takes orders and prescriptions. */
export function PharmacyVerification() {
  const { data, error, reload } = useApi<Pharmacy[]>('/v1/admin/pharmacies');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  if (!data) return <Loading error={error} />;
  async function set(p: Pharmacy, verified: boolean) {
    setNotice(null);
    try {
      await api(`/v1/admin/pharmacies/${p.id}/verification`, { method: 'POST', body: { verified, message: notes[p.id]?.trim() || undefined } });
      setNotice({ ok: true, text: `${p.name} : ${verified ? 'vérifiée, elle peut recevoir commandes et ordonnances' : 'vérification retirée'}. La pharmacie est prévenue par e-mail.` });
      reload();
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
    }
  }
  return (
    <>
      <PageTitle title="Pharmacies" />
      <p className="mb-4 text-sm text-text-muted">Vérifiez l’autorisation d’ouverture et le diplôme du titulaire avant de valider. Les pharmacies non vérifiées restent visibles dans l’annuaire mais ne reçoivent ni commandes ni ordonnances.</p>
      <Notice message={notice} />
      <ul className="mt-3 flex flex-col gap-2">
        {data.map((p) => (
          <li key={p.id}>
            <Card className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="font-bold text-ink">{p.name}</p>
                <p className="text-sm text-text-muted">{p.locality ?? '—'} ({p.island ? ISLAND[p.island] : '—'}) · licence {p.licenseNumber ?? 'non renseignée'}</p>
                <div className="mt-1">{p.verifiedAt ? <Badge tone="success">Vérifiée le {dateOnly(p.verifiedAt)}</Badge> : <Badge tone="warning">À vérifier</Badge>}</div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {p.verifiedAt ? (
                  <>
                    <input aria-label={`Motif du retrait pour ${p.name}`} placeholder="Motif du retrait" value={notes[p.id] ?? ''} onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })} className={cn(fieldClass, 'sm:w-64')} />
                    <Button variant="ghost" onClick={() => set(p, false)} disabled={(notes[p.id]?.trim().length ?? 0) < 5}>Retirer la vérification</Button>
                  </>
                ) : (
                  <Button onClick={() => set(p, true)}>Valider la pharmacie</Button>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Official duty calendar, per island, 14 days. Entry by hand or CSV import (all or nothing). */
export function DutyCalendar() {
  const [island, setIsland] = useState<string>('ngazidja');
  const { data, error, reload } = useApi<Duty[]>(`/v1/admin/duties?island=${island}`);
  const { data: pharmacies } = useApi<Pharmacy[]>('/v1/admin/pharmacies');
  const [form, setForm] = useState({ pharmacyId: '', startsAt: '', endsAt: '', source: 'Calendrier du ministère de la Santé' });
  const [csv, setCsv] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const code = island.toUpperCase();
  const islandPharmacies = (pharmacies ?? []).filter((p) => p.island === code);

  async function add() {
    setNotice(null);
    try {
      await api('/v1/admin/duties', { method: 'POST', body: { ...form, startsAt: form.startsAt.replace('T', ' '), endsAt: form.endsAt.replace('T', ' ') } });
      setNotice({ ok: true, text: 'Garde ajoutée : elle apparaît tout de suite sur la page publique.' });
      reload();
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
    }
  }
  async function importCsv() {
    setNotice(null);
    try {
      const r = await api<{ created: number; errors: { line: number; message: string }[] }>('/v1/admin/duties/import', { method: 'POST', body: { csv, source: form.source } });
      setNotice(r.errors.length ? { ok: false, text: `Rien n’a été importé : ${r.errors.map((e) => `ligne ${e.line} (${e.message})`).join(', ')}.` } : { ok: true, text: `${r.created} garde${r.created > 1 ? 's' : ''} importée${r.created > 1 ? 's' : ''}.` });
      if (!r.errors.length) {
        setCsv('');
        reload();
      }
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
    }
  }
  async function remove(d: Duty) {
    try {
      await api(`/v1/admin/duties/${d.id}`, { method: 'DELETE' });
      reload();
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
    }
  }

  return (
    <>
      <PageTitle title="Calendrier des gardes" />
      <div role="group" aria-label="Île" className="mb-4 flex gap-2">
        {ISLANDS.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={island === k} onClick={() => setIsland(k)} className={cn('h-11 rounded-pill border px-4 text-sm font-medium', island === k ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface')}>
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          {!data ? <Loading error={error} /> : data.length === 0 ? <Empty>Aucune garde sur les 14 prochains jours.</Empty> : (
            <ul className="divide-y divide-border rounded-md border border-border bg-surface">
              {data.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{d.pharmacy}</span>
                    <span className="block text-text-muted">{dateTime(d.startsAt)} → {dateTime(d.endsAt)} · {d.source}</span>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => remove(d)} aria-label={`Supprimer la garde de ${d.pharmacy} du ${dateTime(d.startsAt)}`}>Supprimer</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-2">
            <h2 className="font-heading text-sm font-bold text-navy">Ajouter une garde</h2>
            <select aria-label="Pharmacie" value={form.pharmacyId} onChange={(e) => setForm({ ...form, pharmacyId: e.target.value })} className={fieldClass}>
              <option value="">Pharmacie…</option>
              {islandPharmacies.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <label className="text-sm font-medium text-ink">Début (heure des Comores)<input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className={fieldClass} /></label>
            <label className="text-sm font-medium text-ink">Fin<input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className={fieldClass} /></label>
            <label className="text-sm font-medium text-ink">Source<input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className={fieldClass} /></label>
            <Button onClick={add} disabled={!form.pharmacyId || !form.startsAt || !form.endsAt}>Ajouter</Button>
          </Card>
          <Card className="flex flex-col gap-2">
            <h2 className="font-heading text-sm font-bold text-navy">Importer un calendrier (CSV)</h2>
            <p className="text-xs text-text-muted">Une ligne par garde : <code>identifiant-pharmacie ; 2026-11-20 19:30 ; 2026-11-21 08:00</code>. Si une ligne est fausse, rien n’est importé. La source ci-dessus est appliquée.</p>
            <textarea aria-label="Contenu CSV" rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} className="rounded-md border border-border p-3 font-mono text-xs" />
            <Button variant="secondary" onClick={importCsv} disabled={!csv.trim()}>Importer</Button>
            {pharmacies ? <p className="text-xs text-text-muted">Identifiants : {islandPharmacies.map((p) => p.slug).join(', ')}</p> : null}
          </Card>
          <Notice message={notice} />
        </div>
      </div>
    </>
  );
}

/** Sponsored placements: 3 per island and slot, always labelled « Partenaire », dated. */
export function Placements() {
  const { data, error, reload } = useApi<Placement[]>('/v1/admin/placements');
  const { data: pharmacies } = useApi<Pharmacy[]>('/v1/admin/pharmacies');
  const [form, setForm] = useState({ pharmacyId: '', slot: 'LOCALITY_TOP', island: 'NGAZIDJA', startsOn: '', endsOn: '', priceKmf: '80000' });
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  async function add() {
    setNotice(null);
    try {
      await api('/v1/admin/placements', { method: 'POST', body: { ...form, priceKmf: Number(form.priceKmf) || 0 } });
      setNotice({ ok: true, text: 'Emplacement réservé.' });
      reload();
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
    }
  }
  async function end(p: Placement) {
    try {
      await api(`/v1/admin/placements/${p.id}/end`, { method: 'POST' });
      reload();
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
    }
  }
  return (
    <>
      <PageTitle title="Espaces « Partenaire »" />
      <p className="mb-4 text-sm text-text-muted">Trois emplacements par île et par type. Jamais de mise en avant sur un médicament sur ordonnance (règle appliquée sur le site).</p>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          {!data ? <Loading error={error} /> : data.length === 0 ? <Empty>Aucun emplacement.</Empty> : (
            <ul className="divide-y divide-border rounded-md border border-border bg-surface">
              {data.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{p.pharmacy}</span>
                    <span className="block text-text-muted">{SLOT[p.slot]} · {ISLAND[p.island]} · {dateOnly(p.startsAt)} → {dateOnly(p.endsAt)} · {formatKmf(p.priceKmf)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {p.active ? <Badge tone="success">En cours</Badge> : new Date(p.endsAt) < new Date() ? <Badge tone="info">Terminé</Badge> : <Badge tone="info">À venir</Badge>}
                    {new Date(p.endsAt) > new Date() ? <Button size="sm" variant="ghost" onClick={() => end(p)}>Arrêter</Button> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Card className="flex flex-col gap-2 self-start">
          <h2 className="font-heading text-sm font-bold text-navy">Réserver un emplacement</h2>
          <select aria-label="Pharmacie" value={form.pharmacyId} onChange={(e) => setForm({ ...form, pharmacyId: e.target.value })} className={fieldClass}>
            <option value="">Pharmacie vérifiée…</option>
            {(pharmacies ?? []).filter((p) => p.verifiedAt).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select aria-label="Type d’emplacement" value={form.slot} onChange={(e) => setForm({ ...form, slot: e.target.value })} className={fieldClass}>
            {Object.entries(SLOT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select aria-label="Île" value={form.island} onChange={(e) => setForm({ ...form, island: e.target.value })} className={fieldClass}>
            {Object.entries(ISLAND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label className="text-sm font-medium text-ink">Du<input type="date" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} className={fieldClass} /></label>
          <label className="text-sm font-medium text-ink">Au (inclus)<input type="date" value={form.endsOn} onChange={(e) => setForm({ ...form, endsOn: e.target.value })} className={fieldClass} /></label>
          <label className="text-sm font-medium text-ink">Prix (KMF)<input inputMode="numeric" value={form.priceKmf} onChange={(e) => setForm({ ...form, priceKmf: e.target.value })} className={fieldClass} /></label>
          <Button onClick={add} disabled={!form.pharmacyId || !form.startsOn || !form.endsOn}>Réserver</Button>
          <Notice message={notice} />
        </Card>
      </div>
    </>
  );
}
