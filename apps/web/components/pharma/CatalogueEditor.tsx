'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { Badge, Button, Card, cn } from '@twabibu/ui';
import { formatDateLong } from '@twabibu/utils';
import { fieldClass } from '@/components/Drawer';
import { api, errorMessage } from '@/lib/api-client';
import type { PharmaProduct } from '@/lib/pharma-types';
import type { Availability } from '@/lib/pharmacy-types';
import { usePharma } from './PharmaContext';

const t = fr.pharmacy;
const AVAIL: Availability[] = ['IN_STOCK', 'LOW', 'OUT_OF_STOCK', 'ON_ORDER'];
interface DrugHit { id: string; label: string; prescriptionOnly: boolean; controlled: boolean }

/** Catalogue (SPEC-15 §2): prices and stock kept by the pharmacy, CSV import. Staff update stock only. */
export function CatalogueEditor() {
  const m = usePharma();
  const [items, setItems] = useState<PharmaProduct[] | null>(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const load = useCallback(() => {
    api<PharmaProduct[]>(`${m.base}/products`).then(setItems).catch((e) => setError(errorMessage(e)));
  }, [m.base]);
  useEffect(load, [load]);

  async function patch(id: string, body: { priceKmf?: number; availability?: Availability }) {
    setError(null);
    try {
      const updated = await api<PharmaProduct>(`${m.base}/products/${id}`, { method: 'PATCH', body });
      setItems((list) => list?.map((p) => (p.id === id ? updated : p)) ?? null);
      setSaved(`${updated.name} : enregistré.`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const shown = (items ?? []).filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Catalogue</h1>
        <input aria-label="Rechercher" placeholder="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} className={cn(fieldClass, 'max-w-xs')} />
      </div>
      <p className="text-sm text-text-muted">
        Les prix sont affichés aux patients comme indicatifs, avec leur date de mise à jour. Les médicaments sur ordonnance restent visibles mais ne se commandent qu’avec une ordonnance ; les produits contrôlés se délivrent au comptoir.
      </p>
      {m.pharmacist ? <AddProduct onAdded={load} /> : null}
      {m.pharmacist ? <ImportCsv onDone={load} /> : null}
      <p aria-live="polite" className="text-sm text-success">
        {saved}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {!items ? (
        <p className="text-text-muted">Chargement…</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          <li aria-hidden="true" className="hidden bg-background-soft px-3 py-2 text-xs font-bold text-text-muted uppercase md:grid md:grid-cols-[minmax(0,1fr)_130px_180px_150px] md:gap-3">
            <span>Produit</span>
            <span>Prix (KMF)</span>
            <span>Disponibilité</span>
            <span>Mis à jour</span>
          </li>
          {shown.map((p) => (
            <li key={p.id} className="grid grid-cols-2 gap-2 px-3 py-3 text-sm md:grid-cols-[minmax(0,1fr)_130px_180px_150px] md:items-center md:gap-3">
              <div className="col-span-2 min-w-0 md:col-span-1">
                <span className="font-medium text-ink">{p.name}</span>
                <span className="ml-2 inline-flex flex-wrap gap-1">
                  {p.controlled ? <Badge tone="warning">{t.controlled}</Badge> : p.prescriptionOnly ? <Badge tone="pharmacy">{t.prescriptionOnly}</Badge> : null}
                  {p.category !== 'medication' ? <Badge tone="info">{t.categories[p.category]}</Badge> : null}
                </span>
              </div>
              <input
                aria-label={`Prix de ${p.name} (KMF)`}
                defaultValue={p.priceKmf}
                inputMode="numeric"
                disabled={!m.pharmacist}
                onBlur={(e) => {
                  const v = Number(e.target.value.replace(/\s/g, ''));
                  if (Number.isInteger(v) && v >= 0 && v !== p.priceKmf) void patch(p.id, { priceKmf: v });
                }}
                className={cn(fieldClass, 'text-base md:text-sm')}
              />
              <select aria-label={`Disponibilité de ${p.name}`} value={p.availability} onChange={(e) => patch(p.id, { availability: e.target.value as Availability })} className={cn(fieldClass, 'text-base md:text-sm')}>
                {AVAIL.map((a) => (
                  <option key={a} value={a}>
                    {t.availability[a]}
                  </option>
                ))}
              </select>
              <span className="col-span-2 text-xs text-text-muted md:col-span-1">mis à jour le {formatDateLong(new Date(p.updatedAt))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddProduct({ onAdded }: { onAdded: () => void }) {
  const m = usePharma();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'medication' | 'parapharmacy' | 'equipment'>('medication');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<DrugHit[]>([]);
  const [drug, setDrug] = useState<DrugHit | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (kind !== 'medication' || q.trim().length < 2 || drug) return setHits([]);
    const id = setTimeout(() => api<DrugHit[]>(`/v1/directory/drugs?q=${encodeURIComponent(q)}`).then(setHits).catch(() => undefined), 200);
    return () => clearTimeout(id);
  }, [q, kind, drug]);

  async function add() {
    setError(null);
    try {
      await api(`${m.base}/products`, { method: 'POST', body: { category: kind, priceKmf: Number(price) || 0, ...(kind === 'medication' ? { drugId: drug?.id } : { name }) } });
      setOpen(false);
      setDrug(null);
      setQ('');
      setName('');
      setPrice('');
      onAdded();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (!open)
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} className="self-start">
        <Plus aria-hidden="true" size={16} /> Ajouter un produit
      </Button>
    );
  return (
    <Card className="flex flex-col gap-3">
      <div role="group" aria-label="Type de produit" className="flex flex-wrap gap-1.5">
        {(['medication', 'parapharmacy', 'equipment'] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={cn('h-11 rounded-pill border px-4 text-sm font-medium', kind === k ? 'border-pharmacy bg-pharmacy-soft text-pharmacy' : 'border-border')}>
            {t.categories[k]}
          </button>
        ))}
      </div>
      {kind === 'medication' ? (
        drug ? (
          <p className="flex items-center gap-2 text-sm text-ink">
            {drug.label}
            <button type="button" onClick={() => setDrug(null)} className="text-primary underline">
              changer
            </button>
          </p>
        ) : (
          <div className="relative">
            <input aria-label="Médicament du référentiel" placeholder="Rechercher dans le référentiel (DCI ou nom commercial)" value={q} onChange={(e) => setQ(e.target.value)} className={fieldClass} />
            {hits.length ? (
              <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-60 overflow-auto rounded-md border border-border bg-surface shadow-float">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button type="button" onClick={() => setDrug(h)} className="w-full px-3 py-2 text-left text-sm hover:bg-primary-soft">
                      {h.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )
      ) : (
        <input aria-label="Nom du produit" placeholder="Nom du produit" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
      )}
      <input aria-label="Prix (KMF)" placeholder="Prix (KMF)" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className={cn(fieldClass, 'max-w-40')} />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button onClick={add} disabled={(kind === 'medication' ? !drug : name.trim().length < 2) || !price}>
          Ajouter
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Fermer
        </Button>
      </div>
    </Card>
  );
}

function ImportCsv({ onDone }: { onDone: () => void }) {
  const m = usePharma();
  const [report, setReport] = useState<{ created: number; updated: number; errors: { line: number; message: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      setReport(await api(`${m.base}/products/import`, { method: 'POST', body: { csv: await file.text() } }));
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <details className="rounded-md border border-border bg-surface p-3 text-sm">
      <summary className="flex cursor-pointer items-center gap-2 font-medium text-navy">
        <Upload aria-hidden="true" size={16} /> Importer un fichier CSV
      </summary>
      <div className="mt-3 flex flex-col gap-2 text-text">
        <p>
          Une ligne par produit : <code>nom ; prix ; disponibilité ; catégorie ; médicament</code>. Disponibilité : en stock, faible, rupture, sur commande. Catégorie : medicament, parapharmacie, materiel. Médicament : identifiant du référentiel (ex. <code>paracetamol-500-mg-comprime</code>), obligatoire pour un médicament.
        </p>
        <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="text-sm" aria-label="Fichier CSV" />
        {report ? (
          <p role="status">
            {report.created} ajouté{report.created > 1 ? 's' : ''}, {report.updated} mis à jour
            {report.errors.length ? `, ${report.errors.length} ligne${report.errors.length > 1 ? 's' : ''} ignorée${report.errors.length > 1 ? 's' : ''} : ${report.errors.slice(0, 5).map((e) => `ligne ${e.line} (${e.message})`).join(', ')}` : ''}.
          </p>
        ) : null}
        {error ? <p className="text-danger">{error}</p> : null}
      </div>
    </details>
  );
}
