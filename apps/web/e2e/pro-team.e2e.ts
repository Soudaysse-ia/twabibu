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

/** PRO-05 suite — un soignant qui a son propre cabinet et rejoint celui de la démo passe de l’un à l’autre. */
test('un soignant membre de deux cabinets passe de l’un à l’autre', async ({ page, browser }) => {
  // His own practice, created through the API (the sign-up screens are covered by P3).
  const email = newEmail('dr-deux-cabinets');
  const stamp = Date.now();
  const [speciality] = await (await page.request.get('/api/v1/directory/specialities')).json();
  const [locality] = await (await page.request.get('/api/v1/directory/localities?island=ngazidja')).json();
  await page.request.post('/api/v1/auth/otp/request', { data: { email, purpose: 'SIGNUP' } });
  const verify = await (
    await page.request.post('/api/v1/auth/otp/verify', { data: { email, purpose: 'SIGNUP', code: '000000' } })
  ).json();
  const ownPractice = `Cabinet Deux ${stamp}`;
  const signup = await page.request.post('/api/v1/auth/signup/practitioner', {
    data: {
      signupToken: verify.signupToken,
      kind: 'INDEPENDENT',
      specialityId: speciality.id,
      title: 'DR',
      firstName: 'Ali',
      lastName: `Deux${stamp}`,
      licenseNumber: 'KM-2026-0777',
      phone: '773 45 67',
      organizationName: ownPractice,
      addressLine: 'Rue du Port',
      localityId: locality.id,
      acceptTerms: true,
    },
  });
  expect(signup.ok()).toBeTruthy();

  // The demo practice invites him as an administrator.
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await signInPro(owner, DEMO.owner);
  await owner.goto('/pro/app/reglages/equipe');
  await owner.getByLabel('Adresse e-mail').fill(email);
  await owner.getByRole('radio', { name: /^Administration/ }).check();
  await owner.getByRole('button', { name: 'Envoyer l’invitation' }).click();
  await expect(owner.getByText(`Invitation envoyée à ${email}.`)).toBeVisible();
  const messages = await (
    await owner.request.get(`/api/v1/dev/messages?to=${encodeURIComponent(email)}`)
  ).json();
  const link = (messages as { template: string; text: string }[])
    .find((m) => m.template === 'team.invitation')
    ?.text.match(/\/pro\/invitation\/[A-Za-z0-9_-]+/)?.[0];

  // Already signed in with the invited address: one click, and he lands in the practice he just joined.
  await page.goto(link!);
  await page.getByRole('button', { name: 'Rejoindre l’équipe' }).click();
  await expect(page).toHaveURL(/\/pro\/app/);
  const switcher = page.getByRole('combobox', { name: 'Cabinet' });
  await expect(switcher.locator('option:checked')).toHaveText('Clinique de démonstration Al-Kamar');

  // Back to his own practice, remembered on the next pages.
  await switcher.selectOption({ label: ownPractice });
  await expect(page.getByRole('combobox', { name: 'Cabinet' }).locator('option:checked')).toHaveText(
    ownPractice,
  );
  await page.goto('/pro/app/agenda');
  await expect(page.getByRole('combobox', { name: 'Cabinet' }).locator('option:checked')).toHaveText(
    ownPractice,
  );

  // Clean-up: the demo practice removes him again.
  await owner.goto('/pro/app/reglages/equipe');
  const row = owner.getByRole('listitem').filter({ hasText: email });
  await row.getByRole('button', { name: 'Retirer' }).click();
  await row.getByRole('button', { name: 'Oui, retirer' }).click();
  await expect(owner.getByText('Membre retiré. Ses sessions sont fermées.')).toBeVisible();
  await ownerContext.close();
});
