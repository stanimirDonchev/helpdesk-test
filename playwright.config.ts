import { defineConfig, devices } from '@playwright/test';
import { INBOUND_WEBHOOK } from './e2e/fixtures/inbound-webhook';

const E2E_SERVER_PORT = 3002;
const E2E_CLIENT_PORT = 5174;
const E2E_DATABASE_URL = 'postgresql://helpdesk:helpdesk@localhost:5432/helpdesk_test';

export default defineConfig({
  testDir: 'e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'always' }]],
  use: {
    baseURL: `http://localhost:${E2E_CLIENT_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'bun run dev:server',
      url: `http://localhost:${E2E_SERVER_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 120 * 1000,
      env: {
        PORT: String(E2E_SERVER_PORT),
        DATABASE_URL: E2E_DATABASE_URL,
        BETTER_AUTH_URL: `http://localhost:${E2E_SERVER_PORT}`,
        TRUSTED_ORIGINS: `http://localhost:${E2E_CLIENT_PORT}`,
        DISABLE_RATE_LIMIT: 'true',
        // The inbound-email endpoint fails closed without these, so the
        // webhook specs would get a 503 instead of exercising the route. Shared
        // with `inbound-email.spec.ts` via the fixture so both sides agree.
        INBOUND_WEBHOOK_USER: INBOUND_WEBHOOK.user,
        INBOUND_WEBHOOK_PASSWORD: INBOUND_WEBHOOK.password,
      },
    },
    {
      command: 'bun run dev:client',
      url: `http://localhost:${E2E_CLIENT_PORT}`,
      reuseExistingServer: false,
      timeout: 120 * 1000,
      env: {
        CLIENT_PORT: String(E2E_CLIENT_PORT),
        API_PROXY_PORT: String(E2E_SERVER_PORT),
      },
    },
  ],
});
