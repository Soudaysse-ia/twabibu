import { expect, test } from '@playwright/test';
import { DEMO, signInPro } from './helpers';

/**
 * PRO-07 — La praticienne complète son profil public (expertise, diplôme) depuis Twabibu Pro ; la page publique
 * le montre aussitôt. Le parcours retire ensuite ce qu’il a ajouté, pour laisser la démo comme il l’a trouvée.
 */
test('la praticienne complète son profil public et le voit aussitôt sur sa page', async ({ page }) => {
  const stamp = Date.now();
  const expertise = `Parcours ${stamp}`;
  const school = `Faculté ${stamp}`;
  await signInPro(page, DEMO.doctor);
  await page.goto('/pro/app/reglages');
  await page.getByRole('link', { name: 'Modifier le profil public' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Profil public' })).toBeVisible();
  // Name and speciality are checked by Twabibu: shown, not editable.
  await expect(page.getByText('Informations vérifiées par Twabibu')).toBeVisible();

  await page.getByLabel('Nouvelle expertise').fill(expertise);
  await page.getByLabel('Nouvelle expertise').press('Enter');
  await page.getByRole('button', { name: 'Ajouter un diplôme' }).click();
  const diploma = page
    .getByRole('group')
    .filter({ has: page.getByLabel('Établissement') })
    .last();
  await diploma.getByRole('textbox', { name: 'Année' }).fill('2009');
  await diploma.getByRole('textbox', { name: 'Diplôme', exact: true }).fill('Doctorat en médecine');
  await diploma.getByRole('textbox', { name: 'Établissement' }).fill(school);
  await page.getByRole('button', { name: 'Enregistrer le profil' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Profil enregistré' })).toBeVisible();

  const href = await page.getByRole('link', { name: 'Voir la page publique' }).getAttribute('href');
  expect(href).toMatch(/^\/[a-z-]+\/[a-z-]+\/[a-z0-9-]+$/);
  await page.goto(href!);
  await expect(page.getByText(expertise)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Formations' })).toBeVisible();
  await expect(page.getByText(`Doctorat en médecine, ${school}`)).toBeVisible();

  // Leave the demo profile as it was.
  await page.goto('/pro/app/reglages/profil');
  await page.getByRole('button', { name: `Retirer « ${expertise} »` }).click();
  const added = page.getByRole('group').filter({ has: page.locator(`input[value="${school}"]`) });
  await added.getByRole('button', { name: 'Retirer ce diplôme' }).click();
  await page.getByRole('button', { name: 'Enregistrer le profil' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Profil enregistré' })).toBeVisible();
  await page.goto(href!);
  await expect(page.getByText(expertise)).toHaveCount(0);
});
