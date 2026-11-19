'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Card, cn } from '@twabibu/ui';
import { api, errorMessage } from '@/lib/api';
import { dateOnly, dateTime, fieldClass } from '@/lib/ui';
import { Empty, Loading, Notice, PageTitle } from './Page';
import { useApi } from './useApi';

interface PatientRow { id: string; name: string; email: string | null; status: string; createdAt: string }
interface PatientDetail {
  id: string; name: string; birthDate: string; email: string | null; status: string; createdAt: string; lastLoginAt: string | null; activeSessions: number;
  relatives: { name: string; relationship: string }[];
  appointments: { id: string; startsAt: string; status: string; source: string; practitioner: string }[];
  notifications: { id: string; channel: string; template: string; status: string; error: string | null; createdAt: string }[];
  orders: { id: string; reference: string; pharmacy: string; status: string; createdAt: string }[];
}
interface NotificationRow { id: string; channel: string; recipient: string | null; template: string; status: string; provider: string | null; error: string | null; createdAt: string; resendable: boolean }

const APPT: Record<string, string> = { PENDING_VALIDATION: 'À valider', CONFIRMED: 'Confirmé', ARRIVED: 'Arrivé', IN_CONSULTATION: 'En consultation', DONE: 'Terminé', NO_SHOW: 'Absent', CANCELLED_BY_PATIENT: 'Annulé (patient)', CANCELLED_BY_PRACTICE: 'Annulé (cabinet)' };
const NSTATUS: Record<string, string> = { QUEUED: 'En file', SENT: 'Envoyé', DELIVERED: 'Distribué', FAILED: 'Échec' };

export function PatientSearch() {
  const [q, setQ] = useState('');
  const { data, error } = useApi<PatientRow[]>(q.trim().length >= 2 ? `/v1/admin/patients?q=${encodeURIComponent(q.trim())}` : null);
  return (
    <>
      <PageTitle title="Patients" />
      <p className="mb-3 text-sm text-text-muted">Support uniquement : rendez-vous, envois et commandes. Aucun dossier médical ni motif de consultation n’est accessible ici. Chaque fiche ouverte est journalisée.</p>
      <input aria-label="Rechercher un patient" placeholder="E-mail ou nom (2 caractères minimum)" value={q} onChange={(e) => setQ(e.target.value)} className={cn(fieldClass, 'mb-4 max-w-md')} />
      {q.trim().length < 2 ? null : !data ? <Loading error={error} /> : data.length === 0 ? <Empty>Aucun patient trouvé.</Empty> : (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {data.map((p) => (
            <li key={p.id}>
              <Link href={`/patients/${p.id}`} className="flex flex-wrap justify-between gap-2 px-4 py-3 hover:bg-background-soft">
                <span className="font-medium text-ink">{p.name}</span>
                <span className="text-sm text-text-muted">{p.email} · inscrit le {dateOnly(p.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function PatientSupport({ id }: { id: string }) {
  const { data: p, error, reload } = useApi<PatientDetail>(`/v1/admin/patients/${id}`);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  if (!p) return <Loading error={error} />;
  async function revoke() {
    try {
      const r = await api<{ revoked: number }>(`/v1/admin/patients/${id}/revoke-sessions`, { method: 'POST' });
      setNotice({ ok: true, text: `${r.revoked} session${r.revoked > 1 ? 's' : ''} fermée${r.revoked > 1 ? 's' : ''}. Le patient devra se reconnecter.` });
      setConfirm(false);
      reload();
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
    }
  }
  return (
    <>
      <Link href="/patients" className="text-sm font-medium text-primary hover:underline">← Patients</Link>
      <PageTitle title={p.name}><Badge tone={p.status === 'ACTIVE' ? 'success' : 'warning'}>{p.status === 'ACTIVE' ? 'Compte actif' : p.status}</Badge></PageTitle>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="flex flex-col gap-2 text-sm">
          <p><span className="text-text-muted">E-mail :</span> {p.email ?? '—'}</p>
          <p><span className="text-text-muted">Né(e) le :</span> {dateOnly(p.birthDate)}</p>
          <p><span className="text-text-muted">Inscrit le :</span> {dateTime(p.createdAt)} · <span className="text-text-muted">dernière connexion :</span> {dateTime(p.lastLoginAt)}</p>
          <p><span className="text-text-muted">Proches :</span> {p.relatives.map((r) => r.name).join(', ') || 'aucun'}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span>{p.activeSessions} session{p.activeSessions > 1 ? 's' : ''} ouverte{p.activeSessions > 1 ? 's' : ''}</span>
            {confirm ? (
              <>
                <Button size="sm" onClick={revoke}>Confirmer</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Annuler</Button>
              </>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setConfirm(true)} disabled={!p.activeSessions}>Déconnecter partout</Button>
            )}
          </div>
          <Notice message={notice} />
        </Card>
        <Card className="flex flex-col gap-2">
          <h2 className="font-heading text-sm font-bold text-navy">Rendez-vous</h2>
          {p.appointments.length === 0 ? <p className="text-sm text-text">Aucun rendez-vous.</p> : (
            <ul className="flex flex-col gap-1 text-sm">{p.appointments.map((a) => <li key={a.id}>{dateTime(a.startsAt)} · {a.practitioner} · {APPT[a.status] ?? a.status}</li>)}</ul>
          )}
        </Card>
        <Card className="flex flex-col gap-2">
          <h2 className="font-heading text-sm font-bold text-navy">Messages envoyés</h2>
          {p.notifications.length === 0 ? <p className="text-sm text-text">Aucun message.</p> : (
            <ul className="flex flex-col gap-1 text-sm">{p.notifications.map((n) => <li key={n.id}>{dateTime(n.createdAt)} · {n.channel === 'EMAIL' ? 'E-mail' : n.channel} · {n.template} · {NSTATUS[n.status]}{n.error ? ` (${n.error})` : ''}</li>)}</ul>
          )}
        </Card>
        <Card className="flex flex-col gap-2">
          <h2 className="font-heading text-sm font-bold text-navy">Commandes en pharmacie</h2>
          {p.orders.length === 0 ? <p className="text-sm text-text">Aucune commande.</p> : (
            <ul className="flex flex-col gap-1 text-sm">{p.orders.map((o) => <li key={o.id}>{dateTime(o.createdAt)} · n° {o.reference} · {o.pharmacy} · {o.status}</li>)}</ul>
          )}
        </Card>
      </div>
    </>
  );
}

export function NotificationLog() {
  const [f, setF] = useState({ status: '', channel: '', q: '' });
  const query = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const { data, error, reload } = useApi<NotificationRow[]>(`/v1/admin/notifications${query ? `?${query}` : ''}`);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  async function resend(n: NotificationRow) {
    try {
      await api(`/v1/admin/notifications/${n.id}/resend`, { method: 'POST' });
      setNotice({ ok: true, text: 'Message remis en file d’envoi.' });
      reload();
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
    }
  }
  return (
    <>
      <PageTitle title="Notifications" />
      <p className="mb-3 text-sm text-text-muted">Le contenu des messages n’est jamais affiché (il peut contenir un code de connexion).</p>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <select aria-label="Statut" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={cn(fieldClass, 'sm:w-44')}>
          <option value="">Tous les statuts</option>
          {Object.entries(NSTATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="Canal" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })} className={cn(fieldClass, 'sm:w-44')}>
          <option value="">Tous les canaux</option>
          <option value="EMAIL">E-mail</option>
          <option value="SMS">SMS</option>
        </select>
        <input aria-label="Destinataire" placeholder="Destinataire" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} className={cn(fieldClass, 'sm:max-w-xs')} />
      </div>
      <Notice message={notice} />
      {!data ? <Loading error={error} /> : data.length === 0 ? <Empty>Aucun message.</Empty> : (
        <ul className="mt-3 divide-y divide-border rounded-md border border-border bg-surface">
          {data.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block text-ink">{n.recipient} · {n.template}</span>
                <span className="block text-xs text-text-muted">{dateTime(n.createdAt)} · {n.channel === 'EMAIL' ? 'E-mail' : n.channel} · {n.provider ?? '—'}{n.error ? ` · ${n.error}` : ''}</span>
              </span>
              <span className="flex items-center gap-2">
                <Badge tone={n.status === 'FAILED' ? 'warning' : n.status === 'QUEUED' ? 'info' : 'success'}>{NSTATUS[n.status]}</Badge>
                {n.resendable ? <Button size="sm" variant="secondary" onClick={() => resend(n)}>Renvoyer</Button> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
