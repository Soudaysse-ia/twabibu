'use client';

import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { MailPlus, Trash2, UserCog } from 'lucide-react';
import { InviteMemberSchema } from '@twabibu/contracts';
import { fr } from '@twabibu/i18n';
import { Badge, Button, Card, cn } from '@twabibu/ui';
import { formatDateLong } from '@twabibu/utils';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { fieldClass } from './Drawer';
import { useMembership } from './ProContext';

const t = fr.team;

interface Member {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  agendaIds: string[] | null;
  manageSettings: boolean | null;
  lastLoginAt: string | null;
  removable: boolean;
}
interface Invitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  state: 'PENDING' | 'EXPIRED';
}
interface Team {
  you: string;
  yourRole: string;
  agendas: { id: string; name: string }[];
  members: Member[];
  invitations: Invitation[];
}

/** Allowed agendas (none ticked = all) and the settings right, shared by the invite form and the rights editor. */
function SecretaryRights({
  agendas,
  agendaIds,
  manageSettings,
  onChange,
}: {
  agendas: Team['agendas'];
  agendaIds: string[];
  manageSettings: boolean;
  onChange: (v: { agendaIds: string[]; manageSettings: boolean }) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">{t.agendas}</legend>
        <p className="text-xs text-text-muted">{t.agendasHint}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {agendas.map((a) => (
            <label
              key={a.id}
              className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm text-ink has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
            >
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={agendaIds.includes(a.id)}
                onChange={(e) =>
                  onChange({
                    manageSettings,
                    agendaIds: e.target.checked ? [...agendaIds, a.id] : agendaIds.filter((x) => x !== a.id),
                  })
                }
              />
              {a.name}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={manageSettings}
          onChange={(e) => onChange({ agendaIds, manageSettings: e.target.checked })}
        />
        {t.manageSettings}
      </label>
    </div>
  );
}

/** Team settings (SPEC-07 §Équipe, PRO-05): members, pending invitations, invite, rights, removal. */
export function TeamSettings() {
  const m = useMembership();
  const base = `/v1/pro/orgs/${m.organizationId}`;
  const uid = useId();
  const [team, setTeam] = useState<Team | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState({
    email: '',
    role: 'SECRETARY' as 'SECRETARY' | 'ADMIN',
    agendaIds: [] as string[],
    manageSettings: false,
  });
  const [emailError, setEmailError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; agendaIds: string[]; manageSettings: boolean } | null>(
    null,
  );
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTeam(await api<Team>(`${base}/members`));
    } catch (err) {
      setStatus({ ok: false, text: errorMessage(err) });
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setStatus(null);
    try {
      await fn();
      setStatus({ ok: true, text: ok });
      await load();
      return true;
    } catch (err) {
      setStatus({
        ok: false,
        text: err instanceof ApiError && err.code === 'CONFLICT' ? t.errors.conflict! : errorMessage(err),
      });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function sendInvite(e: FormEvent) {
    e.preventDefault();
    const body = invite.role === 'SECRETARY' ? invite : { email: invite.email, role: invite.role };
    if (!InviteMemberSchema.safeParse(body).success) {
      setEmailError(t.errors.email!);
      return;
    }
    setEmailError(null);
    const email = invite.email.trim().toLowerCase();
    const ok = await run(() => api(`${base}/members/invite`, { method: 'POST', body }), t.sent(email));
    if (ok) setInvite({ email: '', role: 'SECRETARY', agendaIds: [], manageSettings: false });
  }

  if (!team) {
    return status ? (
      <p role="alert" className="text-sm text-danger">
        {status.text}
      </p>
    ) : null;
  }

  const agendaName = (id: string) => team.agendas.find((a) => a.id === id)?.name;
  const who = (x: Member) => x.name ?? x.email ?? '';

  return (
    <div className="flex flex-col gap-6">
      <p aria-live="polite" className={cn('min-h-5 text-sm', status?.ok ? 'text-success' : 'text-danger')}>
        {status?.text}
      </p>

      <Card className="flex flex-col gap-4">
        <h2 className="text-base font-bold">{t.members}</h2>
        <ul className="flex flex-col divide-y divide-border">
          {team.members.map((x) => (
            <li key={x.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium break-words text-ink">
                    {who(x)}{' '}
                    {x.id === team.you ? (
                      <span className="text-sm font-normal text-text-muted">({t.you})</span>
                    ) : null}
                  </p>
                  {x.name && x.email ? <p className="text-sm break-all text-text-muted">{x.email}</p> : null}
                  <p className="text-xs text-text-muted">
                    {x.lastLoginAt ? t.lastLogin(formatDateLong(new Date(x.lastLoginAt))) : t.neverLoggedIn}
                  </p>
                  {x.role === 'SECRETARY' ? (
                    <p className="text-xs text-text-muted">
                      {x.agendaIds?.length
                        ? x.agendaIds.map(agendaName).filter(Boolean).join(', ')
                        : t.allAgendas}
                      {x.manageSettings ? ` · ${t.settingsRight}` : ''}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Badge>{t.roles[x.role] ?? x.role}</Badge>
                  {x.role === 'SECRETARY' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      iconLeft={<UserCog aria-hidden="true" size={16} />}
                      onClick={() =>
                        setEditing({
                          id: x.id,
                          agendaIds: x.agendaIds ?? [],
                          manageSettings: !!x.manageSettings,
                        })
                      }
                    >
                      {t.editRights}
                    </Button>
                  ) : null}
                  {x.removable ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      iconLeft={<Trash2 aria-hidden="true" size={16} />}
                      onClick={() => setRemoving(x.id)}
                    >
                      {t.remove}
                    </Button>
                  ) : null}
                </div>
              </div>

              {editing?.id === x.id ? (
                <div className="flex flex-col gap-3 rounded-md border border-primary/40 bg-background-soft p-4">
                  <SecretaryRights
                    agendas={team.agendas}
                    agendaIds={editing.agendaIds}
                    manageSettings={editing.manageSettings}
                    onChange={(v) => setEditing({ ...editing, ...v })}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={async () =>
                        (await run(
                          () =>
                            api(`${base}/members/${x.id}`, {
                              method: 'PATCH',
                              body: { agendaIds: editing.agendaIds, manageSettings: editing.manageSettings },
                            }),
                          t.saved,
                        )) && setEditing(null)
                      }
                    >
                      {t.save}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>
                      {t.cancel}
                    </Button>
                  </div>
                </div>
              ) : null}

              {removing === x.id ? (
                <div
                  role="alertdialog"
                  aria-labelledby={`${uid}-rm-${x.id}`}
                  className="flex flex-col gap-3 rounded-md bg-danger-soft p-4"
                >
                  <p id={`${uid}-rm-${x.id}`} className="text-sm text-ink">
                    {t.removeConfirm(who(x))}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={async () =>
                        (await run(() => api(`${base}/members/${x.id}`, { method: 'DELETE' }), t.removed)) &&
                        setRemoving(null)
                      }
                    >
                      {t.removeYes}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setRemoving(null)}>
                      {t.cancel}
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      {team.invitations.length ? (
        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-bold">{t.pending}</h2>
          <ul className="flex flex-col divide-y divide-border">
            {team.invitations.map((i) => (
              <li
                key={i.id}
                className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium break-all text-ink">{i.email}</p>
                  <p className={cn('text-xs', i.state === 'EXPIRED' ? 'text-danger' : 'text-text-muted')}>
                    {t.roles[i.role]} ·{' '}
                    {i.state === 'EXPIRED' ? t.expired : t.expiresOn(formatDateLong(new Date(i.expiresAt)))}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {i.state === 'EXPIRED' ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () =>
                            api(`${base}/members/invite`, {
                              method: 'POST',
                              body: { email: i.email, role: i.role },
                            }),
                          t.sent(i.email),
                        )
                      }
                    >
                      {t.resend}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      run(() => api(`${base}/invitations/${i.id}`, { method: 'DELETE' }), t.cancelled)
                    }
                  >
                    {t.cancelInvitation}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-bold">{t.inviteTitle}</h2>
          <p className="text-sm text-text-muted">{t.inviteIntro}</p>
        </div>
        <form onSubmit={sendInvite} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-email`} className="text-sm font-medium text-ink">
              {t.email}
            </label>
            <input
              id={`${uid}-email`}
              type="email"
              inputMode="email"
              autoComplete="off"
              value={invite.email}
              onChange={(e) => setInvite({ ...invite, email: e.target.value })}
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? `${uid}-email-error` : undefined}
              className={cn(fieldClass, 'text-base sm:text-sm')}
            />
            {emailError ? (
              <p id={`${uid}-email-error`} className="text-sm text-danger">
                {emailError}
              </p>
            ) : null}
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-ink">{t.role}</legend>
            {(['SECRETARY', 'ADMIN'] as const)
              .filter((r) => r === 'SECRETARY' || team.yourRole === 'OWNER')
              .map((r) => (
                <label
                  key={r}
                  className="flex min-h-11 items-start gap-2 rounded-md border border-border p-3 text-sm text-ink has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
                >
                  <input
                    type="radio"
                    name={`${uid}-role`}
                    className="mt-0.5 size-4 accent-primary"
                    checked={invite.role === r}
                    onChange={() => setInvite({ ...invite, role: r })}
                  />
                  {r === 'SECRETARY' ? t.roleSecretary : t.roleAdmin}
                </label>
              ))}
          </fieldset>
          {invite.role === 'SECRETARY' ? (
            <SecretaryRights
              agendas={team.agendas}
              agendaIds={invite.agendaIds}
              manageSettings={invite.manageSettings}
              onChange={(v) => setInvite({ ...invite, ...v })}
            />
          ) : null}
          <Button
            type="submit"
            disabled={busy}
            iconLeft={<MailPlus aria-hidden="true" size={18} />}
            className="self-start"
          >
            {t.send}
          </Button>
        </form>
      </Card>
    </div>
  );
}
