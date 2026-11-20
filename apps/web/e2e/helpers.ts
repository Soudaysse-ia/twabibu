import { expect, type Page } from '@playwright/test';

export { DEMO } from './global-setup';

/** A fresh, fictional address for each run (the e-mail provider is fake: the code is always 000000). */
export const newEmail = (who: string) => `${who}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@exemple.km`;

/** E-mail + code form (ADR-016), wherever it appears: sign-in page, booking funnel, Pro and Pharma sign-in. */
export async function enterEmailAndCode(page: Page, email: string) {
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByRole('button', { name: 'Recevoir un code par e-mail' }).click();
  await page.getByLabel('Code reçu par e-mail').fill('000000');
  await page.getByRole('button', { name: 'Valider' }).click();
}

/** New patient account, after the code: identity, terms, account created. */
export async function completePatientSignup(page: Page, firstName: string, lastName = 'Parcours') {
  await page.getByLabel('Prénom').fill(firstName);
  await page.getByLabel('Nom', { exact: true }).fill(lastName);
  await page.getByLabel('Date de naissance').fill('1991-06-15');
  await page.getByRole('checkbox', { name: /conditions d’utilisation/ }).check();
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
}

export async function signUpPatient(page: Page, firstName: string) {
  const email = newEmail(firstName.toLowerCase());
  await page.goto('/connexion');
  await enterEmailAndCode(page, email);
  await completePatientSignup(page, firstName);
  await expect(page).not.toHaveURL(/\/connexion/);
  return email;
}

export async function signInPro(page: Page, email: string) {
  await page.goto('/pro/connexion');
  await enterEmailAndCode(page, email);
  await expect(page).toHaveURL(/\/pro\/app/);
}
