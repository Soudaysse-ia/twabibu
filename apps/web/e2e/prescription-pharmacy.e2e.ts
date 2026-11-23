import { expect, test, type Page } from '@playwright/test';
import { completePatientSignup, DEMO, enterEmailAndCode, newEmail, signInPro } from './helpers';

/**
 * P8 — Ordonnance → pharmacie (docs/01-produit/personas-et-parcours.md) : la praticienne signe, la patiente envoie
 * l'ordonnance à une pharmacie, la pharmacie répond, la patiente commande, la pharmacie remet ; la délivrance est
 * visible de la patiente et de la praticienne (SPEC-14 RX-05, SPEC-15).
 */
const PHARMACY = 'Pharmacie de démonstration du Port';

async function signInPharma(page: Page, email: string) {
  await page.goto('/pharma/connexion');
  await enterEmailAndCode(page, email);
  await expect(page).toHaveURL(/\/pharma\/app/);
}

test('P8 — de l’ordonnance signée à la délivrance en pharmacie, visible de la patiente et de la praticienne', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  // The patient: a new account, then an appointment with Dr Amina Saïd booked through the public booking API.
  const lastName = `Pharmacie${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(97 + Math.floor(Math.random() * 26))}`;
  await page.goto('/connexion');
  await enterEmailAndCode(page, newEmail('ordonnance'));
  await completePatientSignup(page, 'Nadia', lastName);
  await expect(page).not.toHaveURL(/\/connexion/);

  const api = page.request;
  const profile = await (await api.get('/api/v1/practitioners/amina-said')).json();
  const motiveId: string = profile.agenda.motives[0].id;
  const from = new Date(Date.now() + 8 * 86_400_000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 15 * 86_400_000).toISOString().slice(0, 10);
  const availability = await (
    await api.get(
      `/api/v1/practitioners/amina-said/availabilities?motiveId=${motiveId}&from=${from}&to=${to}`,
    )
  ).json();
  const startsAt: string = availability.days
    .flatMap((d: { slots: { startsAt: string }[] }) => d.slots)
    .at(-1).startsAt;
  const slot = { agendaId: profile.agenda.id, motiveId, startsAt };
  expect((await api.post('/api/v1/booking/locks', { data: slot })).status()).toBe(201);
  const booked = await api.post('/api/v1/booking/appointments', {
    data: { ...slot, instructionsAccepted: true },
  });
  expect(booked.status()).toBe(201);
  const appointment = await booked.json();

  // The practitioner prescribes paracetamol during the consultation and signs.
  const doctorContext = await browser.newContext();
  const doctor = await doctorContext.newPage();
  await signInPro(doctor, DEMO.doctor);
  await doctor.goto(`/pro/app/consultation/${appointment.id}`);
  await doctor.getByLabel('Ajouter un médicament').fill('paracétamol');
  await doctor
    .getByRole('button', { name: /^Paracétamol 500 mg/ })
    .first()
    .click();
  await doctor.getByLabel('Posologie').fill('1 comprimé 3 fois par jour si douleur');
  await doctor.getByRole('button', { name: 'Terminer et signer l’ordonnance' }).click();
  await expect(doctor.getByRole('heading', { name: 'Consultation enregistrée' })).toBeVisible();

  // The patient sends it to the pharmacy of the port.
  await page.goto('/mon-compte/ordonnances');
  const card = page.getByRole('listitem').filter({ hasText: 'Paracétamol 500 mg' }).first();
  await card.getByRole('button', { name: 'Envoyer à une pharmacie' }).click();
  // The option also says the town and « de garde » or « ouverte », which change with the day.
  const pharmacySelect = card.getByLabel('Pharmacie');
  await pharmacySelect.selectOption(
    (await pharmacySelect.locator('option', { hasText: PHARMACY }).getAttribute('value'))!,
  );
  await card.getByRole('button', { name: 'Envoyer', exact: true }).click();
  await expect(card.getByText('En attente de réponse')).toBeVisible();

  // The pharmacist answers: in stock, from the catalogue.
  const pharmaContext = await browser.newContext();
  const pharmacist = await pharmaContext.newPage();
  await signInPharma(pharmacist, DEMO.pharmacist);
  await pharmacist.goto('/pharma/app/ordonnances');
  const prescription = pharmacist.getByRole('listitem').filter({ hasText: `Nadia ${lastName}` });
  await prescription.getByLabel(/^Réponse pour Paracétamol/).selectOption('AVAILABLE');
  const product = prescription.getByLabel(/^Produit pour Paracétamol/);
  if ((await product.inputValue()) === '') {
    await prescription.getByLabel('Nom du produit').fill('Paracétamol 500 mg, boîte de 16');
    await prescription.getByLabel('Prix unitaire (KMF)').fill('1500');
  }
  await prescription.getByRole('button', { name: 'Répondre au patient' }).click();
  await expect(prescription.getByText('Réponse envoyée.', { exact: false })).toBeVisible();

  // The patient orders, to collect at the pharmacy.
  await page.goto('/mon-compte/ordonnances');
  const answered = page.getByRole('listitem').filter({ hasText: 'Paracétamol 500 mg' }).first();
  await expect(answered.getByText('Réponse reçue')).toBeVisible();
  await answered.getByRole('button', { name: 'Commander les produits disponibles' }).click();
  await expect(page).toHaveURL(/\/mon-compte\/commandes\//);

  // The pharmacy moves the order to the handover, which records the dispensation.
  await pharmacist.goto('/pharma/app/commandes');
  // Each order is a card directly inside its column (« Nouvelles », « À préparer »…); it moves on at every step.
  const order = () => pharmacist.locator('section > div').filter({ hasText: `Nadia ${lastName}` });
  for (const step of ['Accepter', 'Commencer la préparation', 'Prête à retirer', 'Marquer remise']) {
    await order().getByRole('button', { name: step }).click();
    await expect(order().getByRole('button', { name: step })).toHaveCount(0);
  }
  await expect(
    pharmacist.getByRole('region', { name: 'Terminées' }).getByText(`Nadia ${lastName}`, { exact: false }),
  ).toBeVisible();

  // Both the patient and the prescriber see what was handed over, where and when.
  await page.goto('/mon-compte/ordonnances');
  await expect(page.getByText(new RegExp(`Délivrée le .+ par ${PHARMACY}`)).first()).toBeVisible();
  await expect(page.getByText('1 × Paracétamol 500 mg').first()).toBeVisible();

  const me = await (await doctor.request.get('/api/v1/pro/me')).json();
  const orgId: string = me.memberships[0].organizationId;
  const [file] = await (await doctor.request.get(`/api/v1/pro/orgs/${orgId}/patients?q=${lastName}`)).json();
  await doctor.goto(`/pro/app/patients/${file.id}`);
  await expect(doctor.getByText(new RegExp(`Délivrée le .+ par ${PHARMACY}`)).first()).toBeVisible();

  await doctorContext.close();
  await pharmaContext.close();
});
