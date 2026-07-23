import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:8000/api/v1';

async function login(page: Page, email: string, password = '123456789') {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email *' }).fill(email);
  await page.getByRole('textbox', { name: 'Password *' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');
}

// Récupère le vrai jeton d'accès depuis la session ember-simple-auth (localStorage)
// — pas de mock d'auth : on réutilise le jeton du compte connecté.
async function accessToken(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('ember_simple_auth-session');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      authenticated?: { data?: { accessToken?: string } };
    };
    return parsed?.authenticated?.data?.accessToken ?? null;
  });
}

// @lat: [[apps/e2e-strategy#Permissions CASL#tech_admin accède au registre d'accès]]
test('tech_admin sees and accesses the Access Registry (UI + API)', async ({
  page,
}) => {
  await login(page, 'tech-admin-e2e@triptyk.eu');

  // Front : le lien est visible et mène au registre.
  await page.getByRole('link', { name: /access registry/i }).click();
  await expect(
    page.getByRole('heading', { name: /access registry/i })
  ).toBeVisible();
  await expect(page).toHaveURL(/access-records/);

  // Deep link direct : pas de redirection.
  await page.goto('/access-records');
  await expect(page).toHaveURL(/access-records/);

  // Lecture seule : le bouton de création est masqué (pas de droit create).
  await expect(
    page.locator('[data-test-add-record-button]')
  ).not.toBeVisible();

  // Accès direct à la route de création → redirigé vers la home.
  await page.goto('/access-records/create');
  await expect(page).toHaveURL('/');

  // Back : l'API de lecture répond 200 avec le vrai jeton (le rejet 403 de la
  // création par rôle est couvert par la matrice d'intégration backend, avec un
  // payload valide — ici un POST vide serait rejeté en 400 par la validation
  // du body avant même la garde de permission).
  const token = await accessToken(page);
  expect(token).toBeTruthy();
  const readRes = await page.request.get(`${API}/access-records`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(readRes.status()).toBe(200);
});

// @lat: [[apps/e2e-strategy#Permissions CASL#tech_admin reste banni des incidents (3 couches)]]
test('tech_admin stays blocked from Incidents on all layers (hidden, redirect, API 403)', async ({
  page,
}) => {
  await login(page, 'tech-admin-e2e@triptyk.eu');

  // 1. Front : le lien Incidents est masqué.
  await expect(page.getByRole('link', { name: /incident/i })).not.toBeVisible();

  // 2. Redirection : navigation directe renvoyée à l'accueil.
  await page.goto('/incidents');
  await expect(page).toHaveURL('/');

  // 3. Back : appel API direct rejeté en 403 (la garde serveur est obligatoire
  //    même quand l'UI masque la fonctionnalité).
  const token = await accessToken(page);
  expect(token).toBeTruthy();
  const res = await page.request.get(`${API}/incidents`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(403);
});

// @lat: [[apps/e2e-strategy#Permissions CASL#encoder voit et accède à Access Records]]
test('encoder sees and can access Access Records', async ({ page }) => {
  await login(page, 'deflorenne.amaury@triptyk.eu');

  await page.getByRole('link', { name: /access registry/i }).click();
  await expect(
    page.getByRole('heading', { name: /access registry/i })
  ).toBeVisible();
});
