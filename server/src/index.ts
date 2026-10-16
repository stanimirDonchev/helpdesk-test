import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express, { type RequestHandler } from "express";
import { auth, authConfig } from "./auth.ts";
import { healthRouter } from "./routes/health.ts";
import { inboundEmailRouter } from "./routes/inbound-email.ts";
import { ticketsRouter } from "./routes/tickets.ts";
import { usersRouter } from "./routes/users.ts";

const app = express();
const port = process.env.PORT ?? 3001;

// Scoped to the same TRUSTED_ORIGINS Better Auth uses, rather than the
// cors() default of allowing every origin on every route.
app.use(cors({ origin: authConfig.trustedOrigins, credentials: true }));
app.all("/api/auth/*splat", toNodeHandler(auth) as unknown as RequestHandler);

// Mounted *before* express.json() on purpose: the inbound router brings its own
// parser with a raised body limit, and the global one below uses Express's
// 100kb default, which a real email with a quoted thread exceeds.
app.use("/api/inbound", inboundEmailRouter);

app.use(express.json());

app.use("/api/health", healthRouter);

app.use("/api/users", usersRouter);

app.use("/api/tickets", ticketsRouter);

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
