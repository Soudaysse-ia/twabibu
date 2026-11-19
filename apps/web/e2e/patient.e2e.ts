import { expect, test } from '@playwright/test';
import { completePatientSignup, enterEmailAndCode, newEmail } from './helpers';

/**
 * P1 — Réserver un rendez-vous (patient, mobile d'abord) and P2 — Déplacer / annuler.
 * docs/01-produit/personas-et-parcours.md. Demo data: Dr Amina Saïd, médecin généraliste à Moroni.
 */

test('P1 — un nouveau patient trouve un médecin, réserve pour un proche et retrouve le rendez-vous @mobile', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Que recherchez-vous ?').fill('généraliste');
  await page
    .getByRole('option', { name: /Médecin généraliste/ })
    .first()
    .click();
  await page.getByLabel('Ville, localité ou île').fill('Moroni');
  await page
    .getByRole('option', { name: /Moroni/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Rechercher' }).click();

  await expect(page).toHaveURL(/\/recherche/);
  await page.getByRole('link', { name: 'Dr Amina Saïd' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: /Amina Saïd/ })).toBeVisible();
  await page
    .getByRole('link', { name: /Prendre rendez-vous/ })
    .first()
    .click();

  // Motive, then the first free slot of the first day.
  await page.getByRole('heading', { name: 'Choisissez votre motif de consultation' }).waitFor();
  await page.locator('section ul button').first().click();
  await page.getByRole('heading', { name: 'Choisissez la date de consultation' }).waitFor();
  const day = page.locator('section ul > li > button[aria-expanded]').first();
  if ((await day.getAttribute('aria-expanded')) !== 'true') await day.click();
  await page.locator('section ul > li div.grid button').first().click();

  // Identification by e-mail code (ADR-016), new account, booking for a new relative.
  await enterEmailAndCode(page, newEmail('p1'));
  await completePatientSignup(page, 'Salma');
  await page.getByRole('button', { name: /Pour un proche/ }).click();
  await page.getByLabel('Prénom').fill('Nour');
  await page.getByLabel('Nom', { exact: true }).fill('Parcours');
  await page.getByLabel('Date de naissance').fill('2019-03-02');
  await page.getByLabel('Lien').selectOption('ENFANT');
  await page.getByRole('checkbox', { name: /J’ai lu et j’accepte les consignes/ }).check();
  await page.getByRole('button', { name: 'Confirmer le rendez-vous' }).click();

  await expect(
    page.getByRole('heading', { name: /Votre rendez-vous est confirmé|Votre demande est envoyée/ }),
  ).toBeVisible();
  await expect(page.getByText(/avec Dr Amina Saïd, pour Nour Parcours\./)).toBeVisible();

  await page.goto('/mon-compte/rendez-vous');
  await expect(page.getByText('Nour Parcours').first()).toBeVisible();
  await page.goto('/mon-compte/proches');
  await expect(page.getByText('Nour Parcours')).toBeVisible();
});

test('P2 — le patient déplace son rendez-vous puis l’annule', async ({ page }) => {
  await page.goto('/medecin-generaliste/moroni/amina-said/reserver');
  await page.locator('section ul button').first().click();
  // A few days ahead: tomorrow would already be inside the 24 h online cancellation deadline.
  const day = page.locator('section ul > li > button[aria-expanded]').nth(3);
  if ((await day.getAttribute('aria-expanded')) !== 'true') await day.click();
  await page.locator('section ul > li div.grid button').first().click();
  await enterEmailAndCode(page, newEmail('p2'));
  await completePatientSignup(page, 'Moussa');
  await page.getByRole('button', { name: /^Pour moi/ }).click();
  await page.getByRole('checkbox', { name: /J’ai lu et j’accepte les consignes/ }).check();
  await page.getByRole('button', { name: 'Confirmer le rendez-vous' }).click();
  await expect(
    page.getByRole('heading', { name: /Votre rendez-vous est confirmé|Votre demande est envoyée/ }),
  ).toBeVisible();

  // Move it to another slot.
  await page.goto('/mon-compte/rendez-vous');
  await page.getByRole('link', { name: 'Déplacer le rendez-vous' }).first().click();
  await expect(page).toHaveURL(/\/deplacer$/);
  await page.getByRole('heading', { name: 'Nouveaux horaires disponibles' }).waitFor();
  // The furthest slot offered, well beyond the cancellation deadline.
  await page.locator('section[aria-labelledby="slots"] button[aria-pressed]').last().click();
  await page.getByRole('button', { name: 'Confirmer le nouvel horaire' }).click();
  await expect(page.getByText('Rendez-vous déplacé')).toBeVisible();

  // Then cancel it.
  await page.goto('/mon-compte/rendez-vous');
  await page
    .getByRole('button', { name: /Annuler le rendez-vous/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Oui, annuler le rendez-vous' }).click();
  await expect(page.getByText(/annulé/i).first()).toBeVisible();
});
