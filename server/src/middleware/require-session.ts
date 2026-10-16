import { fromNodeHeaders } from "better-auth/node";
import type { RequestHandler } from "express";
import { auth } from "../auth.ts";
// Importing the type (rather than redeclaring it) keeps the `Express.Request`
// global augmentation in `require-admin.ts` as the single declaration.
import type { Session } from "./require-admin.ts";

/**
 * Any signed-in user, agent or admin. `requireAdmin` is the stricter variant;
 * tickets are deliberately visible to agents, since working them is the whole
 * point of the agent role.
 */
export const requireSession: RequestHandler = async (req, res, next) => {
  const session: Session | null = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.session = session;
  next();
};
