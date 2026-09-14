import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db.ts";

export const UserRole = {
  admin: "admin",
  agent: "agent",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const authConfig = {
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: true },
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
