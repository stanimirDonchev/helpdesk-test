import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express, { type RequestHandler } from "express";
import type { HealthResponse } from "shared/api-types";
import { auth, authConfig } from "./auth.ts";
import { prisma } from "./db.ts";

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

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
