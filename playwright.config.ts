import { defineConfig, devices } from '@playwright/test';

const E2E_SERVER_PORT = 3002;
const E2E_CLIENT_PORT = 5174;
const E2E_DATABASE_URL = 'postgresql://helpdesk:helpdesk@localhost:5432/helpdesk_test';

export default defineConfig({
  testDir: 'e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
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
