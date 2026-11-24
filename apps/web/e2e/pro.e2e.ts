import { expect, test } from '@playwright/test';
import { DEMO, newEmail, signInPro } from './helpers';

/**
 * P3 — Ouvrir son agenda (inscription du soignant), P6 — Vérifier un soignant (back-office) and
 * P7 — Consultation complète (allergie bloquante sur l'ordonnance). docs/01-produit/personas-et-parcours.md
 */

const ADMIN_URL = process.env.E2E_ADMIN_URL ?? 'http://localhost:3200';

test('P3 + P6 — un soignant s’inscrit, Twabibu vérifie son dossier, son profil devient public', async ({
  page,
  browser,
}) => {
  const lastName = `Parcours${Date.now() % 100000}`;
  await page.goto('/pro');
  await page.getByRole('link', { name: 'Inscrire mon cabinet' }).first().click();
  await page.getByLabel('Adresse e-mail professionnelle').fill(newEmail('p3'));
  await page.getByRole('button', { name: 'Recevoir un code' }).click();
  await page.getByLabel(/Code reçu à/).fill('000000');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel('Spécialité').selectOption({ label: 'Pédiatre' });
  await page.getByLabel('Prénom').fill('Hadidja');
  await page.getByLabel('Nom', { exact: true }).fill(lastName);
  await page.getByLabel('Numéro d’autorisation d’exercer').fill('KM-E2E-0001');
  await page.getByLabel('Téléphone du cabinet').fill('773 00 00');
  await page.getByLabel('Nom du cabinet').fill(`Cabinet ${lastName}`);
  await page.getByLabel('Localité').selectOption({ label: 'Moroni' });
  await page.getByLabel('Adresse', { exact: true }).fill('Route de la Corniche');
  await page.getByRole('checkbox', { name: /conditions d’utilisation/ }).check();
  await page.getByRole('button', { name: 'Créer mon compte professionnel' }).click();

  await expect(page).toHaveURL(/\/pro\/app/);
  await expect(
    page.getByText('Votre profil sera publié après la vérification de votre dossier'),
  ).toBeVisible();
  // PRO-02: everything is still to set up; each step leads to its setting.
  await expect(page.getByRole('heading', { name: 'Votre cabinet est prêt à 0 %' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Avancement de l’installation' })).toHaveAttribute('aria-valuenow', '0');
  await page.getByRole('link', { name: 'Compléter : Horaires d’ouverture' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cabinet et horaires' })).toBeVisible();
  await page.getByRole('group', { name: 'Lundi' }).getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Cabinet enregistré' })).toBeVisible();
  // One step out of six.
  await page.goto('/pro/app');
  await expect(page.getByRole('heading', { name: 'Votre cabinet est prêt à 17 %' })).toBeVisible();

  // P6: the back-office checks the file and publishes it.
  const admin = await (await browser.newContext()).newPage();
  await admin.goto(`${ADMIN_URL}/connexion`);
  await admin.getByLabel('Adresse e-mail professionnelle').fill(DEMO.admin);
  await admin.getByRole('button', { name: 'Recevoir un code' }).click();
  await admin.getByLabel('Code reçu par e-mail').fill('000000');
  await admin.getByRole('button', { name: 'Valider' }).click();
  // Second factor (ADR-018): 000000 is accepted outside production.
  await admin.getByLabel('Code de l’application d’authentification').fill('000000');
  await admin.getByRole('button', { name: 'Valider' }).click();
  await admin.goto(`${ADMIN_URL}/verifications`);
  await admin.getByRole('link', { name: new RegExp(lastName) }).click();
  const checks = admin.getByRole('group', { name: 'Contrôles avant validation' }).getByRole('checkbox');
  await checks.first().waitFor();
  for (let i = 0; i < (await checks.count()); i++) await checks.nth(i).check();
  await admin.getByRole('button', { name: 'Valider et publier' }).click();
  await expect(admin.getByText('Vérifié').first()).toBeVisible();

  // Patients can now open the public profile.
  await page.goto(`/pediatre/moroni/hadidja-${lastName.toLowerCase()}`);
  await expect(
    page.getByRole('heading', { level: 1, name: new RegExp(`Hadidja ${lastName}`) }),
  ).toBeVisible();

  // The practitioner no longer sees the waiting banner.
  await page.goto('/pro/app');
  await expect(
    page.getByText('Votre profil sera publié après la vérification de votre dossier'),
  ).toBeHidden();
});

test('P7 — consultation : l’allergie aux pénicillines bloque l’amoxicilline, l’ordonnance est signée sans elle', async ({
  page,
}) => {
  await signInPro(page, DEMO.doctor);

  // Setup through the Pro API: an appointment for Mariama Houmadi (demo patient allergic to penicillins).
  const api = page.request;
  const me = await (await api.get('/api/v1/pro/me')).json();
  const orgId: string = me.memberships[0].organizationId;
  const agendas = await (await api.get(`/api/v1/pro/orgs/${orgId}/agendas`)).json();
  const agenda = agendas.find((a: { mine: boolean }) => a.mine);
  const from = new Date(Date.now() + 6 * 86_400_000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 13 * 86_400_000).toISOString().slice(0, 10);
  const avail = await (
    await api.get(
      `/api/v1/practitioners/amina-said/availabilities?motiveId=${agenda.motives[0].id}&from=${from}&to=${to}`,
    )
  ).json();
  const startsAt: string = avail.days.flatMap((d: { slots: { startsAt: string }[] }) => d.slots)[0].startsAt;
  const [mariama] = await (await api.get(`/api/v1/pro/orgs/${orgId}/patients?q=Houmadi`)).json();
  const created = await api.post(`/api/v1/pro/orgs/${orgId}/appointments`, {
    data: {
      agendaId: agenda.id,
      motiveId: agenda.motives[0].id,
      startsAt,
      patientRecordId: mariama.id,
      notifyPatient: false,
    },
  });
  expect(created.status()).toBe(201);
  const appointment = await created.json();

  await page.goto(`/pro/app/consultation/${appointment.id}`);
  await expect(page.getByText('Pénicillines').first()).toBeVisible();

  const drugSearch = page.getByLabel('Ajouter un médicament');
  await drugSearch.fill('amoxicilline');
  await page
    .getByRole('button', { name: /^Amoxicilline/ })
    .first()
    .click();
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: /allerg/i })
      .first(),
  ).toBeVisible();
  await expect(page.getByLabel('Justification pour prescrire malgré l’allergie')).toBeVisible();

  // The doctor removes it and prescribes something else.
  await page.getByRole('button', { name: 'Retirer la ligne' }).click();
  await drugSearch.fill('paracétamol');
  await page
    .getByRole('button', { name: /^Paracétamol/ })
    .first()
    .click();
  await page.getByLabel('Posologie').fill('1 comprimé 3 fois par jour si douleur');
  await page.getByRole('button', { name: 'Terminer et signer l’ordonnance' }).click();
  await expect(page.getByRole('heading', { name: 'Consultation enregistrée' })).toBeVisible();
  await expect(
    page.getByText('L’ordonnance est signée et ajoutée au dossier.', { exact: false }),
  ).toBeVisible();
});
