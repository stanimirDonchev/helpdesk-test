import { expect, test } from '@playwright/test';

test('home page shows the API health status', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Helpdesk' })).toBeVisible();
  await expect(page.getByText('API status: ok')).toBeVisible();
});
