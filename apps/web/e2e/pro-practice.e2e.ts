import { expect, test } from '@playwright/test';
import { DEMO, signInPro } from './helpers';

/**
 * PRO-06 — La direction complète l’accès du cabinet ; la page publique de la praticienne le montre aussitôt.
 * La secrétaire voit la fiche du cabinet sans pouvoir la modifier. Le parcours efface ensuite ce qu’il a écrit.
 */
test('la direction précise l’accès au cabinet, visible aussitôt sur la page publique', async ({
  page,
  browser,
}) => {
  const note = `Entrée par la cour, sonnette bleue (${Date.now()})`;
  await signInPro(page, DEMO.owner);
  await page.goto('/pro/app/reglages');
  await page.getByRole('link', { name: 'Cabinet et horaires' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cabinet et horaires' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Carte : position du cabinet' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Lundi' })).toBeVisible();

  await page.getByLabel('Précisions pour venir').fill(note);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Cabinet enregistré' })).toBeVisible();

  await page.goto('/medecin-generaliste/moroni/amina-said');
  await expect(page.getByText(note)).toBeVisible();

  // The secretary reads the same page, without the save button.
  const context = await browser.newContext();
  const secretary = await context.newPage();
  await signInPro(secretary, DEMO.secretary);
  await secretary.goto('/pro/app/reglages/cabinet');
  await expect(
    secretary.getByText('Lecture seule : seuls le titulaire et l’administration modifient le cabinet.'),
  ).toBeVisible();
  await expect(secretary.getByLabel('Précisions pour venir')).toBeDisabled();
  await expect(secretary.getByRole('button', { name: 'Enregistrer' })).toHaveCount(0);
  await context.close();

  // Leave the demo practice as it was.
  await page.goto('/pro/app/reglages/cabinet');
  await page.getByLabel('Précisions pour venir').fill('');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Cabinet enregistré' })).toBeVisible();
});
