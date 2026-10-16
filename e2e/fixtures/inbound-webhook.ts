// HTTP Basic credentials for `POST /api/inbound/postmark`. Postmark can't sign
// its webhooks, so these are the only thing in front of an endpoint that
// creates tickets — `requireWebhookAuth` answers 503 when they're unset, which
// would make every inbound spec fail on configuration rather than behaviour.
//
// Single source of truth, in the same spirit as `test-users.ts`: imported by
// `playwright.config.ts` (to hand them to the e2e server's env) and by
// `e2e/tests/inbound-email.spec.ts` (to send them), so the two can't drift.
// Test-only values; the real ones live in `server/.env`.
export const INBOUND_WEBHOOK = {
  user: 'inbound-test',
  password: 'inbound-test-secret',
} as const;

/** The `Authorization` header value the webhook accepts. */
export const INBOUND_WEBHOOK_AUTH_HEADER = `Basic ${Buffer.from(
  `${INBOUND_WEBHOOK.user}:${INBOUND_WEBHOOK.password}`,
).toString('base64')}`;
