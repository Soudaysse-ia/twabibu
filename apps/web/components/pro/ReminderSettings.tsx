'use client';

import { useEffect, useState } from 'react';
import { Button, Card, cn } from '@twabibu/ui';
import { api, errorMessage } from '@/lib/api-client';
import { fieldClass } from './Drawer';
import { useMembership } from './ProContext';

interface Settings {
  reminderOffsetsHours: number[];
  reminderHour: number;
  askConfirmation: boolean;
  canEdit: boolean;
}

const OFFSETS = [
  [24, 'La veille'],
  [48, 'Deux jours avant'],
  [72, 'Trois jours avant'],
] as const;
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00 → 20:00, inside the send window

/** Practice-wide reminder settings (SPEC-08): when, at what time, and whether to ask for a confirmation. */
export function ReminderSettings() {
  const m = useMembership();
  const url = `/v1/pro/orgs/${m.organizationId}/notification-settings`;
  const [s, setS] = useState<Settings | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Settings>(url).then(setS).catch((e) => setMessage({ ok: false, text: errorMessage(e) }));
  }, [url]);
  if (!s) return message ? <p className="text-sm text-danger">{message.text}</p> : null;
  const ro = !s.canEdit;
  const toggleOffset = (o: number) => setS({ ...s, reminderOffsetsHours: s.reminderOffsetsHours.includes(o) ? s.reminderOffsetsHours.filter((x) => x !== o) : [...s.reminderOffsetsHours, o] });

  async function save() {
    if (!s) return;
    setBusy(true);
    setMessage(null);
    try {
      setS(await api<Settings>(url, { method: 'PUT', body: { reminderOffsetsHours: s.reminderOffsetsHours, reminderHour: s.reminderHour, askConfirmation: s.askConfirmation } }));
      setMessage({ ok: true, text: 'Rappels enregistrés. Ils s’appliquent aux prochains envois.' });
    } catch (e) {
      setMessage({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-bold">Rappels aux patients</h2>
        <p className="text-sm text-text-muted">
          Pour toute la structure. Envoyés par e-mail (SMS pour un patient sans adresse e-mail), jamais la nuit, sans le motif du rendez-vous. Un rendez-vous pris après l’heure du rappel ne reçoit que sa confirmation.
        </p>
      </div>
      <fieldset disabled={ro} className="flex flex-col gap-4">
        <div role="group" aria-labelledby="rappels-quand" className="flex flex-col gap-2">
          <p id="rappels-quand" className="text-sm font-medium text-ink">Quand</p>
          <div className="flex flex-wrap gap-2">
            {OFFSETS.map(([o, label]) => (
              <label key={o} className={cn('flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm', s.reminderOffsetsHours.includes(o) ? 'border-primary bg-primary-soft' : 'border-border')}>
                <input type="checkbox" checked={s.reminderOffsetsHours.includes(o)} onChange={() => toggleOffset(o)} className="size-4 accent-primary" />
                {label}
              </label>
            ))}
          </div>
          {s.reminderOffsetsHours.length === 0 ? <p className="text-xs text-warning">Aucun rappel ne sera envoyé.</p> : null}
        </div>
        <label className="flex max-w-xs flex-col gap-1 text-sm font-medium text-ink">
          À quelle heure (heure des Comores)
          <select value={s.reminderHour} onChange={(e) => setS({ ...s, reminderHour: Number(e.target.value) })} className={cn(fieldClass, 'text-base sm:text-sm')}>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink">
          <input type="checkbox" checked={s.askConfirmation} onChange={(e) => setS({ ...s, askConfirmation: e.target.checked })} className="mt-0.5 size-4 accent-primary" />
          <span>
            Demander au patient de confirmer sa présence
            <span className="block text-xs text-text-muted">Le rappel contient un bouton « Je confirme ma présence » ; la confirmation s’affiche dans l’agenda.</span>
          </span>
        </label>
      </fieldset>
      {ro ? <p className="text-xs text-text-muted">Seuls le responsable et les administrateurs de la structure modifient les rappels.</p> : null}
      <p aria-live="polite" className={cn('text-sm', message?.ok ? 'text-success' : 'text-danger')}>
        {message?.text}
      </p>
      {!ro ? (
        <Button onClick={save} disabled={busy} className="self-start">
          {busy ? 'Enregistrement…' : 'Enregistrer les rappels'}
        </Button>
      ) : null}
    </Card>
  );
}
