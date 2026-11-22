import { expect, test } from '@playwright/test';

/** SEARCH-08 — Pages « spécialité à lieu » pour les moteurs de recherche, plan du site, fermeture avant le lancement. */

test('une page « Médecin généraliste à Moroni » mène au profil et aux spécialités voisines @mobile', async ({
  page,
}) => {
  await page.goto('/medecin-generaliste/moroni');
  await expect(page.getByRole('heading', { level: 1, name: 'Médecin généraliste à Moroni' })).toBeVisible();
  await expect(page).toHaveTitle(/Médecin généraliste Moroni : prenez rendez-vous en ligne/);
  await expect(page.getByRole('navigation', { name: 'Fil d’Ariane' })).toContainText('Accueil');
  await expect(page.getByRole('link', { name: 'Dr Amina Saïd' }).first()).toHaveAttribute(
    'href',
    '/medecin-generaliste/moroni/amina-said',
  );

  await page
    .getByRole('navigation', { name: 'Autres spécialités à Moroni' })
    .getByRole('link', { name: 'Pédiatre' })
    .click();
  await expect(page).toHaveURL(/\/pediatre\/moroni$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Pédiatre à Moroni' })).toBeVisible();
});

test('aucune page sans résultat, un plan du site, et rien d’indexé avant le lancement', async ({
  page,
  request,
}) => {
  const missing = await page.goto('/medecin-generaliste/lieu-inconnu');
  expect(missing?.status()).toBe(404);

  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('/medecin-generaliste/moroni</loc>');
  expect(sitemap).toContain('/medecin-generaliste/moroni/amina-said</loc>');
  expect(sitemap).not.toContain('lieu-inconnu');

  expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /');
});
