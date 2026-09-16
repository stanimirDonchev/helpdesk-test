import { isAPIError } from "better-auth/api";
import { Router, type ErrorRequestHandler } from "express";
import type { CreateUserResponse, UsersListResponse } from "shared/api-types";
import { createUserSchema } from "shared/user-validation";
import type { UserRole } from "shared/user-types";
import { createSignUpAuth } from "../auth.ts";
import { prisma } from "../db.ts";
import { requireAdmin } from "../middleware/require-admin.ts";

export const usersRouter: Router = Router();

usersRouter.get("/", requireAdmin, async (_req, res) => {
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

// Better Auth's signUpEmail throws one of these two codes for a duplicate
// email depending on internal path taken; both mean the same thing here.
const DUPLICATE_EMAIL_CODES = ["USER_ALREADY_EXISTS", "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"];

usersRouter.post("/", requireAdmin, async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  const { user } = await createSignUpAuth().api.signUpEmail({ body: parsed.data });
  await prisma.session.deleteMany({ where: { userId: user.id } });

  const body: CreateUserResponse = {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      createdAt: user.createdAt.toISOString(),
    },
  };
  res.status(201).json(body);
});

// Express 5 forwards a rejected promise from the route handler above here
// automatically, so it doesn't need its own try/catch to reach this. Scoped
// to this router, so it only intercepts errors from these user routes.
const handleDuplicateEmail: ErrorRequestHandler = (error, _req, res, next) => {
  if (isAPIError(error) && DUPLICATE_EMAIL_CODES.includes(error.body?.code as string)) {
    res.status(409).json({ error: "A user with this email already exists" });
    return;
  }
  next(error);
};
usersRouter.use(handleDuplicateEmail);
