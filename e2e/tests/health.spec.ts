import { expect, test } from '@playwright/test';
import { E2E_USERS } from '../fixtures/test-users';

test('home page shows the API health status', async ({ page }) => {
  // The home page is behind ProtectedRoute, so an authenticated session is required.
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_USERS.agent.email);
  await page.getByLabel('Password').fill(E2E_USERS.agent.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Helpdesk' })).toBeVisible();
  await expect(page.getByText('API status')).toContainText('ok');
});
