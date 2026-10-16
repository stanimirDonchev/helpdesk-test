import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { INBOUND_WEBHOOK_AUTH_HEADER } from '../fixtures/inbound-webhook';
import { E2E_USERS } from '../fixtures/test-users';

const INBOUND_PATH = '/api/inbound/postmark';

/** A well-formed Basic header carrying credentials the server must reject. */
const WRONG_AUTH_HEADER = `Basic ${Buffer.from('inbound-test:not-the-password').toString('base64')}`;

/** A syntactically valid id that no ticket will ever have. */
const UNKNOWN_TICKET_ID = '00000000-0000-4000-8000-000000000000';

type PostmarkPayload = Record<string, unknown>;

type InboundResponse = { ticketId: string; created: boolean };

/**
 * A Postmark payload whose `MessageID` and `Subject` have never been seen.
 *
 * Uniqueness is load-bearing twice over, because `helpdesk_test` is never reset
 * between runs: `messageId` is UNIQUE *and* the idempotency key, so a hardcoded
 * one would create a ticket on the first ever run and then be an invisible
 * `created: false` no-op forever after; and the subject is how each test finds
 * its own row among every ticket left behind by earlier runs. Nothing in this
 * file may assert on the table's total row count or on "the first row".
 */
function inboundEmail(label: string, overrides: PostmarkPayload = {}): PostmarkPayload {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    MessageID: `e2e-${label}-${suffix}@inbound.e2e`,
    From: `e2e-sender-${label}-${suffix}@example.com`,
    FromName: 'E2E Sender',
    Subject: `E2E Inbound ${label} ${suffix}`,
    TextBody: 'Reported from the e2e inbound-email spec.',
    Date: 'Mon, 5 Jan 2026 16:33:54 -0500',
    // Fields the route deliberately doesn't consume, so a passing test also
    // shows unknown keys are stripped rather than rejected.
    MessageStream: 'inbound',
    Headers: [{ Name: 'X-Spam-Status', Value: 'No' }],
    ...overrides,
  };
}

/** Narrowing helper: payload values are `unknown` so the table reads cleanly. */
function text(value: unknown): string {
  return value as string;
}

/**
 * Posts to the webhook. `authorization` defaults to the credentials the e2e
 * server was started with (`e2e/fixtures/inbound-webhook.ts` is the single
 * source of truth, shared with `playwright.config.ts`); pass `null` to send no
 * header at all.
 *
 * The call goes through the Vite proxy via `baseURL`, like all other e2e
 * traffic. `page.request` is used rather than the standalone `request` fixture
 * so each test's webhook calls and browser navigation share one context; the
 * route itself is session-agnostic, so the cookie jar is irrelevant to it.
 */
function postInbound(
  api: APIRequestContext,
  payload: PostmarkPayload,
  authorization: string | null = INBOUND_WEBHOOK_AUTH_HEADER,
) {
  return api.post(INBOUND_PATH, {
    data: payload,
    headers: authorization ? { Authorization: authorization } : {},
  });
}

/** Posts a payload that must be accepted, returning the parsed response. */
async function ingest(api: APIRequestContext, payload: PostmarkPayload) {
  const response = await postInbound(api, payload);
  expect(response.status()).toBe(200);
  return (await response.json()) as InboundResponse;
}

async function fetchTicket(api: APIRequestContext, id: string) {
  const response = await api.get(`/api/tickets/${id}`);
  expect(response.status()).toBe(200);
  return (await response.json()) as {
    ticket: {
      subject: string;
      body: string;
      senderEmail: string;
      senderName: string | null;
      status: string;
      category: string | null;
      replies: { senderType: string; body: string }[];
    };
  };
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');
}

function loginAsAdmin(page: Page) {
  return login(page, E2E_USERS.admin.email, E2E_USERS.admin.password);
}

function loginAsAgent(page: Page) {
  return login(page, E2E_USERS.agent.email, E2E_USERS.agent.password);
}

async function gotoTickets(page: Page) {
  await page.goto('/tickets');
  await expect(page.getByRole('heading', { name: 'Tickets' })).toBeVisible();
}

/** The table row for a ticket, found by its unique-per-run subject or sender. */
function ticketRow(page: Page, needle: string) {
  return page.getByRole('row').filter({ hasText: needle });
}

/**
 * Asserts `subject` has no row on `/tickets`, for a page that's already signed
 * in.
 *
 * The anchor email is what makes the absence meaningful: an accepted ticket
 * ingested right alongside the rejected one must appear, so by the time its row
 * is visible the list has loaded *and* rendered — a bare `toHaveCount(0)` would
 * also pass against a still-pending query or a broken page.
 */
async function expectTicketNotListed(page: Page, subject: string) {
  const anchor = inboundEmail('anchor');
  await ingest(page.request, anchor);

  await gotoTickets(page);
  await expect(ticketRow(page, text(anchor.Subject))).toBeVisible();
  await expect(ticketRow(page, subject)).toHaveCount(0);
}

test.describe('inbound email webhook', () => {
  test('a valid payload creates a ticket that appears on /tickets', async ({ page }) => {
    const email = inboundEmail('create');

    const body = await ingest(page.request, email);
    expect(body.created).toBe(true);
    expect(body.ticketId).toBeTruthy();

    await loginAsAdmin(page);
    await gotoTickets(page);

    for (const header of ['Subject', 'From', 'Status', 'Category', 'Received']) {
      await expect(page.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
    }

    const row = ticketRow(page, text(email.Subject));
    await expect(row).toBeVisible();
    await expect(row.getByRole('cell', { name: text(email.Subject), exact: true })).toBeVisible();
    // `From` renders `Name <email>` when the sender had a display name.
    await expect(
      row.getByRole('cell', { name: `${text(email.FromName)} <${text(email.From)}>`, exact: true }),
    ).toBeVisible();
    // Ingest sets `status: "open"` and leaves `category` null (no classifier
    // yet), which the table shows as the `Open` label and an em dash.
    await expect(row.getByText('Open', { exact: true })).toBeVisible();
    await expect(row.getByText('—', { exact: true })).toBeVisible();
    // `Received` comes from the payload's `Date`, via `toLocaleDateString()`.
    await expect(row.getByRole('cell').nth(4)).toHaveText(/\d{1,4}[^\d]\d{1,2}[^\d]\d{1,4}/);
  });

  test('redelivering the same MessageID is an idempotent no-op', async ({ page }) => {
    const email = inboundEmail('redelivery');

    const first = await ingest(page.request, email);
    expect(first.created).toBe(true);

    // Postmark redelivers anything that didn't answer 200 up to ten times, and
    // with no queue in the system those retries *are* the durability layer. So
    // a repeat must answer 200 (anything else invites yet another redelivery),
    // point at the ticket that already exists, and not duplicate it. A changed
    // body under the same id is still the same email.
    const second = await ingest(page.request, { ...email, TextBody: 'Redelivered copy.' });
    expect(second.created).toBe(false);
    expect(second.ticketId).toBe(first.ticketId);

    await loginAsAdmin(page);
    await gotoTickets(page);

    // Scoped to this run's own subject, never to the table's total row count.
    await expect(ticketRow(page, text(email.Subject))).toHaveCount(1);
  });

  test('a request with no credentials is forbidden and creates no ticket', async ({ page }) => {
    const email = inboundEmail('no-auth');

    const response = await postInbound(page.request, email, null);
    // 403, not 401: a 403 stops Postmark retrying, and wrong credentials will
    // never become right on a retry.
    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden' });

    await loginAsAdmin(page);
    await expectTicketNotListed(page, text(email.Subject));
  });

  test('a request with wrong credentials is forbidden and creates no ticket', async ({ page }) => {
    const email = inboundEmail('bad-auth');

    const response = await postInbound(page.request, email, WRONG_AUTH_HEADER);
    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden' });

    await loginAsAdmin(page);
    await expectTicketNotListed(page, text(email.Subject));
  });
});

test.describe('inbound email validation', () => {
  test('a payload without MessageID is rejected and creates no ticket', async ({ page }) => {
    const { MessageID: _omitted, ...email } = inboundEmail('no-message-id');

    const response = await postInbound(page.request, email);
    // 422 rather than 403, so Postmark retries and then surfaces it as an
    // Inbound Error: an unparseable payload is a bug to fix, and the message
    // stays replayable from their dashboard. The message text is what shows up
    // there, so it's asserted verbatim.
    expect(response.status()).toBe(422);
    expect(await response.json()).toEqual({ error: 'MessageID is required' });

    await loginAsAdmin(page);
    await expectTicketNotListed(page, text(email.Subject));
  });

  test('a payload with an unusable From address is rejected and creates no ticket', async ({
    page,
  }) => {
    const email = inboundEmail('bad-from', { From: 'not-an-email' });

    const response = await postInbound(page.request, email);
    expect(response.status()).toBe(422);
    expect(await response.json()).toEqual({ error: 'From must be a valid email address' });

    await loginAsAdmin(page);
    await expectTicketNotListed(page, text(email.Subject));
  });
});

test.describe('inbound email normalization', () => {
  test('FromFull wins over the raw From header, lowercased', async ({ page }) => {
    const email = inboundEmail('fromfull');
    const parsedAddress = `E2E-Parsed-${Date.now()}@Example.COM`;

    await ingest(page.request, {
      ...email,
      FromFull: { Email: parsedAddress, Name: 'Parsed Name' },
    });

    await loginAsAdmin(page);
    await gotoTickets(page);

    const row = ticketRow(page, text(email.Subject));
    await expect(
      row.getByRole('cell', {
        name: `Parsed Name <${parsedAddress.toLowerCase()}>`,
        exact: true,
      }),
    ).toBeVisible();
    // `FromFull` beat the raw header on both the address and the display name.
    await expect(row).not.toContainText(text(email.From));
    await expect(row).not.toContainText(text(email.FromName));
  });

  test('a sender with no display name shows the bare address', async ({ page }) => {
    const { FromName: _omitted, ...email } = inboundEmail('no-name');

    await ingest(page.request, email);

    await loginAsAdmin(page);
    await gotoTickets(page);

    await expect(
      ticketRow(page, text(email.Subject)).getByRole('cell', {
        name: text(email.From),
        exact: true,
      }),
    ).toBeVisible();
  });

  test('a blank subject falls back to (no subject)', async ({ page }) => {
    const email = inboundEmail('blank-subject', { Subject: '   ' });

    const { ticketId } = await ingest(page.request, email);

    await loginAsAgent(page);

    // The placeholder is shared by every subject-less ticket ever ingested, so
    // the stored value is checked by id rather than by searching for the text.
    const detail = await fetchTicket(page.request, ticketId);
    expect(detail.ticket.subject).toBe('(no subject)');

    // In the table, this run's own (unique) sender address locates the row.
    await gotoTickets(page);
    await expect(
      ticketRow(page, text(email.From)).getByRole('cell', { name: '(no subject)', exact: true }),
    ).toBeVisible();
  });

  test('an HTML-only email is stored and shown as plain text', async ({ page }) => {
    const email = inboundEmail('html-only', {
      // Dropped from the JSON body entirely, which is what makes this
      // HTML-only.
      TextBody: undefined,
      HtmlBody:
        '<html><body><p>Hello <b>there</b></p><script>alert(1)</script><style>p{color:red}</style><p>Line two</p></body></html>',
    });

    const { ticketId } = await ingest(page.request, email);

    await loginAsAdmin(page);

    // The table doesn't render a ticket body yet, so the conversion is asserted
    // where it is observable: the stored value the API serves. Tags are
    // stripped and `<script>`/`<style>` *content* is dropped, not unwrapped.
    const detail = await fetchTicket(page.request, ticketId);
    expect(detail.ticket.body).toBe('Hello there\nLine two');
    expect(detail.ticket.body).not.toContain('<');
    expect(detail.ticket.body).not.toContain('alert(1)');
    expect(detail.ticket.body).not.toContain('color:red');

    // And no provider markup leaks into the page either.
    await gotoTickets(page);
    await expect(ticketRow(page, text(email.Subject))).toBeVisible();
    await expect(page.getByText('alert(1)')).toHaveCount(0);
    await expect(page.getByText('<p>')).toHaveCount(0);
  });
});

test.describe('tickets access', () => {
  test('an agent can reach /tickets from the nav and read a ticket via the API', async ({
    page,
  }) => {
    const email = inboundEmail('agent-read');
    const { ticketId } = await ingest(page.request, email);

    // Working tickets is the agent role, so `/tickets` sits outside
    // `AdminRoute` and the API is guarded by `requireSession` rather than
    // `requireAdmin`: an agent must get the nav link, the page and the detail
    // payload, while `Users` stays admin-only.
    await loginAsAgent(page);
    await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);

    await page.getByRole('link', { name: 'Tickets' }).click();
    await expect(page).toHaveURL('/tickets');
    await expect(page.getByRole('heading', { name: 'Tickets' })).toBeVisible();
    await expect(ticketRow(page, text(email.Subject))).toBeVisible();

    const detail = await fetchTicket(page.request, ticketId);
    expect(detail.ticket.subject).toBe(email.Subject);
    expect(detail.ticket.body).toBe(email.TextBody);
    expect(detail.ticket.senderEmail).toBe(email.From);
    expect(detail.ticket.senderName).toBe(email.FromName);
    expect(detail.ticket.status).toBe('open');
    expect(detail.ticket.category).toBeNull();
    // Nothing writes replies yet: the field is present and empty, not missing.
    expect(detail.ticket.replies).toEqual([]);
  });

  test('an unauthenticated visit to /tickets redirects to /login', async ({ page }) => {
    await page.goto('/tickets');
    await expect(page).toHaveURL('/login');
  });

  test('GET /api/tickets without a session is unauthorized', async ({ request }) => {
    // The `request` fixture carries its own cookie jar, so this is genuinely
    // session-less even though every other test here signs in.
    const response = await request.get('/api/tickets');
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  test('GET /api/tickets/:id without a session is unauthorized', async ({ request }) => {
    const response = await request.get(`/api/tickets/${UNKNOWN_TICKET_ID}`);
    // 401 before 404: an unknown id must not be distinguishable from a known
    // one without a session.
    expect(response.status()).toBe(401);
  });

  test('GET /api/tickets/:id for an unknown id is not found', async ({ page }) => {
    await loginAsAgent(page);

    const response = await page.request.get(`/api/tickets/${UNKNOWN_TICKET_ID}`);
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: 'Ticket not found' });
  });

  test('a reply carrying In-Reply-To lands on the original ticket, not a new one', async ({
    page,
  }) => {
    const original = inboundEmail('thread-root');
    // Per-run unique header values, for the same reason as `MessageID`.
    const rootId = `root-${original.MessageID}`;
    original.Headers = [{ Name: 'Message-ID', Value: `<${rootId}>` }];
    const first = await ingest(page.request, original);

    const reply = inboundEmail('thread-reply', {
      Subject: `Re: ${text(original.Subject)}`,
      TextBody: 'Full body\n\n> quoted history',
      StrippedTextReply: 'Just the new part',
      Headers: [
        { Name: 'Message-ID', Value: `<reply-${original.MessageID}>` },
        { Name: 'In-Reply-To', Value: `<${rootId}>` },
        { Name: 'References', Value: `<${rootId}>` },
      ],
    });
    const second = (await (await postInbound(page.request, reply)).json()) as InboundResponse;

    expect(second.ticketId).toBe(first.ticketId);
    expect(second.created).toBe(true);

    // Redelivery of the reply is a no-op, not a second reply.
    const again = await ingest(page.request, reply);
    expect(again.created).toBe(false);

    await loginAsAgent(page);
    const detail = await fetchTicket(page.request, first.ticketId);
    expect(detail.ticket.replies).toHaveLength(1);
    expect(detail.ticket.replies[0]).toMatchObject({
      senderType: 'customer',
      body: 'Just the new part',
    });
  });

  test('a reply to a reply stays on the same ticket', async ({ page }) => {
    const original = inboundEmail('thread-chain');
    const rootId = `root-${original.MessageID}`;
    original.Headers = [{ Name: 'Message-ID', Value: `<${rootId}>` }];
    const first = await ingest(page.request, original);

    const replyOneId = `r1-${original.MessageID}`;
    await ingest(
      page.request,
      inboundEmail('thread-chain-1', {
        Headers: [
          { Name: 'Message-ID', Value: `<${replyOneId}>` },
          { Name: 'In-Reply-To', Value: `<${rootId}>` },
        ],
      }),
    );

    // Only references the first *reply*, which has its own Message-ID.
    const third = await ingest(
      page.request,
      inboundEmail('thread-chain-2', {
        Headers: [
          { Name: 'Message-ID', Value: `<r2-${original.MessageID}>` },
          { Name: 'In-Reply-To', Value: `<${replyOneId}>` },
        ],
      }),
    );
    expect(third.ticketId).toBe(first.ticketId);

    await loginAsAgent(page);
    const detail = await fetchTicket(page.request, first.ticketId);
    expect(detail.ticket.replies).toHaveLength(2);
  });

  test('an In-Reply-To pointing at an unknown message opens a new ticket', async ({ page }) => {
    const orphan = inboundEmail('thread-orphan', {
      Headers: [{ Name: 'In-Reply-To', Value: '<nobody-has-seen-this@nowhere.e2e>' }],
    });
    const result = await ingest(page.request, orphan);
    expect(result.created).toBe(true);

    await loginAsAgent(page);
    const detail = await fetchTicket(page.request, result.ticketId);
    expect(detail.ticket.subject).toBe(orphan.Subject);
    expect(detail.ticket.replies).toEqual([]);
  });
});
