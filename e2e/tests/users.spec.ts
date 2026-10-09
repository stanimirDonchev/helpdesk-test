import { expect, test, type Page } from '@playwright/test';
import { E2E_USERS } from '../fixtures/test-users';

// Every mutating test here works on a user it creates itself. The seeded
// `E2E_USERS` accounts are read-only fixtures: `seed-e2e.ts` only ever corrects
// an existing user's `role`, never their name or password, so renaming one or
// rotating its password would permanently break `auth.spec.ts` with no reseed
// path back.
const THROWAWAY_PASSWORD = 'e2e-Throwaway-Pw1!';
const REPLACEMENT_PASSWORD = 'e2e-Rotated-Pw2!';

type ThrowawayUser = { name: string; email: string; password: string };

/**
 * A fresh identity per call. Uniqueness is load-bearing, not tidiness: deletion
 * is soft, so a deleted row keeps its email under the unique index and that
 * address is taken forever. A hardcoded email would pass once and 409 on every
 * later run. The shared `E2E Throwaway` / `e2e-user-` prefixes make the rows
 * these tests leave behind in `helpdesk_test` easy to spot.
 */
function throwawayUser(label: string): ThrowawayUser {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    name: `E2E Throwaway ${label} ${suffix}`,
    email: `e2e-user-${label}-${suffix}@example.com`,
    password: THROWAWAY_PASSWORD,
  };
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function loginAsAdmin(page: Page) {
  await login(page, E2E_USERS.admin.email, E2E_USERS.admin.password);
  await expect(page).toHaveURL('/');
}

async function gotoUsers(page: Page) {
  await page.goto('/users');
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/login');
}

async function expectSignInAccepted(page: Page, email: string, password: string) {
  await login(page, email, password);
  await expect(page).toHaveURL('/');
  // Leave no session behind, so a following attempt in the same test starts
  // from a signed-out state rather than being bounced off /login.
  await signOut(page);
}

async function expectSignInRejected(page: Page, email: string, password: string) {
  await login(page, email, password);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL('/login');
}

/**
 * Creates a user through the API with the browser context's own admin cookies,
 * for tests where creation is only setup. `page.request` shares the context's
 * cookie jar, and goes through the Vite proxy via `baseURL`.
 */
async function createUserViaApi(page: Page, user: ThrowawayUser) {
  const response = await page.request.post('/api/users', { data: user });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { user: { id: string } };
  return body.user;
}

/** Fails the assertion if `method` is requested against `url` while `action` runs. */
async function expectNoRequest(
  page: Page,
  method: string,
  url: string,
  action: () => Promise<void>,
) {
  let requested = false;
  await page.route(url, (route) => {
    if (route.request().method() === method) {
      requested = true;
    }
    void route.continue();
  });

  await action();

  expect(requested).toBe(false);
}

/** The table row for a user, found by their (unique) email. */
function userRow(page: Page, email: string) {
  return page.getByRole('row').filter({ hasText: email });
}

function createDialog(page: Page) {
  return page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Create user' }) });
}

function editDialog(page: Page) {
  return page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Edit user' }) });
}

async function openCreateDialog(page: Page) {
  await page.getByRole('button', { name: 'Create user' }).click();
  const dialog = createDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

async function fillUserForm(
  dialog: ReturnType<typeof createDialog>,
  values: { name?: string; email?: string; password?: string },
) {
  if (values.name !== undefined) await dialog.getByLabel('Name').fill(values.name);
  if (values.email !== undefined) await dialog.getByLabel('Email').fill(values.email);
  if (values.password !== undefined) await dialog.getByLabel('Password').fill(values.password);
}

test.describe('users list', () => {
  test('admin sees the seeded users with name, email, role and joined date', async ({ page }) => {
    await loginAsAdmin(page);
    await gotoUsers(page);

    for (const header of ['Name', 'Email', 'Role', 'Joined']) {
      await expect(page.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
    }
    // Fifth column header has an sr-only label rather than visible text.
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeAttached();

    const agentRow = userRow(page, E2E_USERS.agent.email);
    await expect(agentRow).toBeVisible();
    await expect(agentRow.getByText(E2E_USERS.agent.name, { exact: true })).toBeVisible();
    await expect(agentRow.getByText('agent', { exact: true })).toBeVisible();
    // Joined renders `createdAt` through `toLocaleDateString()`.
    await expect(agentRow.getByRole('cell').nth(3)).toHaveText(
      /\d{1,4}[^\d]\d{1,2}[^\d]\d{1,4}/,
    );

    const adminRow = userRow(page, E2E_USERS.admin.email);
    await expect(adminRow).toBeVisible();
    await expect(adminRow.getByText(E2E_USERS.admin.name, { exact: true })).toBeVisible();
    await expect(adminRow.getByText('admin', { exact: true })).toBeVisible();
  });

  test("the signed-in admin's own row offers edit but not delete", async ({ page }) => {
    await loginAsAdmin(page);
    await gotoUsers(page);

    // Not a disabled button: `DeleteUserDialog` renders nothing at all for the
    // acting user. Asserting another row still has one proves the absence is
    // about self-delete and not about delete controls being missing everywhere.
    await expect(page.getByRole('button', { name: `Delete ${E2E_USERS.admin.name}` })).toHaveCount(
      0,
    );
    await expect(page.getByRole('button', { name: `Edit ${E2E_USERS.admin.name}` })).toBeVisible();
    await expect(page.getByRole('button', { name: `Delete ${E2E_USERS.agent.name}` })).toBeVisible();
  });
});

test.describe('create user', () => {
  test('a new user appears in the table as an agent, and the form resets', async ({ page }) => {
    const user = throwawayUser('create');

    await loginAsAdmin(page);
    await gotoUsers(page);

    const dialog = await openCreateDialog(page);
    await fillUserForm(dialog, user);
    await dialog.getByRole('button', { name: 'Create user' }).click();

    await expect(dialog).toBeHidden();

    const row = userRow(page, user.email);
    await expect(row).toBeVisible();
    await expect(row.getByText(user.name, { exact: true })).toBeVisible();
    await expect(row.getByText('agent', { exact: true })).toBeVisible();

    // Reopening must not show the values just submitted.
    const reopened = await openCreateDialog(page);
    await expect(reopened.getByLabel('Name')).toHaveValue('');
    await expect(reopened.getByLabel('Email')).toHaveValue('');
    await expect(reopened.getByLabel('Password')).toHaveValue('');
  });

  test('the created user can sign in with the password just set', async ({ page }) => {
    const user = throwawayUser('signin');

    await loginAsAdmin(page);
    await gotoUsers(page);

    const dialog = await openCreateDialog(page);
    await fillUserForm(dialog, user);
    await dialog.getByRole('button', { name: 'Create user' }).click();
    await expect(userRow(page, user.email)).toBeVisible();

    await signOut(page);

    await login(page, user.email, user.password);
    await expect(page).toHaveURL('/');
    await expect(page.getByText(user.name)).toBeVisible();
    // Created users default to `agent`, so no admin-only nav.
    await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);
  });

  test('per-field validation errors block submission', async ({ page }) => {
    await loginAsAdmin(page);
    await gotoUsers(page);

    const dialog = await openCreateDialog(page);

    await expectNoRequest(page, 'POST', '**/api/users', async () => {
      await dialog.getByRole('button', { name: 'Create user' }).click();
      await expect(dialog.getByText('Name must be at least 3 characters')).toBeVisible();
      await expect(dialog.getByText('Enter a valid email address')).toBeVisible();
      await expect(dialog.getByText('Password must be at least 8 characters')).toBeVisible();

      // Still rejected when every field is filled but invalid.
      await fillUserForm(dialog, { name: 'ab', email: 'not-an-email', password: 'short' });
      await dialog.getByRole('button', { name: 'Create user' }).click();
      await expect(dialog.getByText('Name must be at least 3 characters')).toBeVisible();
      await expect(dialog.getByText('Enter a valid email address')).toBeVisible();
      await expect(dialog.getByText('Password must be at least 8 characters')).toBeVisible();
    });

    await expect(dialog).toBeVisible();
  });

  test('a duplicate email surfaces the server error and keeps the dialog open', async ({ page }) => {
    await loginAsAdmin(page);
    await gotoUsers(page);

    const dialog = await openCreateDialog(page);
    await fillUserForm(dialog, {
      name: 'E2E Throwaway Duplicate',
      // Reading a seeded account's email is safe; this request must fail, so
      // nothing about the fixture changes.
      email: E2E_USERS.admin.email,
      password: THROWAWAY_PASSWORD,
    });
    await dialog.getByRole('button', { name: 'Create user' }).click();

    await expect(dialog.getByRole('alert')).toHaveText('A user with this email already exists');
    await expect(dialog).toBeVisible();
  });

  test('a mixed-case email is normalized to lowercase', async ({ page }) => {
    const user = throwawayUser('mixedcase');
    const mixedCaseEmail = user.email.replace('e2e-user-', 'E2E-User-').replace('@example', '@Example');

    await loginAsAdmin(page);
    await gotoUsers(page);

    const dialog = await openCreateDialog(page);
    await fillUserForm(dialog, { ...user, email: mixedCaseEmail });
    await dialog.getByRole('button', { name: 'Create user' }).click();

    await expect(dialog).toBeHidden();
    await expect(userRow(page, mixedCaseEmail.toLowerCase())).toBeVisible();
  });
});

test.describe('edit user', () => {
  test('renaming updates the row, and reopening the dialog shows the new values', async ({
    page,
  }) => {
    const user = throwawayUser('rename');
    const renamed = throwawayUser('renamed');

    await loginAsAdmin(page);
    await createUserViaApi(page, user);
    await gotoUsers(page);

    await page.getByRole('button', { name: `Edit ${user.name}` }).click();
    const dialog = editDialog(page);
    await expect(dialog.getByLabel('Name')).toHaveValue(user.name);
    await expect(dialog.getByLabel('Email')).toHaveValue(user.email);
    await expect(dialog.getByText('Leave blank to keep the current password')).toBeVisible();

    await fillUserForm(dialog, { name: renamed.name, email: renamed.email });
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    await expect(dialog).toBeHidden();
    await expect(userRow(page, renamed.email)).toBeVisible();
    await expect(userRow(page, renamed.email).getByText(renamed.name, { exact: true })).toBeVisible();
    await expect(userRow(page, user.email)).toHaveCount(0);

    // Guards a stale-`defaultValues` regression: the dialog stays mounted per
    // row, so a second open must repopulate from the refetched row.
    await page.getByRole('button', { name: `Edit ${renamed.name}` }).click();
    await expect(dialog.getByLabel('Name')).toHaveValue(renamed.name);
    await expect(dialog.getByLabel('Email')).toHaveValue(renamed.email);
    await expect(dialog.getByLabel('Password')).toHaveValue('');
  });

  test('saving with the password left blank keeps the original password', async ({ page }) => {
    const user = throwawayUser('keep-pw');

    await loginAsAdmin(page);
    await createUserViaApi(page, user);
    await gotoUsers(page);

    await page.getByRole('button', { name: `Edit ${user.name}` }).click();
    const dialog = editDialog(page);
    await fillUserForm(dialog, { name: `${user.name} edited` });
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    await expect(dialog).toBeHidden();
    // The name cell specifically: the row's edit/delete buttons carry the name
    // in their sr-only labels too.
    await expect(
      userRow(page, user.email).getByRole('cell', { name: `${user.name} edited`, exact: true }),
    ).toBeVisible();

    await signOut(page);
    await expectSignInAccepted(page, user.email, user.password);
  });

  test('setting a new password replaces the old one', async ({ page }) => {
    const user = throwawayUser('rotate-pw');

    await loginAsAdmin(page);
    await createUserViaApi(page, user);
    await gotoUsers(page);

    await page.getByRole('button', { name: `Edit ${user.name}` }).click();
    const dialog = editDialog(page);
    await fillUserForm(dialog, { password: REPLACEMENT_PASSWORD });
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toBeHidden();

    await signOut(page);
    await expectSignInRejected(page, user.email, user.password);
    await expectSignInAccepted(page, user.email, REPLACEMENT_PASSWORD);
  });

  test('an invalid email is rejected client-side without a request', async ({ page }) => {
    const user = throwawayUser('edit-invalid');

    await loginAsAdmin(page);
    await createUserViaApi(page, user);
    await gotoUsers(page);

    await page.getByRole('button', { name: `Edit ${user.name}` }).click();
    const dialog = editDialog(page);

    await expectNoRequest(page, 'PATCH', '**/api/users/*', async () => {
      await fillUserForm(dialog, { email: 'not-an-email' });
      await dialog.getByRole('button', { name: 'Save changes' }).click();
      await expect(dialog.getByText('Enter a valid email address')).toBeVisible();
    });

    await expect(dialog).toBeVisible();
  });

  test("changing the email to another user's shows the server error", async ({ page }) => {
    const user = throwawayUser('edit-dup-a');
    const other = throwawayUser('edit-dup-b');

    await loginAsAdmin(page);
    await createUserViaApi(page, user);
    await createUserViaApi(page, other);
    await gotoUsers(page);

    await page.getByRole('button', { name: `Edit ${user.name}` }).click();
    const dialog = editDialog(page);
    await fillUserForm(dialog, { email: other.email });
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    await expect(dialog.getByRole('alert')).toHaveText('A user with this email already exists');
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(userRow(page, user.email)).toBeVisible();
  });
});

test.describe('delete user', () => {
  test('cancelling the confirmation keeps the user and sends no delete request', async ({
    page,
  }) => {
    const user = throwawayUser('delete-cancel');

    await loginAsAdmin(page);
    await createUserViaApi(page, user);
    await gotoUsers(page);

    await expectNoRequest(page, 'DELETE', '**/api/users/*', async () => {
      await page.getByRole('button', { name: `Delete ${user.name}` }).click();
      const dialog = page.getByRole('alertdialog');
      await expect(dialog.getByRole('heading', { name: 'Delete user' })).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toBeHidden();
    });

    await expect(userRow(page, user.email)).toBeVisible();
    await page.reload();
    await expect(userRow(page, user.email)).toBeVisible();
  });

  test('confirming removes the user from the table', async ({ page }) => {
    const user = throwawayUser('delete');

    await loginAsAdmin(page);
    await createUserViaApi(page, user);
    await gotoUsers(page);
    await expect(userRow(page, user.email)).toBeVisible();

    await page.getByRole('button', { name: `Delete ${user.name}` }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.getByRole('button', { name: 'Delete user' }).click();

    await expect(dialog).toBeHidden();
    await expect(userRow(page, user.email)).toHaveCount(0);
    // Soft-deleted rows are excluded server-side, not just dropped from the
    // cached list.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
    await expect(userRow(page, user.email)).toHaveCount(0);
  });

  test('a deleted user can no longer sign in', async ({ page }) => {
    const user = throwawayUser('delete-signin');

    await loginAsAdmin(page);
    await createUserViaApi(page, user);
    await gotoUsers(page);

    await page.getByRole('button', { name: `Delete ${user.name}` }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete user' }).click();
    await expect(userRow(page, user.email)).toHaveCount(0);

    await signOut(page);
    await expectSignInRejected(page, user.email, user.password);
  });

  test("a deleted user's email stays taken", async ({ page }) => {
    const user = throwawayUser('delete-email');

    await loginAsAdmin(page);
    await createUserViaApi(page, user);
    await gotoUsers(page);

    await page.getByRole('button', { name: `Delete ${user.name}` }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete user' }).click();
    await expect(userRow(page, user.email)).toHaveCount(0);

    // The row survives a soft delete, so the unique index still covers its
    // email -- there is no undelete and no way to re-register the address.
    const dialog = await openCreateDialog(page);
    await fillUserForm(dialog, { ...user, name: `${user.name} again` });
    await dialog.getByRole('button', { name: 'Create user' }).click();

    await expect(dialog.getByRole('alert')).toHaveText('A user with this email already exists');
  });
});
