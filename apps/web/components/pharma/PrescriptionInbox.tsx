'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fr } from '@twabibu/i18n';
import { Badge, Button, Card, cn } from '@twabibu/ui';
import { formatDateLong, formatKmf, formatTime } from '@twabibu/utils';
import { fieldClass } from '@/components/Drawer';
import { api, errorMessage } from '@/lib/api-client';
import type { InboxItem, PharmaProduct } from '@/lib/pharma-types';
import { usePharma } from './PharmaContext';

type LineAnswer = { status: 'AVAILABLE' | 'SUBSTITUTE' | 'UNAVAILABLE'; productId: string; productName: string; unitPriceKmf: string; quantity: string };

const age = (birthDate: string | null) => {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  const now = new Date();
  return now.getFullYear() - b.getFullYear() - (now < new Date(now.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0);
};

/** Prescriptions received (SPEC-15 §3): read, answer line by line, the patient decides. */
export function PrescriptionInbox() {
  const m = usePharma();
  const [scope, setScope] = useState<'open' | 'done'>('open');
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [products, setProducts] = useState<PharmaProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api<InboxItem[]>(`${m.base}/prescriptions?status=${scope}`).then(setItems).catch((e) => setError(errorMessage(e)));
  }, [m.base, scope]);
  useEffect(() => {
    load();
    const id = setInterval(load, 5_000); // SPEC-15: a prescription shows up in under 5 s
    return () => clearInterval(id);
  }, [load]);
  useEffect(() => {
    api<PharmaProduct[]>(`${m.base}/products`).then(setProducts).catch(() => undefined);
  }, [m.base]);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Ordonnances reçues</h1>
        <div role="group" aria-label="Filtre" className="flex gap-1.5">
          {(['open', 'done'] as const).map((s) => (
            <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)} className={cn('h-11 rounded-pill border px-4 text-sm font-medium', scope === s ? 'border-pharmacy bg-pharmacy-soft text-pharmacy' : 'border-border bg-surface text-navy')}>
              {s === 'open' ? 'À traiter' : 'Traitées'}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-text-muted">Chaque ouverture est inscrite dans l’historique des accès du patient. Les ordonnances numériques s’authentifient par leur code (QR).</p>
      {error ? <p className="text-danger">{error}</p> : null}
      {!items ? (
        <p className="text-text-muted">Chargement…</p>
      ) : items.length === 0 ? (
        <Card className="text-text">{scope === 'open' ? 'Aucune ordonnance en attente.' : 'Aucune ordonnance traitée récemment.'}</Card>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((it) => (
            <li key={it.id}>
              <InboxCard item={it} products={products} onDone={load} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InboxCard({ item, products, onDone }: { item: InboxItem; products: PharmaProduct[]; onDone: () => void }) {
  const m = usePharma();
  const p = item.prescription;
  const editable = m.pharmacist && (item.status === 'SENT' || item.status === 'ANSWERED');
  const initial = useMemo(
    () =>
      Object.fromEntries(
        p.lines.map((l) => {
          const prev = item.response?.lines.find((x) => x.lineId === l.id);
          // Pre-select the catalogue product of the same reference drug, when in stock.
          const match = l.drugId ? products.find((x) => x.drugId === l.drugId && x.availability !== 'OUT_OF_STOCK') : undefined;
          return [
            l.id,
            {
              status: prev?.status ?? (match ? 'AVAILABLE' : 'UNAVAILABLE'),
              productId: prev?.productId ?? match?.id ?? '',
              productName: prev?.productName ?? '',
              unitPriceKmf: prev?.unitPriceKmf != null && !prev.productId ? String(prev.unitPriceKmf) : '',
              quantity: String(prev?.quantity ?? l.quantity ?? 1),
            } satisfies LineAnswer,
          ];
        }),
      ) as Record<string, LineAnswer>,
    [p.lines, item.response, products],
  );
  const [answers, setAnswers] = useState(initial);
  useEffect(() => setAnswers(initial), [initial]);
  const [ready, setReady] = useState(String(item.response?.readyInMinutes ?? 30));
  const [message, setMessage] = useState(item.response?.message ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const priceOf = (a: LineAnswer) => (a.status === 'UNAVAILABLE' ? 0 : a.productId ? (products.find((x) => x.id === a.productId)?.priceKmf ?? 0) : Number(a.unitPriceKmf) || 0);
  const total = p.lines.reduce((s, l) => s + priceOf(answers[l.id]!) * (Number(answers[l.id]!.quantity) || 1), 0);
  const set = (id: string, patch: Partial<LineAnswer>) => setAnswers((a) => ({ ...a, [id]: { ...a[id]!, ...patch } }));

  async function respond() {
    setError(null);
    setBusy(true);
    try {
      await api(`${m.base}/prescriptions/${item.id}/respond`, {
        method: 'POST',
        body: {
          lines: p.lines.map((l) => {
            const a = answers[l.id]!;
            const base = { lineId: l.id, status: a.status, quantity: Math.max(1, Number(a.quantity) || 1) };
            if (a.status === 'UNAVAILABLE') return base;
            return a.productId ? { ...base, productId: a.productId } : { ...base, productName: a.productName || undefined, unitPriceKmf: Number(a.unitPriceKmf) || 0 };
          }),
          readyInMinutes: Number(ready) || undefined,
          message: message.trim() || undefined,
        },
      });
      setSent(true);
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const expired = p.expiresAt ? new Date(p.expiresAt) < new Date() : false;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-ink">
            {item.patient.name}
            {age(item.patient.birthDate) !== null ? <span className="font-normal text-text-muted"> · {age(item.patient.birthDate)} ans</span> : null}
          </p>
          <p className="text-sm text-text">
            {p.prescriber} · signée le {p.signedAt ? formatDateLong(new Date(p.signedAt)) : '—'} · code <span className="font-mono">{p.code}</span>
          </p>
          <p className="text-xs text-text-muted">
            Reçue le {formatDateLong(new Date(item.sentAt))} à {formatTime(new Date(item.sentAt))}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {expired ? <Badge tone="warning">Expirée</Badge> : null}
          <Badge tone={item.status === 'SENT' ? 'pharmacy' : item.status === 'ACCEPTED' ? 'success' : 'info'}>{fr.pharmacy.shareStatus[item.status]}</Badge>
        </div>
      </div>
      {p.notes ? <p className="rounded-md bg-background-soft px-3 py-2 text-sm text-ink">Note du prescripteur : {p.notes}</p> : null}

      <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
        {p.lines.map((l) => {
          const a = answers[l.id]!;
          return (
            <li key={l.id} className="flex flex-col gap-2 p-3">
              <div>
                <p className="font-medium text-ink">
                  {l.label}
                  {l.controlled ? <Badge tone="warning" className="ml-2">Contrôlé · comptoir</Badge> : null}
                  {!l.substitutable ? <Badge tone="info" className="ml-2">Non substituable</Badge> : null}
                </p>
                <p className="text-sm text-text">
                  {l.posologyText}
                  {l.quantity ? ` · ${l.quantity} boîte${l.quantity > 1 ? 's' : ''}` : ''}
                  {l.durationDays ? ` · ${l.durationDays} jours` : ''}
                </p>
              </div>
              {editable ? (
                <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)_90px]">
                  <select aria-label={`Réponse pour ${l.label}`} value={a.status} onChange={(e) => set(l.id, { status: e.target.value as LineAnswer['status'] })} className={fieldClass}>
                    <option value="AVAILABLE">{fr.pharmacy.lineStatus.AVAILABLE}</option>
                    {l.substitutable ? <option value="SUBSTITUTE">{fr.pharmacy.lineStatus.SUBSTITUTE}</option> : null}
                    <option value="UNAVAILABLE">{fr.pharmacy.lineStatus.UNAVAILABLE}</option>
                  </select>
                  {a.status !== 'UNAVAILABLE' ? (
                    <select aria-label={`Produit pour ${l.label}`} value={a.productId} onChange={(e) => set(l.id, { productId: e.target.value })} className={fieldClass}>
                      <option value="">Hors catalogue (prix à saisir)</option>
                      {products
                        .filter((x) => x.category === 'medication')
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name} · {formatKmf(x.priceKmf)}
                            {x.availability === 'OUT_OF_STOCK' ? ' · rupture' : ''}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <span />
                  )}
                  {a.status !== 'UNAVAILABLE' ? <input aria-label="Quantité" inputMode="numeric" value={a.quantity} onChange={(e) => set(l.id, { quantity: e.target.value })} className={fieldClass} /> : null}
                  {a.status !== 'UNAVAILABLE' && !a.productId ? (
                    <div className="grid gap-2 sm:col-span-3 sm:grid-cols-2">
                      <input aria-label="Nom du produit" placeholder="Nom du produit délivré" value={a.productName} onChange={(e) => set(l.id, { productName: e.target.value })} className={fieldClass} />
                      <input aria-label="Prix unitaire (KMF)" placeholder="Prix unitaire (KMF)" inputMode="numeric" value={a.unitPriceKmf} onChange={(e) => set(l.id, { unitPriceKmf: e.target.value })} className={fieldClass} />
                    </div>
                  ) : null}
                </div>
              ) : item.response ? (
                (() => {
                  const r = item.response.lines.find((x) => x.lineId === l.id);
                  return r ? (
                    <p className="text-sm text-ink">
                      {fr.pharmacy.lineStatus[r.status]}
                      {r.unitPriceKmf !== null ? ` · ${r.productName} · ${r.quantity} × ${formatKmf(r.unitPriceKmf)}` : ''}
                    </p>
                  ) : null;
                })()
              ) : null}
            </li>
          );
        })}
      </ul>

      {editable ? (
        <div className="flex flex-col gap-3">
          <div className="grid gap-2 sm:grid-cols-[200px_minmax(0,1fr)]">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
              Prête dans (minutes)
              <input inputMode="numeric" value={ready} onChange={(e) => setReady(e.target.value)} className={fieldClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
              Message au patient (facultatif, sans conseil médical)
              <input value={message} maxLength={300} onChange={(e) => setMessage(e.target.value)} placeholder="Ex. Présentez l’ordonnance originale au retrait." className={fieldClass} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={respond} disabled={busy}>
              {busy ? 'Envoi…' : item.status === 'ANSWERED' ? 'Mettre à jour la réponse' : 'Répondre au patient'}
            </Button>
            <span className="text-sm font-bold text-ink">Total estimé : {formatKmf(total)}</span>
            {sent ? (
              <span role="status" className="text-sm text-success">
                Réponse envoyée. Le patient est prévenu par e-mail.
              </span>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : !m.pharmacist && item.status === 'SENT' ? (
        <p className="text-sm text-text-muted">Seul un pharmacien peut répondre à une ordonnance.</p>
      ) : null}
    </Card>
  );
}
