import { expect, test } from '@playwright/test';
import { newEmail } from './helpers';

/** WEB-02 — Le centre d'aide répond, sinon le patient écrit au support. Pages légales accessibles depuis le pied de page. */

test("un patient lit une page d'aide puis écrit au support @mobile", async ({ page }) => {
  await page.goto('/');
  await page.getByRole('contentinfo').getByRole('link', { name: "Centre d'aide" }).click();
  await expect(page.getByRole('heading', { level: 1, name: "Centre d'aide" })).toBeVisible();

  await page.getByRole('link', { name: /Qui voit mon dossier médical/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Qui voit mon dossier médical ?' })).toBeVisible();
  await expect(page.getByText('n’y ont jamais accès')).toBeVisible();

  await page.getByRole('link', { name: 'Nous contacter' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Nous contacter' })).toBeVisible();

  // Nothing filled in: the form says what is missing and stays on the page.
  await page.getByRole('button', { name: 'Envoyer le message' }).click();
  await expect(page.getByText('Indiquez votre nom (2 caractères au moins).')).toBeVisible();
  await expect(page.getByLabel('Votre nom')).toBeFocused();

  await page.getByLabel('Votre nom').fill('Fatima Ali');
  await page.getByLabel('Votre adresse e-mail').fill(newEmail('contact'));
  await page.getByRole('radio', { name: 'Patient' }).check();
  await page
    .getByLabel('Votre message')
    .fill('Bonjour, je ne retrouve pas la confirmation de mon rendez-vous de mardi.');
  await page.getByRole('button', { name: 'Envoyer le message' }).click();
  await expect(page.getByRole('status')).toContainText('Votre message est envoyé');
});

test('les pages légales sont accessibles depuis le pied de page', async ({ page }) => {
  for (const [link, heading] of [
    ["Conditions générales d'utilisation", 'Conditions générales d’utilisation'],
    ['Protection des données personnelles', 'Protection des données personnelles'],
    ['Mentions légales', 'Mentions légales'],
  ]) {
    await page.goto('/');
    await page.getByRole('contentinfo').getByRole('link', { name: link }).click();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText('Document provisoire.')).toBeVisible();
  }
});
