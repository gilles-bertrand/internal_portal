import { test, expect } from '@playwright/test';

test('can open new incident form', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/login');
  await page.getByRole('textbox', { name: /email/i }).fill('deflorenne.amaury@triptyk.eu');
  await page.getByRole('textbox', { name: /password/i }).fill('123456789');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/');

  await page.goto('/incidents/create');
  await page.waitForTimeout(2000);

  if (errors.length) {
    throw new Error(`Console errors:\n${errors.join('\n')}`);
  }

  await expect(page.locator('[data-test-incident-form]')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('[data-test-incident-next]')).toBeVisible();
  await expect(page.getByRole('heading', { name: /header|en-tête/i })).toBeVisible();
});
