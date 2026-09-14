import { betterAuth } from "better-auth";
import { authConfig, UserRole } from "../src/auth.ts";
import { prisma } from "../src/db.ts";

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed the admin user");
}

const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

if (existing) {
  console.log(`Admin user ${adminEmail} already exists, skipping.`);
} else {
  // Sign-up is disabled on the main `auth` instance, so seeding uses a
  // one-off instance with it re-enabled to reuse Better Auth's own
  // password hashing and user/account creation instead of duplicating it.
  const seedAuth = betterAuth({
    ...authConfig,
    emailAndPassword: {
      ...authConfig.emailAndPassword,
      disableSignUp: false,
      minPasswordLength: 6,
    },
  });

  const { user } = await seedAuth.api.signUpEmail({
    body: { email: adminEmail, password: adminPassword, name: "Admin" },
  });

  await prisma.user.update({ where: { id: user.id }, data: { role: UserRole.admin } });
  await prisma.session.deleteMany({ where: { userId: user.id } });

  console.log(`Created admin user ${adminEmail}`);
}

await prisma.$disconnect();
