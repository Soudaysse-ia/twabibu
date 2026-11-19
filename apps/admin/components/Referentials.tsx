'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, cn } from '@twabibu/ui';
import { api, errorMessage } from '@/lib/api';
import { dateOnly, fieldClass, ISLAND } from '@/lib/ui';
import { Empty, Loading, Notice, PageTitle } from './Page';
import { useApi } from './useApi';

const BASE = '/v1/admin/referentials';
type Msg = { ok: boolean; text: string } | null;

const TABS = [
  ['specialites', 'Spécialités'],
  ['localites', 'Localités'],
  ['feries', 'Jours fériés'],
  ['medicaments', 'Médicaments'],
] as const;
type Tab = (typeof TABS)[number][0];

/** SPEC-11 §5: the back-office owns reference data (ADR-019). The site shows changes within a minute. */
export function Referentials() {
  const [tab, setTab] = useState<Tab>('specialites');
  return (
    <>
      <PageTitle title="Référentiels" />
      <p className="mb-4 text-sm text-text-muted">
        Ce qui est en usage ne se supprime pas : désactivez-le. Les adresses (identifiants dans les liens du site) ne changent jamais. Les modifications apparaissent sur le site en moins d’une minute.
      </p>
      <div role="tablist" aria-label="Référentiel" className="mb-4 flex gap-1 overflow-x-auto">
        {TABS.map(([key, label]) => (
          <button key={key} role="tab" type="button" aria-selected={tab === key} onClick={() => setTab(key)} className={cn('h-11 shrink-0 rounded-pill border px-4 text-sm font-medium', tab === key ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface text-navy')}>
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'specialites' ? <Specialities /> : tab === 'localites' ? <Localities /> : tab === 'feries' ? <Holidays /> : <Drugs />}
      </div>
    </>
  );
}

/** List on the left, form on the right (stacked on phones). */
function Layout({ list, form }: { list: React.ReactNode; form: React.ReactNode }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0">{list}</div>
      <div id="ref-form" className="flex scroll-mt-20 flex-col gap-3 xl:sticky xl:top-20 xl:self-start">
        {form}
      </div>
    </div>
  );
}

/** On a phone the form sits under a long list: bring it into view when an item is picked. */
function showForm() {
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1279px)').matches) {
    requestAnimationFrame(() => document.getElementById('ref-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
}

function ActiveBadge({ active }: { active: boolean }) {
  return active ? null : <Badge tone="warning">Désactivé</Badge>;
}

// ---- Specialities ---------------------------------------------------------------------------------

interface Speciality { id: string; name: string; slug: string; group: string; canPrescribe: boolean; defaultMotives: { name: string; durationMinutes: number }[]; sortOrder: number; isActive: boolean; publishedPractitioners: number }
const GROUPS: Record<string, string> = { MEDICAL: 'Médical', DENTAL: 'Dentaire', MIDWIFERY: 'Sage-femme', PARAMEDICAL: 'Paramédical', PHARMACY: 'Pharmacie', LAB: 'Laboratoire', WELLBEING: 'Bien-être' };
const emptySpeciality = { name: '', group: 'MEDICAL', canPrescribe: false, defaultMotives: [{ name: 'Consultation', durationMinutes: 20 }] };

function Specialities() {
  const { data, error, reload } = useApi<Speciality[]>(`${BASE}/specialities`);
  const [edit, setEdit] = useState<Speciality | null>(null);
  const [form, setForm] = useState<typeof emptySpeciality>(emptySpeciality);
  const [msg, setMsg] = useState<Msg>(null);
  const open = (s: Speciality | null) => {
    setEdit(s);
    showForm();
    setForm(s ? { name: s.name, group: s.group, canPrescribe: s.canPrescribe, defaultMotives: s.defaultMotives } : emptySpeciality);
    setMsg(null);
  };
  async function save(extra: { isActive?: boolean } = {}) {
    setMsg(null);
    try {
      const body = { ...form, defaultMotives: form.defaultMotives.filter((m) => m.name.trim()), ...extra };
      const saved = edit ? await api<Speciality>(`${BASE}/specialities/${edit.id}`, { method: 'PATCH', body }) : await api<Speciality>(`${BASE}/specialities`, { method: 'POST', body });
      setMsg({ ok: true, text: edit ? 'Spécialité enregistrée.' : `Spécialité créée (adresse : ${saved.slug}).` });
      setEdit(saved);
      reload();
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    }
  }
  const motives = form.defaultMotives;
  return (
    <Layout
      list={
        !data ? <Loading error={error} /> : (
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {data.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => open(s)} aria-current={edit?.id === s.id ? 'true' : undefined} className={cn('flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-background-soft', edit?.id === s.id && 'bg-primary-soft')}>
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{s.name}</span>
                    <span className="block text-xs text-text-muted">{GROUPS[s.group]} · {s.publishedPractitioners} soignant{s.publishedPractitioners > 1 ? 's' : ''} publié{s.publishedPractitioners > 1 ? 's' : ''} · {s.defaultMotives.length} motif{s.defaultMotives.length > 1 ? 's' : ''} modèle{s.canPrescribe ? ' · prescrit' : ''}</span>
                  </span>
                  <ActiveBadge active={s.isActive} />
                </button>
              </li>
            ))}
          </ul>
        )
      }
      form={
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-sm font-bold text-navy">{edit ? `Modifier « ${edit.name} »` : 'Nouvelle spécialité'}</h2>
            {edit ? <Button size="sm" variant="ghost" onClick={() => open(null)}><Plus aria-hidden="true" size={14} /> Nouvelle</Button> : null}
          </div>
          {edit ? <p className="text-xs text-text-muted">Adresse : <code>{edit.slug}</code> (ne change pas)</p> : null}
          <label className="text-sm font-medium text-ink">Nom<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={fieldClass} /></label>
          <label className="text-sm font-medium text-ink">Groupe
            <select value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} className={fieldClass}>
              {Object.entries(GROUPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
            <input type="checkbox" checked={form.canPrescribe} onChange={(e) => setForm({ ...form, canPrescribe: e.target.checked })} className="size-4 accent-primary" />
            Peut prescrire (s’applique aux nouveaux soignants)
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-ink">Motifs proposés à l’inscription</legend>
            {motives.map((m, i) => (
              <div key={i} className="flex gap-2">
                <input aria-label={`Motif ${i + 1}`} value={m.name} onChange={(e) => setForm({ ...form, defaultMotives: motives.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} className={fieldClass} />
                <input aria-label={`Durée du motif ${i + 1} (minutes)`} inputMode="numeric" value={m.durationMinutes} onChange={(e) => setForm({ ...form, defaultMotives: motives.map((x, j) => (j === i ? { ...x, durationMinutes: Number(e.target.value) || 0 } : x)) })} className={cn(fieldClass, 'w-20')} />
                <button type="button" aria-label={`Retirer le motif ${m.name || i + 1}`} onClick={() => setForm({ ...form, defaultMotives: motives.filter((_, j) => j !== i) })} className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-text hover:bg-background-soft"><Trash2 aria-hidden="true" size={16} /></button>
              </div>
            ))}
            {motives.length < 10 ? <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, defaultMotives: [...motives, { name: '', durationMinutes: 20 }] })} className="self-start"><Plus aria-hidden="true" size={14} /> Ajouter un motif</Button> : null}
            <p className="text-xs text-text-muted">Durée en minutes, de 5 à 240, par pas de 5.</p>
          </fieldset>
          <Button onClick={() => save()} disabled={form.name.trim().length < 2}>{edit ? 'Enregistrer' : 'Créer'}</Button>
          {edit ? (
            <Button variant="secondary" onClick={() => save({ isActive: !edit.isActive })}>{edit.isActive ? 'Désactiver' : 'Réactiver'}</Button>
          ) : null}
          <Notice message={msg} />
        </Card>
      }
    />
  );
}

// ---- Localities ---------------------------------------------------------------------------------------

interface Locality { id: string; name: string; slug: string; island: string; islandName: string; lat: number; lng: number; kind: string; isActive: boolean; practices: number; patients: number }
const KINDS: Record<string, string> = { town: 'Ville', village: 'Village', district: 'Quartier' };
const emptyLocality = { island: 'NGAZIDJA', name: '', lat: '', lng: '', kind: 'village' };

function Localities() {
  const [island, setIsland] = useState('ngazidja');
  const { data, error, reload } = useApi<Locality[]>(`${BASE}/localities?island=${island}`);
  const [edit, setEdit] = useState<Locality | null>(null);
  const [form, setForm] = useState(emptyLocality);
  const [msg, setMsg] = useState<Msg>(null);
  const open = (l: Locality | null) => {
    setEdit(l);
    showForm();
    setForm(l ? { island: l.island, name: l.name, lat: String(l.lat), lng: String(l.lng), kind: l.kind } : { ...emptyLocality, island: island.toUpperCase() });
    setMsg(null);
  };
  const num = (v: string) => Number(v.replace(',', '.'));
  async function save(extra: { isActive?: boolean } = {}) {
    setMsg(null);
    try {
      const body = { name: form.name, lat: num(form.lat), lng: num(form.lng), kind: form.kind, ...extra };
      const saved = edit ? await api<Locality>(`${BASE}/localities/${edit.id}`, { method: 'PATCH', body }) : await api<Locality>(`${BASE}/localities`, { method: 'POST', body: { ...body, island: form.island } });
      setMsg({ ok: true, text: edit ? 'Localité enregistrée.' : `Localité créée (adresse : ${saved.slug}).` });
      setEdit(saved);
      reload();
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    }
  }
  const map = form.lat && form.lng ? `https://www.openstreetmap.org/?mlat=${num(form.lat)}&mlon=${num(form.lng)}#map=14/${num(form.lat)}/${num(form.lng)}` : null;
  return (
    <>
      <div role="group" aria-label="Île" className="mb-3 flex gap-2">
        {(['ngazidja', 'ndzuani', 'mwali'] as const).map((i) => (
          <button key={i} type="button" aria-pressed={island === i} onClick={() => { setIsland(i); open(null); }} className={cn('h-11 rounded-pill border px-4 text-sm font-medium', island === i ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface')}>
            {ISLAND[i.toUpperCase()]}
          </button>
        ))}
      </div>
      <Layout
        list={
          !data ? <Loading error={error} /> : data.length === 0 ? <Empty>Aucune localité.</Empty> : (
            <ul className="divide-y divide-border rounded-md border border-border bg-surface">
              {data.map((l) => (
                <li key={l.id}>
                  <button type="button" onClick={() => open(l)} aria-current={edit?.id === l.id ? 'true' : undefined} className={cn('flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-background-soft', edit?.id === l.id && 'bg-primary-soft')}>
                    <span className="min-w-0">
                      <span className="block font-medium text-ink">{l.name}</span>
                      <span className="block text-xs text-text-muted">{KINDS[l.kind] ?? l.kind} · {l.lat.toFixed(4)}, {l.lng.toFixed(4)} · {l.practices} lieu{l.practices > 1 ? 'x' : ''} de soins</span>
                    </span>
                    <ActiveBadge active={l.isActive} />
                  </button>
                </li>
              ))}
            </ul>
          )
        }
        form={
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-heading text-sm font-bold text-navy">{edit ? `Modifier « ${edit.name} »` : `Nouvelle localité (${ISLAND[form.island]})`}</h2>
              {edit ? <Button size="sm" variant="ghost" onClick={() => open(null)}><Plus aria-hidden="true" size={14} /> Nouvelle</Button> : null}
            </div>
            {edit ? <p className="text-xs text-text-muted">Adresse : <code>{edit.slug}</code> (ne change pas)</p> : null}
            <label className="text-sm font-medium text-ink">Nom<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={fieldClass} /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm font-medium text-ink">Latitude<input inputMode="decimal" placeholder="-11.7015" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} className={fieldClass} /></label>
              <label className="text-sm font-medium text-ink">Longitude<input inputMode="decimal" placeholder="43.2560" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} className={fieldClass} /></label>
            </div>
            {map ? <a href={map} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:underline">Vérifier le point sur la carte</a> : null}
            <label className="text-sm font-medium text-ink">Type
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className={fieldClass}>
                {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <Button onClick={() => save()} disabled={form.name.trim().length < 2 || !form.lat || !form.lng}>{edit ? 'Enregistrer' : 'Créer'}</Button>
            {edit ? <Button variant="secondary" onClick={() => save({ isActive: !edit.isActive })}>{edit.isActive ? 'Désactiver' : 'Réactiver'}</Button> : null}
            <Notice message={msg} />
          </Card>
        }
      />
    </>
  );
}

// ---- Public holidays -----------------------------------------------------------------------------------

interface Holiday { date: string; name: string; isEstimated: boolean }

function Holidays() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const { data, error, setData } = useApi<Holiday[]>(`${BASE}/holidays?year=${year}`);
  const [edit, setEdit] = useState<Holiday | null>(null);
  const [form, setForm] = useState({ date: '', name: '', isEstimated: false });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const open = (h: Holiday | null) => {
    setEdit(h);
    showForm();
    setForm(h ? { ...h } : { date: '', name: '', isEstimated: false });
    setConfirmDelete(false);
    setMsg(null);
  };
  async function save() {
    setMsg(null);
    try {
      const list = edit ? await api<Holiday[]>(`${BASE}/holidays/${edit.date}`, { method: 'PATCH', body: form }) : await api<Holiday[]>(`${BASE}/holidays`, { method: 'POST', body: form });
      if (Number(form.date.slice(0, 4)) === year) setData(list);
      setEdit({ ...form });
      setMsg({ ok: true, text: 'Jour férié enregistré. Aucun créneau en ligne n’est proposé ce jour-là.' });
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    }
  }
  async function remove() {
    if (!edit) return;
    try {
      await api(`${BASE}/holidays/${edit.date}`, { method: 'DELETE' });
      setData((data ?? []).filter((h) => h.date !== edit.date));
      open(null);
      setMsg({ ok: true, text: 'Jour férié supprimé.' });
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    }
  }
  return (
    <>
      <div role="group" aria-label="Année" className="mb-3 flex gap-2">
        {[thisYear, thisYear + 1].map((y) => (
          <button key={y} type="button" aria-pressed={year === y} onClick={() => { setYear(y); open(null); }} className={cn('h-11 rounded-pill border px-4 text-sm font-medium', year === y ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface')}>
            {y}
          </button>
        ))}
      </div>
      <Layout
        list={
          !data ? <Loading error={error} /> : data.length === 0 ? <Empty>Aucun jour férié enregistré pour {year}.</Empty> : (
            <ul className="divide-y divide-border rounded-md border border-border bg-surface">
              {data.map((h) => (
                <li key={h.date}>
                  <button type="button" onClick={() => open(h)} aria-current={edit?.date === h.date ? 'true' : undefined} className={cn('flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-background-soft', edit?.date === h.date && 'bg-primary-soft')}>
                    <span className="min-w-0">
                      <span className="block font-medium text-ink">{h.name}</span>
                      <span className="block text-xs text-text-muted">{dateOnly(`${h.date}T12:00:00Z`)}</span>
                    </span>
                    {h.isEstimated ? <Badge tone="warning">Date estimée</Badge> : <Badge tone="success">Confirmée</Badge>}
                  </button>
                </li>
              ))}
            </ul>
          )
        }
        form={
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-heading text-sm font-bold text-navy">{edit ? `Modifier « ${edit.name} »` : 'Nouveau jour férié'}</h2>
              {edit ? <Button size="sm" variant="ghost" onClick={() => open(null)}><Plus aria-hidden="true" size={14} /> Nouveau</Button> : null}
            </div>
            <p className="text-xs text-text-muted">Les fêtes islamiques sont estimées à l’avance : confirmez la date dès l’annonce officielle.</p>
            <label className="text-sm font-medium text-ink">Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={fieldClass} /></label>
            <label className="text-sm font-medium text-ink">Nom<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={fieldClass} /></label>
            <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
              <input type="checkbox" checked={form.isEstimated} onChange={(e) => setForm({ ...form, isEstimated: e.target.checked })} className="size-4 accent-primary" />
              Date estimée (à confirmer)
            </label>
            <Button onClick={save} disabled={!form.date || form.name.trim().length < 2}>{edit ? 'Enregistrer' : 'Ajouter'}</Button>
            {edit ? (
              confirmDelete ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={remove}>Confirmer la suppression</Button>
                  <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Annuler</Button>
                </div>
              ) : (
                <Button variant="ghost" onClick={() => setConfirmDelete(true)}>Supprimer ce jour férié</Button>
              )
            ) : null}
            <Notice message={msg} />
          </Card>
        }
      />
    </>
  );
}

// ---- Drugs ---------------------------------------------------------------------------------------------------

interface Drug { id: string; dci: string; slug: string; strength: string; form: string; route: string; brandNames: string[]; atcCode: string | null; prescriptionOnly: boolean; controlled: boolean; essential: boolean; isActive: boolean; pharmacyProducts: number; prescriptionLines: number }
const ROUTES: Record<string, string> = { oral: 'Orale', injectable: 'Injectable', cutanee: 'Cutanée', inhalee: 'Inhalée', rectale: 'Rectale', ophtalmique: 'Ophtalmique', auriculaire: 'Auriculaire', nasale: 'Nasale', vaginale: 'Vaginale' };
const emptyDrug = { dci: '', strength: '', form: '', route: 'oral', brands: '', atcCode: '', prescriptionOnly: true, controlled: false, essential: false };

function Drugs() {
  const [q, setQ] = useState('');
  const { data, error, reload } = useApi<Drug[]>(`${BASE}/drugs${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  const [edit, setEdit] = useState<Drug | null>(null);
  const [form, setForm] = useState(emptyDrug);
  const [msg, setMsg] = useState<Msg>(null);
  const open = (d: Drug | null) => {
    setEdit(d);
    showForm();
    setForm(d ? { dci: d.dci, strength: d.strength, form: d.form, route: d.route, brands: d.brandNames.join(', '), atcCode: d.atcCode ?? '', prescriptionOnly: d.prescriptionOnly, controlled: d.controlled, essential: d.essential } : emptyDrug);
    setMsg(null);
  };
  async function save(extra: { isActive?: boolean } = {}) {
    setMsg(null);
    const common = { route: form.route, brandNames: form.brands.split(',').map((b) => b.trim()).filter(Boolean), atcCode: form.atcCode.trim().toUpperCase() || null, prescriptionOnly: form.prescriptionOnly || form.controlled, controlled: form.controlled, essential: form.essential };
    try {
      const saved = edit
        ? await api<Drug>(`${BASE}/drugs/${edit.id}`, { method: 'PATCH', body: { ...common, ...extra } })
        : await api<Drug>(`${BASE}/drugs`, { method: 'POST', body: { ...common, dci: form.dci, strength: form.strength, form: form.form } });
      setMsg({ ok: true, text: edit ? `Médicament enregistré${saved.pharmacyProducts ? ` ; ${saved.pharmacyProducts} produit(s) de pharmacie mis à jour` : ''}.` : 'Médicament ajouté au référentiel.' });
      setEdit(saved);
      reload();
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    }
  }
  return (
    <Layout
      list={
        <>
          <input aria-label="Rechercher un médicament" placeholder="DCI ou nom commercial" value={q} onChange={(e) => setQ(e.target.value)} className={cn(fieldClass, 'mb-3 max-w-sm')} />
          {!data ? <Loading error={error} /> : data.length === 0 ? <Empty>Aucun médicament.</Empty> : (
            <ul className="divide-y divide-border rounded-md border border-border bg-surface">
              {data.map((d) => (
                <li key={d.id}>
                  <button type="button" onClick={() => open(d)} aria-current={edit?.id === d.id ? 'true' : undefined} className={cn('flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-background-soft', edit?.id === d.id && 'bg-primary-soft')}>
                    <span className="min-w-0">
                      <span className="block font-medium text-ink">{d.dci} {d.strength} <span className="font-normal text-text">({d.form})</span></span>
                      <span className="block text-xs text-text-muted">{d.brandNames.join(', ') || 'sans nom commercial'} · {d.pharmacyProducts} pharmacie{d.pharmacyProducts > 1 ? 's' : ''} · {d.prescriptionLines} ligne{d.prescriptionLines > 1 ? 's' : ''} d’ordonnance</span>
                    </span>
                    <span className="flex flex-wrap gap-1">
                      {d.controlled ? <Badge tone="warning">Contrôlé</Badge> : d.prescriptionOnly ? <Badge tone="pharmacy">Sur ordonnance</Badge> : <Badge tone="info">Libre</Badge>}
                      <ActiveBadge active={d.isActive} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      }
      form={
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-sm font-bold text-navy">{edit ? `Modifier « ${edit.dci} ${edit.strength} »` : 'Nouveau médicament'}</h2>
            {edit ? <Button size="sm" variant="ghost" onClick={() => open(null)}><Plus aria-hidden="true" size={14} /> Nouveau</Button> : null}
          </div>
          {edit ? <p className="text-xs text-text-muted">DCI, dosage et forme définissent le médicament : pour les changer, créez-en un autre et désactivez celui-ci.</p> : null}
          <label className="text-sm font-medium text-ink">DCI<input value={form.dci} disabled={!!edit} onChange={(e) => setForm({ ...form, dci: e.target.value })} className={fieldClass} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm font-medium text-ink">Dosage<input placeholder="500 mg" value={form.strength} disabled={!!edit} onChange={(e) => setForm({ ...form, strength: e.target.value })} className={fieldClass} /></label>
            <label className="text-sm font-medium text-ink">Forme<input placeholder="comprimé" value={form.form} disabled={!!edit} onChange={(e) => setForm({ ...form, form: e.target.value })} className={fieldClass} /></label>
          </div>
          <label className="text-sm font-medium text-ink">Voie
            <select value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} className={fieldClass}>
              {Object.entries(ROUTES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-ink">Noms commerciaux (séparés par des virgules)<input value={form.brands} onChange={(e) => setForm({ ...form, brands: e.target.value })} className={fieldClass} /></label>
          <label className="text-sm font-medium text-ink">Code ATC (facultatif)<input placeholder="N02BE01" value={form.atcCode} onChange={(e) => setForm({ ...form, atcCode: e.target.value })} className={fieldClass} /></label>
          {(
            [
              ['prescriptionOnly', 'Sur ordonnance'],
              ['controlled', 'Contrôlé (toujours sur ordonnance, jamais commandable en ligne)'],
              ['essential', 'Liste nationale des médicaments essentiels'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex min-h-11 items-center gap-3 text-sm text-ink">
              <input type="checkbox" checked={form[key] || (key === 'prescriptionOnly' && form.controlled)} disabled={key === 'prescriptionOnly' && form.controlled} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} className="size-4 accent-primary" />
              {label}
            </label>
          ))}
          {edit && edit.pharmacyProducts ? <p className="text-xs text-text-muted">Les indicateurs « sur ordonnance » et « contrôlé » sont recopiés sur les {edit.pharmacyProducts} produit(s) des pharmacies.</p> : null}
          <Button onClick={() => save()} disabled={!edit && (form.dci.trim().length < 2 || !form.strength.trim() || form.form.trim().length < 2)}>{edit ? 'Enregistrer' : 'Ajouter'}</Button>
          {edit ? <Button variant="secondary" onClick={() => save({ isActive: !edit.isActive })}>{edit.isActive ? 'Retirer du référentiel' : 'Remettre dans le référentiel'}</Button> : null}
          <Notice message={msg} />
        </Card>
      }
    />
  );
}
