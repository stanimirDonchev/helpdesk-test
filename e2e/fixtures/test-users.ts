// Fixed credentials for the e2e test users. Seeded idempotently into
// `helpdesk_test` by `server/prisma/seed-e2e.ts` (run via `bun run
// db:seed:test` as part of the root `test:e2e` pipeline, before Playwright
// starts) and logged in as by `e2e/tests/auth.spec.ts`. Kept here as the
// single source of truth so the seed script and the specs that log in can't
// drift out of sync.
export const E2E_USERS = {
  agent: {
    email: 'e2e-agent@helpdesk.test',
    password: 'e2e-Test-Passw0rd!',
    name: 'E2E Agent',
    role: 'agent',
  },
  admin: {
    email: 'e2e-admin@helpdesk.test',
    password: 'e2e-Test-Passw0rd!',
    name: 'E2E Admin',
    role: 'admin',
  },
} as const;
