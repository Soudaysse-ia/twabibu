'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FileText } from 'lucide-react';
import { Badge, Button, Card } from '@twabibu/ui';
import { api, errorMessage } from '@/lib/api';
import { dateTime, VERIFICATION } from '@/lib/ui';
import { Empty, Loading, Notice, PageTitle } from './Page';
import { useApi } from './useApi';

interface Item { id: string; name: string; speciality: string; organization: string; status: string; documents: number; waitingSince: string }
interface FileView {
  id: string; name: string; speciality: string; licenseNumber: string | null; canPrescribe: boolean; status: string; verifiedAt: string | null; isPublished: boolean; slug: string; email: string | null;
  organization: { id: string; name: string; status: string }; practices: string[];
  documents: { id: string; type: string; status: string; reviewNote: string | null; createdAt: string }[];
  checklist: string[];
  history: { action: string; at: string; by: string; changes: { message?: string | null } | null }[];
}

const DOC: Record<string, string> = { DIPLOMA: 'Diplôme', LICENSE: 'Autorisation d’exercer', ID_CARD: 'Pièce d’identité', OPENING_AUTHORIZATION: 'Autorisation d’ouverture', OTHER: 'Autre pièce' };
const CHECK: Record<string, string> = { documentsReadable: 'Pièces lisibles et complètes', nameMatches: 'Nom identique sur les pièces et le profil', licenseValid: 'Autorisation d’exercer valide (Ordre / ministère)', confirmationCall: 'Appel de confirmation fait' };
const ACTION: Record<string, string> = { 'practitioner.verified': 'Validé', 'practitioner.changes_requested': 'Compléments demandés', 'practitioner.rejected': 'Refusé' };

export function VerificationQueue() {
  const { data, error } = useApi<Item[]>('/v1/admin/verifications');
  if (!data) return <Loading error={error} />;
  return (
    <>
      <PageTitle title="File de vérification" />
      <p className="mb-4 text-sm text-text-muted">Les dossiers les plus anciens d’abord. Un profil n’est visible des patients qu’après validation.</p>
      {data.length === 0 ? (
        <Empty>Aucun dossier en attente.</Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((p) => (
            <li key={p.id}>
              <Link href={`/verifications/${p.id}`} className="block rounded-md focus-visible:outline-2 focus-visible:outline-primary">
                <Card className="flex flex-wrap items-center justify-between gap-3 hover:border-primary">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">{p.name}</p>
                    <p className="text-sm text-text">{p.speciality} · {p.organization}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone={p.status === 'PENDING' ? 'warning' : 'info'}>{VERIFICATION[p.status]}</Badge>
                    <span className="text-text-muted">{p.documents} pièce{p.documents > 1 ? 's' : ''} · depuis le {dateTime(p.waitingSince)}</span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function VerificationFile({ id }: { id: string }) {
  const { data: f, error, setData } = useApi<FileView>(`/v1/admin/practitioners/${id}`);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!f) return <Loading error={error} />;
  const allChecked = f.checklist.every((k) => checks[k]);

  async function decide(decision: 'VERIFIED' | 'CHANGES_REQUESTED' | 'REJECTED') {
    setNotice(null);
    if (decision !== 'VERIFIED' && message.trim().length < 5) return setNotice({ ok: false, text: 'Écrivez le message qui sera envoyé au soignant.' });
    setBusy(true);
    try {
      setData(await api<FileView>(`/v1/admin/practitioners/${id}/decision`, { method: 'POST', body: { decision, message: message.trim() || undefined, checklist: checks } }));
      setMessage('');
      setNotice({ ok: true, text: decision === 'VERIFIED' ? 'Profil validé et publié. Le soignant est prévenu par e-mail.' : 'Décision enregistrée. Le soignant est prévenu par e-mail.' });
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  const open = f.status === 'PENDING' || f.status === 'CHANGES_REQUESTED';
  return (
    <>
      <Link href="/verifications" className="text-sm font-medium text-primary hover:underline">
        ← File de vérification
      </Link>
      <PageTitle title={f.name}>
        <Badge tone={f.status === 'VERIFIED' ? 'success' : f.status === 'REJECTED' ? 'warning' : 'info'}>{VERIFICATION[f.status]}</Badge>
      </PageTitle>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="text-text-muted">Spécialité</span><br />{f.speciality}</p>
            <p><span className="text-text-muted">N° d’autorisation d’exercer</span><br />{f.licenseNumber ?? '—'}</p>
            <p><span className="text-text-muted">Structure</span><br /><Link href={`/structures/${f.organization.id}`} className="text-primary hover:underline">{f.organization.name}</Link></p>
            <p><span className="text-text-muted">E-mail du compte</span><br />{f.email ?? '—'}</p>
            <p className="sm:col-span-2"><span className="text-text-muted">Lieux</span><br />{f.practices.join(' · ') || '—'}</p>
          </Card>
          <Card className="flex flex-col gap-2">
            <h2 className="font-heading text-sm font-bold text-navy">Pièces justificatives</h2>
            {f.documents.length === 0 ? <p className="text-sm text-text">Aucune pièce déposée.</p> : null}
            <ul className="flex flex-col gap-2">
              {f.documents.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 text-ink"><FileText aria-hidden="true" size={16} /> {DOC[d.type] ?? d.type}</span>
                  <span className="flex items-center gap-2"><Badge tone="info">{VERIFICATION[d.status]}</Badge><span className="text-xs text-text-muted">{dateTime(d.createdAt)}</span></span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-text-muted">Les fichiers sont stockés chiffrés ; la visionneuse s’ouvre en production (stockage objet non configuré sur ce poste).</p>
          </Card>
          <Card className="flex flex-col gap-2">
            <h2 className="font-heading text-sm font-bold text-navy">Historique</h2>
            {f.history.length === 0 ? <p className="text-sm text-text">Aucune décision pour l’instant.</p> : null}
            <ul className="flex flex-col gap-2 text-sm">
              {f.history.map((h) => (
                <li key={h.at + h.action}>
                  <span className="font-medium text-ink">{ACTION[h.action] ?? h.action}</span> · {dateTime(h.at)} · {h.by}
                  {h.changes?.message ? <span className="block text-text-muted">« {h.changes.message} »</span> : null}
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <Card className="flex flex-col gap-3 self-start">
          <h2 className="font-heading text-sm font-bold text-navy">Décision</h2>
          {open ? (
            <>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium text-ink">Contrôles avant validation</legend>
                {f.checklist.map((k) => (
                  <label key={k} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 text-sm">
                    <input type="checkbox" checked={!!checks[k]} onChange={(e) => setChecks({ ...checks, [k]: e.target.checked })} className="size-4 accent-primary" />
                    {CHECK[k] ?? k}
                  </label>
                ))}
              </fieldset>
              <Button onClick={() => decide('VERIFIED')} disabled={busy || !allChecked}>Valider et publier</Button>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                Message au soignant (compléments ou refus)
                <textarea rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} className="rounded-md border border-border p-3 text-base font-normal focus:border-primary focus:outline-2 focus:outline-primary/30 sm:text-sm" />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => decide('CHANGES_REQUESTED')} disabled={busy}>Demander des compléments</Button>
                <Button variant="ghost" onClick={() => decide('REJECTED')} disabled={busy}>Refuser</Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-text">
              {f.status === 'VERIFIED' ? `Profil vérifié ${f.isPublished ? 'et publié' : 'mais dépublié (structure suspendue)'}.` : 'Dossier clos.'}
            </p>
          )}
          <Notice message={notice} />
        </Card>
      </div>
    </>
  );
}
