import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { UserRole } from "shared/user-types";
import { prisma } from "./db.ts";

export { UserRole };

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret.length < 32) {
  throw new Error(
    "BETTER_AUTH_SECRET must be set to a string of at least 32 characters (e.g. `openssl rand -base64 32`) — " +
      "it signs/encrypts session cookies, so a missing or weak value lets sessions be forged.",
  );
}

export const authConfig = {
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret,
  emailAndPassword: { enabled: true, disableSignUp: true },
  // Rate limiting defaults to disabled outside production; the account set here
  // is small and fixed (no public sign-up), so login is a brute-force target
  // in every environment, not just prod. DISABLE_RATE_LIMIT is an explicit,
  // narrowly-scoped escape hatch for e2e test runs only (set in
  // playwright.config.ts's webServer env) so repeated login attempts across
  // a test suite don't get throttled.
  rateLimit: { enabled: process.env.DISABLE_RATE_LIMIT !== "true" },
  // The Vite dev server (client) and this API run on different origins;
  // Better Auth rejects cookie-bearing requests from origins not listed here.
  trustedOrigins: (process.env.TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  user: {
    additionalFields: {
      role: {
        type: Object.values(UserRole),
        required: true,
        defaultValue: UserRole.agent,
        input: false,
      },
    },
  },
} satisfies BetterAuthOptions;

export const auth = betterAuth(authConfig);
