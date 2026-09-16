import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express, { type RequestHandler } from "express";
import { auth, authConfig } from "./auth.ts";
import { healthRouter } from "./routes/health.ts";
import { usersRouter } from "./routes/users.ts";

const app = express();
const port = process.env.PORT ?? 3001;

// Scoped to the same TRUSTED_ORIGINS Better Auth uses, rather than the
// cors() default of allowing every origin on every route.
app.use(cors({ origin: authConfig.trustedOrigins, credentials: true }));
app.all("/api/auth/*splat", toNodeHandler(auth) as unknown as RequestHandler);
app.use(express.json());

app.use("/api/health", healthRouter);

app.use("/api/users", usersRouter);

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
