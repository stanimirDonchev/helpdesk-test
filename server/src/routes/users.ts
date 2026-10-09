import { isAPIError } from "better-auth/api";
import { Router, type ErrorRequestHandler } from "express";
import type {
  CreateUserResponse,
  DeleteUserResponse,
  UpdateUserResponse,
  UsersListResponse,
} from "shared/api-types";
import { createUserSchema, updateUserSchema } from "shared/user-validation";
import type { UserRole } from "shared/user-types";
import { auth, createSignUpAuth } from "../auth.ts";
import { prisma } from "../db.ts";
import { Prisma } from "../generated/prisma/client.js";
import { requireAdmin } from "../middleware/require-admin.ts";

export const usersRouter: Router = Router();

usersRouter.get("/", requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
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

usersRouter.patch<{ id: string }>("/:id", requireAdmin, async (req, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
    return;
  }

  const { id } = req.params;
  const existing = await prisma.user.findUnique({
    where: { id },
    select: { deletedAt: true },
  });
  // A soft-deleted user is gone as far as this API is concerned, so editing one
  // is a 404 rather than a silent write to a row nothing can see.
  if (!existing || existing.deletedAt) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const ctx = await auth.$context;

  if (parsed.data.password) {
    // Sign-in only ever consults the `credential` account row, so a user
    // without one has no password to change -- bail before writing anything.
    const credential = await ctx.internalAdapter.findCredentialAccount(id);
    if (!credential) {
      res.status(409).json({ error: "This user has no password sign-in to update" });
      return;
    }
  }

  // Hash before any write, so a hashing failure can't leave name/email applied
  // against a stale password. `ctx.password.hash` is the hasher this instance is
  // actually configured with, so sign-in verifies against it.
  const passwordHash = parsed.data.password ? await ctx.password.hash(parsed.data.password) : null;

  // Only validated fields are written -- zod strips unknown keys, so a client
  // that posts `role` can't escalate anyone. The email is already lowercased by
  // the schema, matching how Better Auth stores and looks up emails.
  // `emailVerified` is deliberately left alone: no email verification flow is
  // configured in this app, so resetting it would be dead ceremony.
  const user = await prisma.user.update({
    where: { id },
    data: { name: parsed.data.name, email: parsed.data.email },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  if (passwordHash) {
    // Better Auth's own internal adapter rather than a direct
    // `prisma.account.updateMany`, so the providerId/accountId convention for
    // credential accounts stays Better Auth's business.
    await ctx.internalAdapter.updatePassword(id, passwordHash);

    // Rotating the credential should invalidate sessions established with the
    // old one -- except the acting admin's own, so changing your own password
    // doesn't sign you out mid-request. `req.session` is always set here;
    // `requireAdmin` assigns it before calling next(). The non-null assertion
    // matters: Prisma reads `{ not: undefined }` as *no filter*, which would
    // delete the acting admin's session too.
    await prisma.session.deleteMany({
      where: { userId: id, id: { not: req.session!.session.id } },
    });
  }

  const body: UpdateUserResponse = {
    user: { ...user, role: user.role as UserRole, createdAt: user.createdAt.toISOString() },
  };
  res.json(body);
});

usersRouter.delete<{ id: string }>("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;

  // Deleting yourself would revoke your own sessions and sign you out of the
  // only role that can undo it, so it's refused outright. Other admins can be
  // deleted -- the guard is about self-lockout, not about protecting the role.
  if (id === req.session!.user.id) {
    res.status(403).json({ error: "You cannot delete your own account" });
    return;
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, createdAt: true, deletedAt: true },
  });
  // Already-deleted counts as absent, which also makes a double submit a no-op
  // rather than quietly refreshing `deletedAt`.
  if (!existing || existing.deletedAt) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Set the flag *before* revoking sessions: from this moment the
  // `session.create.before` hook in `src/auth.ts` refuses to mint a new
  // session for this user, so a sign-in racing the revoke below can't slip
  // through and hand them a fresh session.
  await prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
  await prisma.session.deleteMany({ where: { userId: id } });

  const { deletedAt: _deletedAt, ...user } = existing;
  const body: DeleteUserResponse = {
    user: { ...user, role: user.role as UserRole, createdAt: user.createdAt.toISOString() },
  };
  res.json(body);
});

// Express 5 forwards a rejected promise from the route handler above here
// automatically, so it doesn't need its own try/catch to reach this. Scoped
// to this router, so it only intercepts errors from these user routes.
const handleDuplicateEmail: ErrorRequestHandler = (error, _req, res, next) => {
  const isBetterAuthDuplicate =
    isAPIError(error) && DUPLICATE_EMAIL_CODES.includes(error.body?.code as string);
  // PATCH writes the email through Prisma rather than Better Auth, so a
  // collision surfaces as the DB's own unique-constraint violation instead of
  // an APIError. `user.email` is the only unique index these routes touch.
  const isPrismaDuplicate =
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

  if (isBetterAuthDuplicate || isPrismaDuplicate) {
    res.status(409).json({ error: "A user with this email already exists" });
    return;
  }
  next(error);
};
usersRouter.use(handleDuplicateEmail);
