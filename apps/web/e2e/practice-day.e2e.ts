import { expect, test, type APIRequestContext } from '@playwright/test';
import { DEMO, signInPro } from './helpers';

/**
 * P4 — Journée au cabinet (secrétaire) et P5 — Absence imprévue (soignant), docs/01-produit/personas-et-parcours.md.
 * Demo practice: Dr Amina Saïd; patients Ahmed Mze (téléphone se terminant par 1102) and Nassur Attoumani.
 */

/** A weekday far ahead (other journeys use the coming weeks), as YYYY-MM-DD in Comoros time. */
function dayAhead(days: number, weekday: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
const comoros = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+03:00`).toISOString();

/** Cancels what is left on that day in the agenda, so an interrupted run does not leave the next one a conflict. */
async function freeDay(api: APIRequestContext, base: string, agendaId: string, day: string) {
  const events = await (
    await api.get(`${base}/agenda/events?from=${day}&to=${day}&agendaIds=${agendaId}`)
  ).json();
  for (const a of events.appointments.filter((x: { status: string }) =>
    ['CONFIRMED', 'ARRIVED', 'NO_SHOW'].includes(x.status),
  )) {
    if (a.status !== 'CONFIRMED')
      await api.patch(`${base}/appointments/${a.id}`, { data: { status: 'CONFIRMED' } });
    await api.post(`${base}/appointments/${a.id}/cancel`, { data: { notifyPatient: false } });
  }
}

async function practice(api: APIRequestContext) {
  const me = await (await api.get('/api/v1/pro/me')).json();
  const orgId: string = me.memberships[0].organizationId;
  const agendas = await (await api.get(`/api/v1/pro/orgs/${orgId}/agendas`)).json();
  const agenda = agendas.find(
    (a: { practitioner: { name: string } }) => a.practitioner.name === 'Dr Amina Saïd',
  );
  const patient = async (q: string) =>
    (await (await api.get(`/api/v1/pro/orgs/${orgId}/patients?q=${encodeURIComponent(q)}`)).json())[0];
  return { orgId, agenda, patient, base: `/api/v1/pro/orgs/${orgId}` };
}

test('P4 — la secrétaire prend un rendez-vous au téléphone, note l’arrivée et les absents', async ({
  page,
}) => {
  await signInPro(page, DEMO.secretary);
  const { agenda, patient, base } = await practice(page.request);
  const day = dayAhead(45, 3);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await freeDay(page.request, base, agenda.id, day);
  await freeDay(page.request, base, agenda.id, yesterday);

  // The patient calls: found by the last digits of his phone, booked on a free time.
  await page.goto('/pro/app/agenda');
  // Show Dr Amina Saïd's agenda; the drawer then offers it (and asks which one when several are shown).
  const aminaAgenda = page
    .getByRole('group', { name: 'Agendas affichés' })
    .getByRole('button', { name: /Amina Saïd/ });
  if ((await aminaAgenda.getAttribute('aria-pressed')) !== 'true') await aminaAgenda.click();
  await page.getByRole('button', { name: 'Rendez-vous', exact: true }).click();
  const drawer = page.getByRole('dialog');
  const agendaChoice = drawer.getByLabel('Agenda');
  if (await agendaChoice.count()) await agendaChoice.selectOption({ label: 'Dr Amina Saïd' });
  await drawer.getByLabel('Rechercher un patient par nom ou téléphone').fill('1102');
  await drawer.getByRole('button', { name: /Ahmed Mze/ }).click();
  await drawer.getByLabel('Date').fill(day);
  await drawer.getByLabel('Heure').fill('12:35');
  await drawer.getByRole('button', { name: 'Enregistrer le rendez-vous' }).click();
  await expect(drawer).toBeHidden();

  const events = await (
    await page.request.get(`${base}/agenda/events?from=${day}&to=${day}&agendaIds=${agenda.id}`)
  ).json();
  const booked = events.appointments.find(
    (a: { startsAt: string; patient: { lastName: string } }) =>
      a.startsAt === comoros(day, '12:35') && a.patient.lastName === 'Mze',
  );
  expect(booked, 'appointment created at 12:35 for Ahmed Mze').toBeTruthy();
  const messages = await (
    await page.request.get('/api/v1/dev/messages?to=ahmed.mze%40demo.twabibu.km')
  ).json();
  expect(messages.some((m: { template: string }) => m.template === 'appointment.booked')).toBe(true);

  // Arrival at the desk. « Non honoré » is not offered before the appointment time.
  await page.goto(`/pro/app/agenda?rdv=${booked.id}`);
  await expect(drawer.getByRole('button', { name: 'Non honoré' })).toHaveCount(0);
  await drawer.getByRole('button', { name: 'Patient arrivé' }).click();
  const statusOf = async (id: string) =>
    (await (await page.request.get(`${base}/appointments/${id}`)).json()).status;
  await expect.poll(() => statusOf(booked.id)).toBe('ARRIVED');

  // End of the day: yesterday's patient who did not come is marked as a no-show.
  const nassur = await patient('Attoumani');
  const missed = await (
    await page.request.post(`${base}/appointments`, {
      data: {
        agendaId: agenda.id,
        motiveId: agenda.motives[0].id,
        startsAt: comoros(yesterday, '20:05'),
        patientRecordId: nassur.id,
        notifyPatient: false,
        force: true,
      },
    })
  ).json();
  await page.goto(`/pro/app/agenda?rdv=${missed.id}`);
  await drawer.getByRole('button', { name: 'Non honoré' }).click();
  await expect.poll(() => statusOf(missed.id)).toBe('NO_SHOW');

  // Clean-up: the demo agenda stays as it was.
  await page.request.patch(`${base}/appointments/${missed.id}`, { data: { status: 'CONFIRMED' } });
  for (const id of [booked.id, missed.id])
    await page.request.post(`${base}/appointments/${id}/cancel`, { data: { notifyPatient: false } });
});

test('P5 — une absence imprévue annule les rendez-vous touchés et prévient les patients', async ({
  page,
}) => {
  await signInPro(page, DEMO.doctor);
  const { agenda, patient, base } = await practice(page.request);
  const day = dayAhead(60, 4);
  const ahmed = await patient('Mze');
  const nassur = await patient('Attoumani');
  // Start from a free afternoon, even after an interrupted run.
  await freeDay(page.request, base, agenda.id, day);
  const ids: string[] = [];
  for (const [hhmm, record] of [
    ['14:05', ahmed],
    ['15:05', nassur],
  ] as const) {
    const res = await page.request.post(`${base}/appointments`, {
      data: {
        agendaId: agenda.id,
        motiveId: agenda.motives[0].id,
        startsAt: comoros(day, hhmm),
        patientRecordId: record.id,
        notifyPatient: false,
        force: true,
      },
    });
    expect(res.status()).toBe(201);
    ids.push((await res.json()).id);
  }

  await page.goto('/pro/app/reglages');
  // The « Absences et congés » card: the block that has both its heading and the « Du » field.
  const absences = page
    .locator('div')
    .filter({ has: page.getByRole('heading', { name: 'Absences et congés' }) })
    .filter({ has: page.getByLabel('Du', { exact: true }) })
    .last();
  await absences.getByLabel('Du', { exact: true }).fill(day);
  await absences.getByLabel('à', { exact: true }).first().fill('13:00');
  await absences.getByLabel('Au', { exact: true }).fill(day);
  await absences.getByLabel('à', { exact: true }).nth(1).fill('18:00');
  await absences.getByLabel(/Motif/).fill('Formation');
  await absences.getByRole('button', { name: 'Vérifier les rendez-vous concernés' }).click();
  await expect(absences.getByText('2 rendez-vous sur cette période')).toBeVisible();
  await absences.getByRole('button', { name: 'Enregistrer et annuler ces rendez-vous' }).click();
  await expect(
    page.getByText('Absence enregistrée. 2 rendez-vous annulés, patients prévenus.'),
  ).toBeVisible();

  for (const id of ids) {
    const a = await (await page.request.get(`${base}/appointments/${id}`)).json();
    expect(a.status).toBe('CANCELLED_BY_PRACTICE');
  }
  const messages = await (
    await page.request.get('/api/v1/dev/messages?to=ahmed.mze%40demo.twabibu.km')
  ).json();
  expect(messages.some((m: { template: string }) => m.template === 'appointment.cancelled_by_practice')).toBe(
    true,
  );

  // Clean-up: remove the absence.
  const list = await (await page.request.get(`${base}/agendas/${agenda.id}/absences`)).json();
  for (const x of list.filter((a: { reason: string | null }) => a.reason === 'Formation'))
    await page.request.delete(`${base}/agendas/${agenda.id}/absences/${x.id}`);
});
