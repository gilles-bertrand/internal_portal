import { test, expect } from '@playwright/test';

// @lat: [[apps/e2e-strategy#Permissions CASL#tech_admin bloqué sur Access Records et Incidents]]
test('tech_admin does not see Access Records / Incidents links and is redirected on direct navigation', async ({
  page,
}) => {
  await page.goto('/login');
  await page
    .getByRole('textbox', { name: 'Email *' })
    .fill('tech-admin-e2e@triptyk.eu');
  await page.getByRole('textbox', { name: 'Password *' }).fill('123456789');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');

  await expect(
    page.getByRole('link', { name: /access registry/i })
  ).not.toBeVisible();
  await expect(page.getByRole('link', { name: /incident/i })).not.toBeVisible();

  await page.goto('/access-records');
  await expect(page).toHaveURL('/');

  await page.goto('/incidents');
  await expect(page).toHaveURL('/');
});

// @lat: [[apps/e2e-strategy#Permissions CASL#encoder voit et accède à Access Records]]
test('encoder sees and can access Access Records', async ({ page }) => {
  await page.goto('/login');
  await page
    .getByRole('textbox', { name: 'Email *' })
    .fill('deflorenne.amaury@triptyk.eu');
  await page.getByRole('textbox', { name: 'Password *' }).fill('123456789');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');

  await page.getByRole('link', { name: /access registry/i }).click();
  await expect(
    page.getByRole('heading', { name: /access registry/i })
  ).toBeVisible();
});
