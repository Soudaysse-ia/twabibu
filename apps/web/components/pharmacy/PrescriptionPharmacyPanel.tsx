'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { Badge, Button, cn } from '@twabibu/ui';
import { formatKmf } from '@twabibu/utils';
import { fieldClass } from '@/components/Drawer';
import { api, errorMessage } from '@/lib/api-client';
import type { IslandSlug, Order, PharmacyCard, PharmacyProfile, PrescriptionShare } from '@/lib/pharmacy-types';
import { ISLANDS } from './IslandTabs';

const t = fr.pharmacy;

/** On a prescription of « Mes ordonnances »: send it to a pharmacy, read the answer, order (SPEC-15 §3). */
export function PrescriptionPharmacyPanel({ prescriptionId, canSend }: { prescriptionId: string; canSend: boolean }) {
  const [shares, setShares] = useState<PrescriptionShare[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api<PrescriptionShare[]>(`/v1/me/prescriptions/${prescriptionId}/shares`)
      .then(setShares)
      .catch((err) => setError(errorMessage(err)));
  }, [prescriptionId]);
  useEffect(load, [load]);

  if (!shares) return error ? <p className="text-sm text-danger">{error}</p> : null;
  const sentTo = new Set(shares.filter((s) => s.status !== 'DECLINED').map((s) => s.pharmacy.id));
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      {shares.map((s) => (
        <ShareView key={s.id} share={s} onChange={load} />
      ))}
      {canSend ? <SendForm prescriptionId={prescriptionId} exclude={sentTo} onSent={load} first={shares.length === 0} /> : null}
    </div>
  );
}

function SendForm({ prescriptionId, exclude, onSent, first }: { prescriptionId: string; exclude: Set<string>; onSent: () => void; first: boolean }) {
  const [open, setOpen] = useState(false);
  const [island, setIsland] = useState<IslandSlug>('ngazidja');
  const [list, setList] = useState<PharmacyCard[]>([]);
  const [pharmacyId, setPharmacyId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    api<PharmacyCard[]>(`/v1/pharmacies?island=${island}`)
      .then((rows) => {
        const usable = rows.filter((p) => p.verified && !exclude.has(p.id));
        setList(usable);
        setPharmacyId(usable[0]?.id ?? '');
      })
      .catch((err) => setError(errorMessage(err)));
  }, [open, island, exclude]);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/me/prescriptions/${prescriptionId}/shares`, { method: 'POST', body: { pharmacyId } });
      setOpen(false);
      onSent();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <Button variant={first ? 'primary' : 'secondary'} onClick={() => setOpen(true)} className="self-start">
        <Send aria-hidden="true" size={16} /> {first ? t.sendPrescription : 'Envoyer à une autre pharmacie'}
      </Button>
    );
  return (
    <div className="flex flex-col gap-3 rounded-md bg-background-soft p-3">
      <p className="text-sm text-text">{t.sendPrescriptionHint}</p>
      <div className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)]">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Île
          <select value={island} onChange={(e) => setIsland(e.target.value as IslandSlug)} className={cn(fieldClass, 'text-base sm:text-sm')}>
            {ISLANDS.map((i) => (
              <option key={i} value={i}>
                {t.islands[i]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-ink">
          {t.choosePharmacy}
          <select value={pharmacyId} onChange={(e) => setPharmacyId(e.target.value)} className={cn(fieldClass, 'text-base sm:text-sm')}>
            {list.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.locality?.name}
                {p.onDutyUntil ? ' · de garde' : p.openNow ? ' · ouverte' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button onClick={send} disabled={busy || !pharmacyId}>
          {busy ? 'Envoi…' : t.send}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Fermer
        </Button>
      </div>
    </div>
  );
}

function ShareView({ share, onChange }: { share: PrescriptionShare; onChange: () => void }) {
  const router = useRouter();
  const r = share.response;
  const [mode, setMode] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [profile, setProfile] = useState<PharmacyProfile | null>(null);
  const [address, setAddress] = useState({ line: '', localityId: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const counterOnly = !!r?.lines.some((l) => l.status !== 'UNAVAILABLE' && l.controlled);

  useEffect(() => {
    if (share.status !== 'ANSWERED') return;
    api<PharmacyProfile>(`/v1/pharmacies/${share.pharmacy.slug}`)
      .then((p) => {
        setProfile(p);
        setAddress((a) => ({ ...a, localityId: p.deliveryZones[0]?.localityId ?? '' }));
      })
      .catch(() => undefined);
  }, [share.status, share.pharmacy.slug]);
  const canDeliver = !!profile?.delivers && !!profile.deliveryZones.length && !counterOnly;
  const fee = mode === 'DELIVERY' ? (profile?.deliveryZones.find((z) => z.localityId === address.localityId)?.feeKmf ?? 0) : 0;

  async function accept() {
    setError(null);
    if (mode === 'DELIVERY' && (address.line.trim().length < 3 || address.phone.trim().length < 6)) return setError('Indiquez l’adresse et le téléphone du destinataire.');
    setBusy(true);
    try {
      const order = await api<Order>(`/v1/me/prescription-shares/${share.id}/accept`, { method: 'POST', body: mode === 'DELIVERY' ? { mode, address } : { mode } });
      router.push(`/mon-compte/commandes/${order.id}?nouvelle=1`);
    } catch (err) {
      setError(errorMessage(err));
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-ink">{share.pharmacy.name}</p>
        <Badge tone={share.status === 'ANSWERED' ? 'pharmacy' : share.status === 'ACCEPTED' ? 'success' : 'info'}>{t.shareStatus[share.status]}</Badge>
      </div>
      {r ? (
        <>
          <ul className="flex flex-col gap-1 text-sm">
            {r.lines.map((l) => (
              <li key={l.lineId} className="flex justify-between gap-3">
                <span className={cn(l.status === 'UNAVAILABLE' ? 'text-text-muted line-through' : 'text-ink')}>
                  {l.quantity} × {l.status === 'SUBSTITUTE' ? l.productName : l.label}
                  <span className="ml-1 text-xs text-text-muted no-underline">({t.lineStatus[l.status]})</span>
                </span>
                {l.unitPriceKmf !== null ? <span className="shrink-0">{formatKmf(l.unitPriceKmf * l.quantity)}</span> : null}
              </li>
            ))}
          </ul>
          <p className="text-sm font-bold text-ink">
            {t.total} : {formatKmf(r.totalKmf + fee)}
            {r.readyInMinutes !== null ? <span className="ml-2 font-normal text-text-muted">{t.readyIn(r.readyInMinutes)}</span> : null}
          </p>
          {r.message ? <p className="text-sm text-text">« {r.message} »</p> : null}
        </>
      ) : null}
      {share.order ? (
        <Link href={`/mon-compte/commandes/${share.order.id}`} className="self-start text-sm font-medium text-primary hover:underline">
          Suivre la commande · {t.orderStatus[share.order.status]}
        </Link>
      ) : null}
      {share.status === 'ANSWERED' && r && r.lines.some((l) => l.status !== 'UNAVAILABLE') ? (
        <div className="flex flex-col gap-2">
          <div role="radiogroup" aria-label="Mode de remise" className="flex flex-wrap gap-2">
            {(['PICKUP', 'DELIVERY'] as const).map((m) => (
              <label key={m} className={cn('flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm', mode === m ? 'border-primary bg-primary-soft' : 'border-border', m === 'DELIVERY' && !canDeliver && 'cursor-not-allowed opacity-50')}>
                <input type="radio" name={`mode-${share.id}`} checked={mode === m} disabled={m === 'DELIVERY' && !canDeliver} onChange={() => setMode(m)} className="size-4 accent-primary" />
                {m === 'PICKUP' ? t.pickup : t.delivery}
              </label>
            ))}
          </div>
          {counterOnly ? <p className="text-xs text-text-muted">{t.controlled} : retrait à la pharmacie.</p> : null}
          {mode === 'DELIVERY' && profile ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <select aria-label={t.addressLocality} value={address.localityId} onChange={(e) => setAddress({ ...address, localityId: e.target.value })} className={cn(fieldClass, 'text-base sm:text-sm')}>
                {profile.deliveryZones.map((z) => (
                  <option key={z.localityId} value={z.localityId}>
                    {z.locality} · {formatKmf(z.feeKmf)}
                  </option>
                ))}
              </select>
              <input aria-label={t.addressPhone} placeholder={t.addressPhone} inputMode="tel" value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} className={cn(fieldClass, 'text-base sm:text-sm')} />
              <input aria-label={t.addressLine} placeholder={t.addressLine} value={address.line} onChange={(e) => setAddress({ ...address, line: e.target.value })} className={cn(fieldClass, 'text-base sm:col-span-2 sm:text-sm')} />
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button onClick={accept} disabled={busy} className="self-start">
            {busy ? 'Envoi…' : t.acceptAnswer}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
