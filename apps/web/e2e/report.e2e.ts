import { expect, test } from '@playwright/test';
import { DEMO } from './helpers';

/** PROFILE-06 + ADMIN-07 — Un visiteur signale un profil ; l'équipe Twabibu le traite dans le back-office. */
const ADMIN_URL = process.env.E2E_ADMIN_URL ?? 'http://localhost:3200';

test('un visiteur signale un profil, l’équipe Twabibu traite le signalement', async ({ page, browser }) => {
  const details = `Le numéro affiché ne répond plus (${Date.now()}).`;
  await page.goto('/medecin-generaliste/moroni/amina-said');
  await page.getByRole('link', { name: 'Signaler un problème avec ce profil' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Signaler un problème' })).toBeVisible();

  // Nothing chosen: the form says so.
  await page.getByRole('button', { name: 'Envoyer le signalement' }).click();
  await expect(page.getByText('Choisissez le problème rencontré.')).toBeVisible();
  await page.getByRole('radio', { name: /Informations inexactes/ }).check();
  await page.getByLabel('Précisions (facultatif)').fill(details);
  await page.getByRole('button', { name: 'Envoyer le signalement' }).click();
  await expect(page.getByRole('status')).toContainText('Votre signalement est transmis');

  // Back-office: the report waits in the queue with its details; the team dismisses it (the demo profile stays online).
  const admin = await (await browser.newContext()).newPage();
  await admin.goto(`${ADMIN_URL}/connexion`);
  await admin.getByLabel('Adresse e-mail professionnelle').fill(DEMO.admin);
  await admin.getByRole('button', { name: 'Recevoir un code' }).click();
  await admin.getByLabel('Code reçu par e-mail').fill('000000');
  await admin.getByRole('button', { name: 'Valider' }).click();
  await admin.getByLabel('Code de l’application d’authentification').fill('000000');
  await admin.getByRole('button', { name: 'Valider' }).click();
  // The menu appears once both codes are checked: follow it rather than loading the page while sign-in finishes.
  await admin
    .getByRole('navigation', { name: 'Back-office' })
    .getByRole('link', { name: 'Signalements' })
    .click();
  await expect(admin.getByRole('heading', { level: 1, name: 'Signalements' })).toBeVisible();
  const card = admin.getByRole('listitem').filter({ hasText: details });
  await expect(card.getByText('Informations inexactes (adresse, téléphone, horaires, tarifs)')).toBeVisible();
  await expect(card.getByText('Visiteur non connecté', { exact: false })).toBeVisible();
  await card.getByRole('button', { name: 'Ignorer' }).click();
  await expect(admin.getByText('Signalement ignoré.')).toBeVisible();
  await expect(admin.getByRole('listitem').filter({ hasText: details })).toHaveCount(0);
});
