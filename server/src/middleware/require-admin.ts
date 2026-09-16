import { fromNodeHeaders } from "better-auth/node";
import type { RequestHandler } from "express";
import { UserRole } from "shared/user-types";
import { auth } from "../auth.ts";

type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

declare global {
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}

export const requireAdmin: RequestHandler = async (req, res, next) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });

  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (session.user.role !== UserRole.admin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  req.session = session;
  next();
};
