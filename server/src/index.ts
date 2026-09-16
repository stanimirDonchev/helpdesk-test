import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express, { type RequestHandler } from "express";
import type { HealthResponse, UsersListResponse } from "shared/api-types";
import type { UserRole } from "shared/user-types";
import { auth, authConfig } from "./auth.ts";
import { prisma } from "./db.ts";
import { requireAdmin } from "./middleware/require-admin.ts";

const app = express();
const port = process.env.PORT ?? 3001;

// Scoped to the same TRUSTED_ORIGINS Better Auth uses, rather than the
// cors() default of allowing every origin on every route.
app.use(cors({ origin: authConfig.trustedOrigins, credentials: true }));
app.all("/api/auth/*splat", toNodeHandler(auth) as unknown as RequestHandler);
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const body: HealthResponse = { status: "ok" };
    res.json(body);
  } catch (error) {
    console.error("Database health check failed:", error);
    const body: HealthResponse = { status: "error" };
    res.status(503).json(body);
  }
});

app.get("/api/users", requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { name: "asc" },
  });
  const body: UsersListResponse = {
    users: users.map((user) => ({
      ...user,
      role: user.role as UserRole,
      createdAt: user.createdAt.toISOString(),
    })),
  };
  res.json(body);
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
