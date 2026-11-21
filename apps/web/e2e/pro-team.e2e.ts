import { expect, test } from '@playwright/test';
import { DEMO, newEmail, signInPro } from './helpers';

/**
 * PRO-05 — Le titulaire invite une secrétaire limitée à un agenda ; elle crée son accès depuis le lien reçu par
 * e-mail ; le titulaire la retire ensuite. Le lien est lu dans la boîte factice (`/v1/dev/messages`).
 */
test('le titulaire invite une secrétaire, qui rejoint le cabinet depuis le lien, puis la retire', async ({
  page,
  browser,
}) => {
  const email = newEmail('secretaire');
  await signInPro(page, DEMO.owner);
  await page.goto('/pro/app/reglages');
  await page.getByRole('link', { name: 'Gérer l’équipe' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Équipe' })).toBeVisible();

  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByRole('group', { name: 'Agendas accessibles' }).getByRole('checkbox').first().check();
  await page.getByRole('button', { name: 'Envoyer l’invitation' }).click();
  await expect(page.getByText(`Invitation envoyée à ${email}.`)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Invitations en attente' })).toBeVisible();

  const messages = await (
    await page.request.get(`/api/v1/dev/messages?to=${encodeURIComponent(email)}`)
  ).json();
  const link = (messages as { template: string; text: string }[])
    .find((m) => m.template === 'team.invitation')
    ?.text.match(/\/pro\/invitation\/[A-Za-z0-9_-]+/)?.[0];
  expect(link, 'invitation e-mail with its link').toBeTruthy();

  // The newcomer, in her own browser: confirms her address with the code and lands in Twabibu Pro.
  const context = await browser.newContext();
  const invitee = await context.newPage();
  await invitee.goto(link!);
  await expect(invitee.getByText(/en tant que secrétaire/)).toBeVisible();
  await invitee.getByRole('button', { name: 'Recevoir le code' }).click();
  await invitee.getByLabel('Code reçu par e-mail').fill('000000');
  await invitee.getByRole('button', { name: 'Confirmer et rejoindre' }).click();
  await expect(invitee).toHaveURL(/\/pro\/app/);
  await expect(invitee.getByRole('banner').getByText('Secrétariat', { exact: true }).first()).toBeVisible();
  await context.close();

  // Back to the owner: she is in the team; removing her closes her access.
  await page.reload();
  const row = page.getByRole('listitem').filter({ hasText: email });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Retirer' }).click();
  await row.getByRole('button', { name: 'Oui, retirer' }).click();
  await expect(page.getByText('Membre retiré. Ses sessions sont fermées.')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: email })).toHaveCount(0);
});
