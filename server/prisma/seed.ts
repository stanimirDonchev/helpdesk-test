import { createSignUpAuth, UserRole } from "../src/auth.ts";
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
  const seedAuth = createSignUpAuth({ minPasswordLength: 6 });

  const { user } = await seedAuth.api.signUpEmail({
    body: { email: adminEmail, password: adminPassword, name: "Admin" },
  });

  await prisma.user.update({ where: { id: user.id }, data: { role: UserRole.admin } });
  await prisma.session.deleteMany({ where: { userId: user.id } });

  console.log(`Created admin user ${adminEmail}`);
}

await prisma.$disconnect();
