import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { fr } from '@twabibu/i18n';
import { formatDateLong, formatPhone, formatTime, toDateKey } from '@twabibu/utils';
import { PrintButton } from '@/components/PrintButton';
import { apiGet } from '@/lib/api-server';
import { currentMembership, PRO_PRACTICE_COOKIE } from '@/lib/pro-practice';
import type { AgendaEvents, ProAgenda, ProMe } from '@/lib/pro-types';

const t = fr.agendaPrint;

export const metadata: Metadata = { title: t.title, robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The day's list on paper (SPEC-05 AGENDA-09): one table per agenda, with a box to tick when the patient arrives.
 * Administrative data only (name, phone, motive, status): no internal note, no patient message, nothing medical.
 * Which agendas show is decided by the API, as on screen.
 */
export default async function AgendaPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; agendas?: string }>;
}) {
  const q = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(q.date ?? '') ? q.date! : toDateKey(new Date());
  const asked = (q.agendas ?? '').split(',').filter((id) => UUID.test(id));

  const me = await apiGet<ProMe>('/v1/pro/me');
  if (!me.ok) redirect('/pro/connexion');
  const membership = currentMembership(
    me.data.memberships,
    (await cookies()).get(PRO_PRACTICE_COOKIE)?.value,
  );
  if (!membership) redirect('/pro/connexion');
  const org = membership.organizationId;
  const [agendas, events] = await Promise.all([
    apiGet<ProAgenda[]>(`/v1/pro/orgs/${org}/agendas`),
    apiGet<AgendaEvents>(
      `/v1/pro/orgs/${org}/agenda/events?from=${date}&to=${date}&agendaIds=${asked.join(',')}`,
    ),
  ]);
  if (!agendas.ok || !events.ok) redirect('/pro/app/agenda');

  const day = formatDateLong(new Date(`${date}T12:00:00Z`));
  const shown = agendas.data.filter((a) => events.data.agendaIds.includes(a.id));
  const now = new Date();

  return (
    <div className="flex flex-col gap-4 px-4">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-2 print:hidden">
        <Link
          href="/pro/app/agenda"
          className="inline-flex min-h-11 items-center text-sm font-bold text-navy hover:text-primary"
        >
          {t.back}
        </Link>
        <PrintButton />
      </div>

      <article className="mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-md bg-surface p-6 shadow-card print:max-w-none print:p-0 print:shadow-none">
        <header className="flex flex-col gap-1 border-b border-border pb-3">
          <p className="text-sm text-text-muted">{membership.organizationName}</p>
          <h1 className="text-xl font-bold text-ink first-letter:uppercase">{t.heading(day)}</h1>
        </header>

        {shown.map((agenda) => {
          const rows = events.data.appointments.filter((a) => a.agendaId === agenda.id);
          const absences = events.data.absences.filter((a) => a.agendaId === agenda.id);
          return (
            <section key={agenda.id} className="flex flex-col gap-2">
              <h2 className="flex flex-wrap items-baseline justify-between gap-2 text-base font-bold text-ink break-after-avoid">
                <span>{agenda.practitioner.name}</span>
                <span className="text-sm font-normal text-text-muted">
                  {agenda.practiceName} · {t.count(rows.length)}
                </span>
              </h2>
              {absences.map((a) => (
                <p
                  key={a.id}
                  className="rounded-md bg-warning-soft px-3 py-1.5 text-sm text-ink print:border print:border-border print:bg-transparent"
                >
                  {t.absence(formatTime(new Date(a.startsAt)), formatTime(new Date(a.endsAt)), a.reason)}
                </p>
              ))}
              {rows.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b-2 border-ink text-left">
                        <th scope="col" className="py-1.5 pr-3 font-bold">
                          {t.time}
                        </th>
                        <th scope="col" className="py-1.5 pr-3 font-bold">
                          {t.patient}
                        </th>
                        <th scope="col" className="py-1.5 pr-3 font-bold">
                          {t.phone}
                        </th>
                        <th scope="col" className="py-1.5 pr-3 font-bold">
                          {t.motive}
                        </th>
                        <th scope="col" className="py-1.5 pr-3 font-bold">
                          {t.status}
                        </th>
                        <th scope="col" className="w-14 py-1.5 text-center font-bold">
                          {t.arrived}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((a) => (
                        <tr key={a.id} className="border-b border-border align-top break-inside-avoid">
                          <td className="py-2 pr-3 font-medium whitespace-nowrap">
                            {formatTime(new Date(a.startsAt))}–{formatTime(new Date(a.endsAt))}
                          </td>
                          <td className="py-2 pr-3">
                            <span className="font-medium text-ink">
                              {a.patient.lastName.toUpperCase()} {a.patient.firstName}
                            </span>
                            {a.patient.birthDate ? (
                              <span className="block text-xs text-text-muted">
                                {new Date(`${a.patient.birthDate.slice(0, 10)}T12:00:00Z`).toLocaleDateString(
                                  'fr-FR',
                                  { timeZone: 'UTC' },
                                )}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {a.patient.phone ? formatPhone(a.patient.phone) : '—'}
                          </td>
                          <td className="py-2 pr-3">{a.motive.name}</td>
                          <td className="py-2 pr-3">{t.statuses[a.status] ?? a.status}</td>
                          <td className="py-2 text-center">
                            <span aria-hidden="true" className="inline-block size-4 border border-ink" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-text-muted">{t.empty}</p>
              )}
            </section>
          );
        })}

        <footer className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-text-muted">
          <p>{t.confidential}</p>
          <p>{t.printedAt(`${formatDateLong(now)} à ${formatTime(now)}`)}</p>
        </footer>
      </article>
    </div>
  );
}
