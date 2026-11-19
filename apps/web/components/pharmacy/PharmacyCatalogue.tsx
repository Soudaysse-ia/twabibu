'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Minus, Plus, Search, ShoppingBag } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { Badge, Button, cn } from '@twabibu/ui';
import { formatDateLong, formatKmf } from '@twabibu/utils';
import { Drawer, fieldClass } from '@/components/Drawer';
import { EmailOtpForm } from '@/components/EmailOtpForm';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import type { CatalogueProduct, Order, PharmacyProfile } from '@/lib/pharmacy-types';

const t = fr.pharmacy;
const CATEGORIES = ['all', 'medication', 'parapharmacy', 'equipment'] as const;

/** Why a product cannot go in the online cart (mirrors the API rule, which stays the authority). */
function blocked(p: CatalogueProduct): string | null {
  if (p.controlled) return t.controlled;
  if (p.prescriptionOnly) return t.prescriptionOnly;
  if (p.availability === 'OUT_OF_STOCK') return t.availability.OUT_OF_STOCK!;
  return null;
}

/** Catalogue with search, category filter and a cart (SPEC-15 §2, §4). Orders need a verified pharmacy. */
export function PharmacyCatalogue({ pharmacy }: { pharmacy: PharmacyProfile }) {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('all');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const canOrder = pharmacy.verified;

  const products = useMemo(() => {
    const term = q.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    return pharmacy.products.filter(
      (p) => (category === 'all' || p.category === category) && (!term || p.name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').includes(term)),
    );
  }, [pharmacy.products, q, category]);
  const lastUpdate = pharmacy.products.reduce((max, p) => (p.updatedAt > max ? p.updatedAt : max), '');
  const lines = Object.entries(cart)
    .map(([id, quantity]) => ({ product: pharmacy.products.find((p) => p.id === id)!, quantity }))
    .filter((l) => l.product && l.quantity > 0);
  const count = lines.reduce((s, l) => s + l.quantity, 0);
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.product.priceKmf, 0);
  const setQty = (id: string, n: number) => setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(20, n)) }));

  return (
    <section aria-labelledby="catalogue" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="catalogue" className="text-xl font-bold">
          {t.catalogueTitle}
        </h2>
        {lastUpdate ? (
          <p className="text-xs text-text-muted">
            {t.priceNote} {formatDateLong(new Date(lastUpdate))}.
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">{t.catalogueSearch}</span>
          <Search aria-hidden="true" size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.catalogueSearch} className={cn(fieldClass, 'pl-10 text-base sm:text-sm')} />
        </label>
        <div role="group" aria-label="Catégorie" className="flex gap-1.5 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={c === category}
              onClick={() => setCategory(c)}
              className={cn('h-11 shrink-0 rounded-pill border px-4 text-sm font-medium', c === category ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface text-navy hover:bg-background-soft')}
            >
              {t.categories[c]}
            </button>
          ))}
        </div>
      </div>

      {products.length === 0 ? (
        <p className="text-text">{t.catalogueEmpty}</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
          {products.map((p) => {
            const reason = blocked(p);
            const qty = cart[p.id] ?? 0;
            return (
              <li key={p.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{p.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="font-bold text-navy">{formatKmf(p.priceKmf)}</span>
                    <Badge tone={p.availability === 'OUT_OF_STOCK' ? 'warning' : p.availability === 'LOW' ? 'warning' : 'success'}>{t.availability[p.availability]}</Badge>
                    {p.controlled ? <Badge tone="warning">{t.controlled}</Badge> : p.prescriptionOnly ? <Badge tone="pharmacy">{t.prescriptionOnly}</Badge> : null}
                    {p.drug ? (
                      <a href={`/medicament/${p.drug.slug}`} className="text-xs text-primary hover:underline">
                        Comparer les prix
                      </a>
                    ) : null}
                  </div>
                  {p.prescriptionOnly && !p.controlled ? <p className="mt-1 text-xs text-text-muted">{t.prescriptionOnlyHint}</p> : null}
                </div>
                {canOrder && !reason ? (
                  qty > 0 ? (
                    <div className="flex items-center gap-1 self-start sm:self-center">
                      <button type="button" onClick={() => setQty(p.id, qty - 1)} aria-label={`Retirer un ${p.name}`} className="inline-flex size-11 items-center justify-center rounded-md border border-border text-navy hover:bg-background-soft">
                        <Minus aria-hidden="true" size={16} />
                      </button>
                      <span className="w-8 text-center font-bold" aria-live="polite">
                        {qty}
                      </span>
                      <button type="button" onClick={() => setQty(p.id, qty + 1)} aria-label={`Ajouter un ${p.name}`} className="inline-flex size-11 items-center justify-center rounded-md border border-border text-navy hover:bg-background-soft">
                        <Plus aria-hidden="true" size={16} />
                      </button>
                    </div>
                  ) : (
                    <Button variant="secondary" onClick={() => setQty(p.id, 1)} className="self-start sm:self-center" aria-label={`${t.add} ${p.name}`}>
                      <Plus aria-hidden="true" size={16} /> {t.add}
                    </Button>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {!canOrder ? <p className="text-sm text-text-muted">{t.notVerified}.</p> : null}

      {count > 0 ? (
        <div className="sticky bottom-3 z-20 flex justify-center">
          <Button size="lg" onClick={() => setOpen(true)} className="shadow-float">
            <ShoppingBag aria-hidden="true" size={18} /> {t.cart} · {count} · {formatKmf(subtotal)}
          </Button>
        </div>
      ) : null}
      {open ? <Checkout pharmacy={pharmacy} lines={lines} subtotal={subtotal} onClose={() => setOpen(false)} onQty={setQty} /> : null}
    </section>
  );
}

function Checkout({
  pharmacy,
  lines,
  subtotal,
  onClose,
  onQty,
}: {
  pharmacy: PharmacyProfile;
  lines: { product: CatalogueProduct; quantity: number }[];
  subtotal: number;
  onClose: () => void;
  onQty: (id: string, n: number) => void;
}) {
  const router = useRouter();
  const canDeliver = pharmacy.delivers && pharmacy.deliveryZones.length > 0;
  const [mode, setMode] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [address, setAddress] = useState({ line: '', localityId: pharmacy.deliveryZones[0]?.localityId ?? '', instructions: '', phone: '' });
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fee = mode === 'DELIVERY' ? (pharmacy.deliveryZones.find((z) => z.localityId === address.localityId)?.feeKmf ?? 0) : 0;

  async function submit() {
    setError(null);
    if (mode === 'DELIVERY' && (address.line.trim().length < 3 || address.phone.trim().length < 6)) return setError('Indiquez l’adresse et le téléphone du destinataire.');
    setBusy(true);
    try {
      const order = await api<Order>('/v1/me/orders', {
        method: 'POST',
        body: {
          pharmacyId: pharmacy.id,
          mode,
          lines: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
          ...(mode === 'DELIVERY' ? { address: { ...address, instructions: address.instructions.trim() || undefined } } : {}),
        },
      });
      router.push(`/mon-compte/commandes/${order.id}?nouvelle=1`);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403) && err.code !== 'PHARMACY_NOT_VERIFIED') setNeedsLogin(true);
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer title={t.cart} onClose={onClose}>
      {needsLogin ? (
        <EmailOtpForm title="Identifiez-vous pour commander" onDone={() => { setNeedsLogin(false); void submit(); }} />
      ) : (
        <div className="flex flex-col gap-5">
          <ul className="flex flex-col gap-3">
            {lines.map((l) => (
              <li key={l.product.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{l.product.name}</p>
                  <p className="text-text-muted">
                    {l.quantity} × {formatKmf(l.product.priceKmf)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => onQty(l.product.id, l.quantity - 1)} aria-label={`Retirer un ${l.product.name}`} className="inline-flex size-11 items-center justify-center rounded-md border border-border">
                    <Minus aria-hidden="true" size={14} />
                  </button>
                  <button type="button" onClick={() => onQty(l.product.id, l.quantity + 1)} aria-label={`Ajouter un ${l.product.name}`} className="inline-flex size-11 items-center justify-center rounded-md border border-border">
                    <Plus aria-hidden="true" size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-bold text-ink">Mode de remise</legend>
            {(['PICKUP', 'DELIVERY'] as const).map((m) => (
              <label key={m} className={cn('flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3 text-sm', mode === m ? 'border-primary bg-primary-soft' : 'border-border', m === 'DELIVERY' && !canDeliver && 'cursor-not-allowed opacity-50')}>
                <input type="radio" name="mode" value={m} checked={mode === m} disabled={m === 'DELIVERY' && !canDeliver} onChange={() => setMode(m)} className="mt-1 size-4 accent-primary" />
                <span>
                  <span className="block font-medium text-ink">{m === 'PICKUP' ? t.pickup : t.delivery}</span>
                  <span className="text-text-muted">{m === 'PICKUP' ? t.pickupHint : canDeliver ? t.deliveryHint : 'Cette pharmacie ne livre pas.'}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {mode === 'DELIVERY' ? (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                {t.addressLocality}
                <select value={address.localityId} onChange={(e) => setAddress({ ...address, localityId: e.target.value })} className={cn(fieldClass, 'text-base sm:text-sm')}>
                  {pharmacy.deliveryZones.map((z) => (
                    <option key={z.localityId} value={z.localityId}>
                      {z.locality} · {formatKmf(z.feeKmf)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                {t.addressLine}
                <input value={address.line} onChange={(e) => setAddress({ ...address, line: e.target.value })} autoComplete="street-address" className={cn(fieldClass, 'text-base sm:text-sm')} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                {t.addressInstructions}
                <input value={address.instructions} onChange={(e) => setAddress({ ...address, instructions: e.target.value })} className={cn(fieldClass, 'text-base sm:text-sm')} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                {t.addressPhone}
                <input value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} inputMode="tel" autoComplete="tel" placeholder="333 12 34" className={cn(fieldClass, 'text-base sm:text-sm')} />
                <span className="text-xs font-normal text-text-muted">{t.addressPhoneHint}</span>
              </label>
            </div>
          ) : null}

          <dl className="grid grid-cols-[1fr_auto] gap-1 border-t border-border pt-3 text-sm">
            <dt className="text-text">{t.subtotal}</dt>
            <dd className="text-right">{formatKmf(subtotal)}</dd>
            {mode === 'DELIVERY' ? (
              <>
                <dt className="text-text">{t.deliveryFee}</dt>
                <dd className="text-right">{formatKmf(fee)}</dd>
              </>
            ) : null}
            <dt className="font-bold text-ink">{t.total}</dt>
            <dd className="text-right font-bold text-ink">{formatKmf(subtotal + fee)}</dd>
          </dl>
          <p className="text-xs text-text-muted">{t.noSale}</p>
          {error ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button size="lg" fullWidth onClick={submit} disabled={busy || lines.length === 0}>
            {busy ? 'Envoi…' : t.confirmOrder}
          </Button>
        </div>
      )}
    </Drawer>
  );
}
