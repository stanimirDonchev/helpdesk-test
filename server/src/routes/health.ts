import { Router, type ErrorRequestHandler } from "express";
import type { HealthResponse } from "shared/api-types";
import { prisma } from "../db.ts";

export const healthRouter: Router = Router();

healthRouter.get("/", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  const body: HealthResponse = { status: "ok" };
  res.json(body);
});

// Express 5 forwards a rejected promise from the route handler above here
// automatically, so it doesn't need its own try/catch to reach this. Scoped
// to this router, so it only intercepts errors from the health check route.
const handleHealthCheckFailure: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error("Database health check failed:", error);
  const body: HealthResponse = { status: "error" };
  res.status(503).json(body);
};
healthRouter.use(handleHealthCheckFailure);
