import { betterAuth } from "better-auth";
import { authConfig } from "../src/auth.ts";
import { prisma } from "../src/db.ts";
import { E2E_USERS } from "../../e2e/fixtures/test-users.ts";

// Seeds the fixed agent/admin accounts Playwright's auth spec logs in as.
// Run via `bun run --cwd server db:seed:test` against `helpdesk_test`, which
// is never reset between e2e runs — so this must be idempotent rather than
// assuming a clean database: it looks each user up by email first and only
// creates or corrects what's missing, instead of always inserting.
//
// Sign-up is disabled on the main `auth` instance, so — like
// `prisma/seed.ts` — this spins up a one-off instance with it re-enabled to
// reuse Better Auth's own password hashing and user/account creation rather
// than duplicating it.
const seedAuth = betterAuth({
  ...authConfig,
  emailAndPassword: {
    ...authConfig.emailAndPassword,
    disableSignUp: false,
    minPasswordLength: 6,
  },
});

for (const { email, password, name, role } of Object.values(E2E_USERS)) {
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.role !== role) {
      await prisma.user.update({ where: { id: existing.id }, data: { role } });
      console.log(`Updated role for e2e test user ${email} -> ${role}`);
    } else {
      console.log(`E2E test user ${email} already exists, skipping.`);
    }
    continue;
  }

  const { user } = await seedAuth.api.signUpEmail({ body: { email, password, name } });
  await prisma.user.update({ where: { id: user.id }, data: { role } });
  await prisma.session.deleteMany({ where: { userId: user.id } });

  console.log(`Created e2e test user ${email} (${role})`);
}

await prisma.$disconnect();
