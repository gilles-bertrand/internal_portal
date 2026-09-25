import { test, expect, type APIRequestContext } from '@playwright/test';

const API = 'http://localhost:8000/api/v1';

async function apiLogin(
  request: APIRequestContext,
  email: string
): Promise<string> {
  const res = await request.post(`${API}/auth/login`, {
    data: { email, password: '123456789' },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data.accessToken as string;
}

async function createSourceSystem(
  request: APIRequestContext,
  token: string,
  label: string
): Promise<string> {
  const res = await request.post(`${API}/source-systems`, {
    headers: { authorization: `Bearer ${token}` },
    data: { data: { type: 'source-systems', attributes: { label } } },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data.attributes.code as string;
}

async function createAccessRecord(
  request: APIRequestContext,
  token: string,
  sourceSystem: string,
  dataSubjectRef: string
): Promise<void> {
  const res = await request.post(`${API}/access-records`, {
    headers: { authorization: `Bearer ${token}` },
    data: {
      data: {
        type: 'access-records',
        attributes: {
          accessedAt: '2024-06-01T09:00:00.000Z',
          accessorRef: 'emp-001',
          dataSubjectRef,
          dataCategories: ['identité'],
          isSpecialCategory: false,
          accessType: 'consultation',
          purpose: 'support',
          legalBasis: 'art6.1b',
          sourceSystem,
          justification: 'E2E export scope',
        },
      },
    },
  });
  expect(res.ok()).toBeTruthy();
}

// @lat: [[apps/e2e-strategy#Export des accès par périmètre source system]]
test('export des accès : choix du périmètre demandé, filtrage serveur exact', async ({
  page,
  request,
}) => {
  // Données : 2 source systems distincts, un accès chacun (via API encoder).
  const encoderToken = await apiLogin(request, 'deflorenne.amaury@triptyk.eu');
  const codeA = await createSourceSystem(request, encoderToken, 'E2E System A');
  const codeB = await createSourceSystem(request, encoderToken, 'E2E System B');
  await createAccessRecord(request, encoderToken, codeA, 'subject-aaa');
  await createAccessRecord(request, encoderToken, codeB, 'subject-bbb');

  // UI : le DPO ouvre l'export → une modale de périmètre est demandée.
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email *' }).fill('dpo-e2e@triptyk.eu');
  await page.getByRole('textbox', { name: 'Password *' }).fill('123456789');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');

  await page.goto('/access-records');
  await page.locator('[data-test-export-button]').click();

  const modal = page.locator('[data-test-export-scope-modal]');
  await expect(modal).toBeVisible();
  await expect(page.locator('[data-test-scope-option="__all__"]')).toBeVisible();
  await expect(page.locator(`[data-test-scope-option="${codeA}"]`)).toBeVisible();

  // Sans sélection, la confirmation est bloquée.
  await expect(page.locator('[data-test-export-confirm]')).toBeDisabled();

  // Sélection d'un source system → l'export se déclenche (download capturé).
  await page.locator(`[data-test-scope-option="${codeA}"]`).check();
  await expect(page.locator('[data-test-export-confirm]')).toBeEnabled();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-test-export-confirm]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('registre-acces');

  // Contenu (filtre serveur) : export JSON filtré par A ne contient que A.
  const dpoToken = await apiLogin(request, 'dpo-e2e@triptyk.eu');
  const filtered = await request.post(`${API}/access-records/export`, {
    headers: { authorization: `Bearer ${dpoToken}` },
    data: { format: 'json', sourceSystem: codeA },
  });
  const filteredData = (await filtered.json()).data;
  const filteredContent = filteredData.content as string;
  expect(filteredContent).toContain('subject-aaa');
  expect(filteredContent).not.toContain('subject-bbb');
  // L'attestation d'intégrité reste valide sur un export filtré (elle porte sur
  // la chaîne complète du registre, pas sur le sous-ensemble).
  expect(filteredData.manifest.integrityOk).toBe(true);

  // « Tous » → le fichier contient l'ensemble des accès.
  const all = await request.post(`${API}/access-records/export`, {
    headers: { authorization: `Bearer ${dpoToken}` },
    data: { format: 'json' },
  });
  const allContent = (await all.json()).data.content as string;
  expect(allContent).toContain('subject-aaa');
  expect(allContent).toContain('subject-bbb');

  // Source system inexistant → 404 (validé côté serveur).
  const bad = await request.post(`${API}/access-records/export`, {
    headers: { authorization: `Bearer ${dpoToken}` },
    data: { format: 'json', sourceSystem: 'inexistant-xyz' },
  });
  expect(bad.status()).toBe(404);
});
