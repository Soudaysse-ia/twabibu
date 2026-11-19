'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Card, cn } from '@twabibu/ui';
import { api, errorMessage } from '@/lib/api';
import { dateTime, fieldClass, ORG_STATUS, ORG_TYPE, VERIFICATION } from '@/lib/ui';
import { Empty, Loading, Notice, PageTitle } from './Page';
import { useApi } from './useApi';

interface Row { id: string; name: string; type: string; status: string; locality: string | null; practitioners: number; members: number; pharmacyVerified: boolean | null }
interface Detail {
  id: string; name: string; slug: string; type: string; status: string; phone: string | null; email: string | null; createdAt: string;
  pharmacy: { verifiedAt: string | null; licenseNumber: string | null; pharmacistName: string | null } | null;
  practices: { id: string; name: string; address: string }[];
  practitioners: { id: string; name: string; speciality: string; status: string; isPublished: boolean }[];
  members: { email: string | null; role: string; status: string; lastLoginAt: string | null }[];
  history: { action: string; at: string; by: string; changes: { reason?: string; message?: string } | null }[];
}

const ROLE: Record<string, string> = { OWNER: 'Responsable', ADMIN: 'Administrateur', PRACTITIONER: 'Praticien', SECRETARY: 'Secrétariat', PHARMACIST: 'Pharmacien', PHARMACY_STAFF: 'Préparateur' };

export function StructureList() {
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const { data, error } = useApi<Row[]>(`/v1/admin/structures?q=${encodeURIComponent(q)}${type ? `&type=${type}` : ''}`);
  return (
    <>
      <PageTitle title="Structures" />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input aria-label="Rechercher une structure" placeholder="Nom de la structure" value={q} onChange={(e) => setQ(e.target.value)} className={cn(fieldClass, 'sm:max-w-sm')} />
        <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)} className={cn(fieldClass, 'sm:max-w-xs')}>
          <option value="">Tous les types</option>
          {Object.entries(ORG_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {!data ? <Loading error={error} /> : data.length === 0 ? <Empty>Aucune structure.</Empty> : (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {data.map((o) => (
            <li key={o.id}>
              <Link href={`/structures/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-background-soft">
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{o.name}</span>
                  <span className="block text-sm text-text-muted">{ORG_TYPE[o.type]} · {o.locality ?? 'sans adresse'} · {o.type === 'PHARMACY' ? (o.pharmacyVerified ? 'pharmacie vérifiée' : 'pharmacie non vérifiée') : `${o.practitioners} soignant${o.practitioners > 1 ? 's' : ''}`}</span>
                </span>
                <Badge tone={o.status === 'SUSPENDED' ? 'warning' : o.status === 'ACTIVE' ? 'success' : 'info'}>{ORG_STATUS[o.status]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function StructureDetail({ id }: { id: string }) {
  const { data: o, error, setData } = useApi<Detail>(`/v1/admin/structures/${id}`);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  if (!o) return <Loading error={error} />;
  const suspended = o.status === 'SUSPENDED';

  async function toggle() {
    setNotice(null);
    try {
      setData(await api<Detail>(`/v1/admin/structures/${id}/status`, { method: 'POST', body: { suspend: !suspended, reason: reason.trim() } }));
      setNotice({ ok: true, text: suspended ? 'Structure réactivée.' : 'Structure suspendue : profils dépubliés et espace professionnel fermé.' });
      setReason('');
      setConfirm(false);
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
    }
  }

  return (
    <>
      <Link href="/structures" className="text-sm font-medium text-primary hover:underline">← Structures</Link>
      <PageTitle title={o.name}>
        <Badge tone={suspended ? 'warning' : 'success'}>{ORG_STATUS[o.status]}</Badge>
      </PageTitle>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="text-text-muted">Type</span><br />{ORG_TYPE[o.type]}</p>
            <p><span className="text-text-muted">Créée le</span><br />{dateTime(o.createdAt)}</p>
            <p><span className="text-text-muted">Téléphone</span><br />{o.phone ?? '—'}</p>
            <p><span className="text-text-muted">E-mail</span><br />{o.email ?? '—'}</p>
            {o.pharmacy ? <p className="sm:col-span-2"><span className="text-text-muted">Pharmacie</span><br />{o.pharmacy.verifiedAt ? `vérifiée le ${dateTime(o.pharmacy.verifiedAt)}` : 'non vérifiée'} · licence {o.pharmacy.licenseNumber ?? '—'}</p> : null}
            <p className="sm:col-span-2"><span className="text-text-muted">Lieux</span><br />{o.practices.map((p) => `${p.name} (${p.address})`).join(' · ') || '—'}</p>
          </Card>
          {o.practitioners.length ? (
            <Card className="flex flex-col gap-2">
              <h2 className="font-heading text-sm font-bold text-navy">Soignants</h2>
              <ul className="flex flex-col gap-1 text-sm">
                {o.practitioners.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/verifications/${p.id}`} className="text-primary hover:underline">{p.name}</Link>
                    <span className="text-text-muted">{p.speciality} · {VERIFICATION[p.status]} · {p.isPublished ? 'publié' : 'non publié'}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          <Card className="flex flex-col gap-2">
            <h2 className="font-heading text-sm font-bold text-navy">Équipe</h2>
            <ul className="flex flex-col gap-1 text-sm">
              {o.members.map((m, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2"><span className="text-ink">{m.email ?? '—'}</span><span className="text-text-muted">{ROLE[m.role] ?? m.role} · dernière connexion {dateTime(m.lastLoginAt)}</span></li>
              ))}
            </ul>
          </Card>
          <Card className="flex flex-col gap-2">
            <h2 className="font-heading text-sm font-bold text-navy">Historique</h2>
            {o.history.length === 0 ? <p className="text-sm text-text">Aucune action.</p> : null}
            <ul className="flex flex-col gap-1 text-sm">
              {o.history.map((h) => <li key={h.at + h.action}>{h.action} · {dateTime(h.at)} · {h.by}{h.changes?.reason ? ` · « ${h.changes.reason} »` : ''}</li>)}
            </ul>
          </Card>
        </div>
        <Card className="flex flex-col gap-3 self-start">
          <h2 className="font-heading text-sm font-bold text-navy">{suspended ? 'Réactiver' : 'Suspendre'}</h2>
          <p className="text-sm text-text">{suspended ? 'Les soignants vérifiés qui étaient en ligne seront republiés.' : 'Les profils sont retirés immédiatement de la recherche et l’équipe ne peut plus se connecter à son espace.'}</p>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Motif (envoyé au responsable)
            <textarea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-md border border-border p-3 text-base font-normal sm:text-sm" />
          </label>
          {confirm ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={toggle} disabled={reason.trim().length < 5}>{suspended ? 'Confirmer la réactivation' : 'Confirmer la suspension'}</Button>
              <Button variant="ghost" onClick={() => setConfirm(false)}>Annuler</Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setConfirm(true)} disabled={reason.trim().length < 5}>{suspended ? 'Réactiver la structure' : 'Suspendre la structure'}</Button>
          )}
          <Notice message={notice} />
        </Card>
      </div>
    </>
  );
}
