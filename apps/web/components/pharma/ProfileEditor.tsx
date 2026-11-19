'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Badge, Button, Card, cn } from '@twabibu/ui';
import { fieldClass } from '@/components/Drawer';
import { api, errorMessage } from '@/lib/api-client';
import type { PharmaProfile } from '@/lib/pharma-types';
import { usePharma } from './PharmaContext';

const SERVICES: Record<string, string> = { DELIVERY: 'Livraison', PARAPHARMACY: 'Parapharmacie', MEDICAL_EQUIPMENT: 'Matériel médical', NIGHT_BELL: 'Sonnette de nuit' };
const PAYMENTS: Record<string, string> = { CASH: 'Espèces', CARD: 'Carte bancaire', MVOLA: 'MVola', HURI: 'Huri Money' };
interface Locality { id: string; name: string; island: string }

/** Public profile of the pharmacy: phone, services, payments, delivery zones and fees. */
export function ProfileEditor() {
  const m = usePharma();
  const [p, setP] = useState<PharmaProfile | null>(null);
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [add, setAdd] = useState({ localityId: '', fee: '1000' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    api<PharmaProfile>(`${m.base}/profile`).then(setP).catch((e) => setMessage({ ok: false, text: errorMessage(e) }));
    api<Locality[]>('/v1/directory/localities').then(setLocalities).catch(() => undefined);
  }, [m.base]);
  if (!p) return <p className="p-6 text-text-muted">{message?.text ?? 'Chargement…'}</p>;
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function save() {
    if (!p) return;
    setBusy(true);
    setMessage(null);
    try {
      setP(
        await api<PharmaProfile>(`${m.base}/profile`, {
          method: 'PUT',
          body: { phone: p.phone ?? undefined, description: p.description ?? '', services: p.services, paymentMethods: p.paymentMethods, deliveryZones: p.deliveryZones.map((z) => ({ localityId: z.localityId, feeKmf: z.feeKmf })) },
        }),
      );
      setMessage({ ok: true, text: 'Profil enregistré.' });
    } catch (e) {
      setMessage({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  const readOnly = !m.pharmacist;
  return (
    <div className="flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Profil de la pharmacie</h1>
        <Link href={`/pharmacie/${p.slug}`} className="text-sm font-medium text-primary hover:underline">
          Voir la page publique
        </Link>
      </div>
      <div className="flex gap-2">{p.verified ? <Badge tone="success">Pharmacie vérifiée</Badge> : <Badge tone="warning">En attente de vérification</Badge>}</div>
      <fieldset disabled={readOnly} className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Téléphone
            <input value={p.phone ?? ''} onChange={(e) => setP({ ...p, phone: e.target.value })} inputMode="tel" className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Présentation (affichée aux patients)
            <textarea rows={3} maxLength={1000} value={p.description ?? ''} onChange={(e) => setP({ ...p, description: e.target.value })} className="rounded-md border border-border p-3 text-sm font-normal focus:border-primary focus:outline-2 focus:outline-primary/30" />
          </label>
        </Card>
        <Card className="flex flex-col gap-3">
          <h2 className="font-heading text-sm font-bold text-navy">Services et paiements</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(SERVICES).map(([k, label]) => (
              <label key={k} className={cn('flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm', p.services.includes(k) ? 'border-pharmacy bg-pharmacy-soft' : 'border-border')}>
                <input type="checkbox" checked={p.services.includes(k)} onChange={() => setP({ ...p, services: toggle(p.services, k) })} className="size-4 accent-pharmacy" />
                {label}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PAYMENTS).map(([k, label]) => (
              <label key={k} className={cn('flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm', p.paymentMethods.includes(k) ? 'border-pharmacy bg-pharmacy-soft' : 'border-border')}>
                <input type="checkbox" checked={p.paymentMethods.includes(k)} onChange={() => setP({ ...p, paymentMethods: toggle(p.paymentMethods, k) })} className="size-4 accent-pharmacy" />
                {label}
              </label>
            ))}
          </div>
          <p className="text-xs text-text-muted">Le paiement se fait entre vous et le patient, au retrait ou à la livraison. Twabibu n’encaisse rien.</p>
        </Card>
        <Card className="flex flex-col gap-3">
          <h2 className="font-heading text-sm font-bold text-navy">Zones et frais de livraison</h2>
          {p.deliveryZones.length === 0 ? <p className="text-sm text-text">Aucune zone : la livraison n’est pas proposée.</p> : null}
          <ul className="flex flex-col gap-2">
            {p.deliveryZones.map((z, i) => (
              <li key={z.localityId} className="flex items-center gap-2 text-sm">
                <span className="flex-1 text-ink">{z.locality}</span>
                <input
                  aria-label={`Frais pour ${z.locality} (KMF)`}
                  inputMode="numeric"
                  value={z.feeKmf}
                  onChange={(e) => setP({ ...p, deliveryZones: p.deliveryZones.map((x, j) => (j === i ? { ...x, feeKmf: Number(e.target.value) || 0 } : x)) })}
                  className={cn(fieldClass, 'h-10 w-28')}
                />
                <span className="text-text-muted">KMF</span>
                <button type="button" aria-label={`Retirer ${z.locality}`} onClick={() => setP({ ...p, deliveryZones: p.deliveryZones.filter((_, j) => j !== i) })} className="inline-flex size-10 items-center justify-center rounded-md text-text hover:bg-background-soft">
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-ink">
              Ajouter une localité
              <select value={add.localityId} onChange={(e) => setAdd({ ...add, localityId: e.target.value })} className={fieldClass}>
                <option value="">Choisir…</option>
                {localities
                  .filter((l) => !p.deliveryZones.some((z) => z.localityId === l.id))
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </select>
            </label>
            <input aria-label="Frais (KMF)" inputMode="numeric" value={add.fee} onChange={(e) => setAdd({ ...add, fee: e.target.value })} className={cn(fieldClass, 'w-28')} />
            <Button
              variant="secondary"
              disabled={!add.localityId}
              onClick={() => {
                const l = localities.find((x) => x.id === add.localityId);
                if (l) setP({ ...p, deliveryZones: [...p.deliveryZones, { localityId: l.id, locality: l.name, feeKmf: Number(add.fee) || 0 }] });
                setAdd({ localityId: '', fee: add.fee });
              }}
            >
              Ajouter
            </Button>
          </div>
        </Card>
      </fieldset>
      {message ? (
        <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'text-sm text-success' : 'text-sm text-danger'}>
          {message.text}
        </p>
      ) : null}
      {readOnly ? <p className="text-sm text-text-muted">Seul un pharmacien peut modifier le profil.</p> : <Button onClick={save} disabled={busy} className="self-start">{busy ? 'Enregistrement…' : 'Enregistrer'}</Button>}
    </div>
  );
}
