import { expect, test, type Page } from '@playwright/test';
import { E2E_USERS } from '../fixtures/test-users';

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** Fails the assertion if a sign-in request is fired while `action` runs. */
async function expectNoSignInRequest(page: Page, action: () => Promise<void>) {
  let requested = false;
  await page.route('**/api/auth/sign-in/email', (route) => {
    requested = true;
    void route.continue();
  });

  await action();

  expect(requested).toBe(false);
}

test.describe('login', () => {
  test('agent can sign in and lands on / without a Users link', async ({ page }) => {
    await login(page, E2E_USERS.agent.email, E2E_USERS.agent.password);

    await expect(page).toHaveURL('/');
    await expect(page.getByText(E2E_USERS.agent.name)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);
  });

  test('admin can sign in, sees a Users link, and can open /users', async ({ page }) => {
    await login(page, E2E_USERS.admin.email, E2E_USERS.admin.password);
    await expect(page).toHaveURL('/');

    const usersLink = page.getByRole('link', { name: 'Users' });
    await expect(usersLink).toBeVisible();

    await usersLink.click();
    await expect(page).toHaveURL('/users');
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  });

  test('wrong password shows a server error and stays on /login', async ({ page }) => {
    await login(page, E2E_USERS.agent.email, 'definitely-the-wrong-password');

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('non-existent email shows a server error and stays on /login', async ({ page }) => {
    await login(page, 'no-such-user@helpdesk.test', 'whatever-password');

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });
});

test.describe('login form validation', () => {
  test('empty email is rejected client-side without a request', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Password').fill('some-password');

    await expectNoSignInRequest(page, async () => {
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByText('Enter a valid email address')).toBeVisible();
    });

    await expect(page).toHaveURL('/login');
  });

  test('empty password is rejected client-side without a request', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(E2E_USERS.agent.email);

    await expectNoSignInRequest(page, async () => {
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByText('Password is required')).toBeVisible();
    });

    await expect(page).toHaveURL('/login');
  });

  test('malformed email is rejected client-side without a request', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('notanemail');
    await page.getByLabel('Password').fill('some-password');

    await expectNoSignInRequest(page, async () => {
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByText('Enter a valid email address')).toBeVisible();
    });

    await expect(page).toHaveURL('/login');
  });
});

test.describe('route guards', () => {
  test('unauthenticated visit to / redirects to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });

  test('unauthenticated visit to /users redirects to /login', async ({ page }) => {
    await page.goto('/users');
    await expect(page).toHaveURL('/login');
  });

  test('authenticated agent visiting /users directly is redirected to /', async ({ page }) => {
    await login(page, E2E_USERS.agent.email, E2E_USERS.agent.password);
    await expect(page).toHaveURL('/');

    await page.goto('/users');
    await expect(page).toHaveURL('/');
  });

  test('already-authenticated user visiting /login is redirected to /', async ({ page }) => {
    await login(page, E2E_USERS.agent.email, E2E_USERS.agent.password);
    await expect(page).toHaveURL('/');

    await page.goto('/login');
    await expect(page).toHaveURL('/');
  });
});

test.describe('sign out and session lifecycle', () => {
  test('sign out clears the session and returns to /login', async ({ page }) => {
    await login(page, E2E_USERS.agent.email, E2E_USERS.agent.password);
    await expect(page).toHaveURL('/');

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/login');

    // A cleared session, not just client-side navigation: a fresh visit to a
    // protected route must bounce back to /login too.
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });

  test('session persists across a full page reload', async ({ page }) => {
    await login(page, E2E_USERS.agent.email, E2E_USERS.agent.password);
    await expect(page).toHaveURL('/');

    await page.reload();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });
});
