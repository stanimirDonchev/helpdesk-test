# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

This is an AI-powered ticket management system, currently in early scaffolding (Phase 0 of the implementation plan — no product features are built yet, only the dev environment). Before making product decisions, read these in order:

- `project-scope.md` — problem, features, ticket statuses/categories, user roles, and the specific decisions already made about email ingestion, AI reply autonomy, routing, and the knowledge base
- `tech-stack.md` — the chosen stack per layer, plus open decisions not yet made (e.g. email provider)
- `implementation-plan.md` — phased task breakdown; check off/extend tasks here as work lands rather than inventing new structure

## Documentation lookups

This project pins fast-moving libraries (Prisma 7's driver-adapter API, Bun, Vite 8, Express 5). Before writing code against any external library's API, use the `context7` MCP tools (`resolve-library-id` then `query-docs`) to confirm current syntax rather than relying on training data — several APIs here (Prisma's `prisma.config.ts` + `@prisma/adapter-pg` pattern in particular) changed recently enough that stale knowledge will produce broken code.

## Commands

This is a Bun workspace monorepo (`client`, `server`, `shared`). Install once from the root:

```
bun install
```

**Dev servers** (from root):
```
bun run dev:server   # Express on :3001
bun run dev:client   # Vite on :5173, proxies /api -> :3001
```

**Database** — Postgres + pgvector run via Docker; start it before any `server` DB command:
```
docker compose up -d postgres
bun run --cwd server db:generate   # regenerate Prisma client after schema.prisma changes
bun run --cwd server db:migrate    # prisma migrate dev
```
`server/.env` holds `DATABASE_URL`; copy from `server/.env.example` if missing.

**Tests:**
```
bun run --cwd client test              # vitest run (unit/component)
bun run --cwd client test:watch        # vitest watch mode
bun run --cwd client test -- App.test.tsx   # single file
bun run test:e2e                       # playwright, from root — auto-starts both dev servers if not already running
```

**Build/lint:**
```
bun run --cwd client build   # tsc -b && vite build
bun run --cwd client lint    # oxlint
```

No root-level aggregate build/lint/test scripts exist yet — run workspace scripts with `--cwd <workspace>`, or `cd` into it.

## Architecture

**Workspace layout**: `client` (React 19 + Vite + TS) and `server` (Express 5 on the Bun runtime) are independent apps that share types through the `shared` workspace, imported as `shared/<file>` via the `workspace:*` protocol — not published, just a source-level TS package both sides resolve directly. Add new cross-cutting types there rather than duplicating them.

**Server runtime**: `server` has no build step — `bun --watch src/index.ts` executes TypeScript directly. `server/tsconfig.json` has `noEmit: true` accordingly; it's used for type-checking only (`bunx tsc --noEmit`).

**Prisma (v7, driver-adapter pattern)**: the schema (`server/prisma/schema.prisma`) declares `provider = "prisma-client"` with `output = "../src/generated/prisma"` — the generated client is checked into `.gitignore`, not source control. Config (schema path, migrations path, `DATABASE_URL`) lives in `server/prisma.config.ts`, loaded via `dotenv/config` since the Prisma CLI runs outside Bun's automatic env loading. `server/src/db.ts` wires the generated client to Postgres through `@prisma/adapter-pg` (`PrismaPg`) rather than the classic `prisma-client-js` engine — this is required for the `prisma-client` generator target.

**Postgres image**: `docker-compose.yml` uses `pgvector/pgvector:pg16`, not plain `postgres`, so the `vector` extension is available once the knowledge-base/RAG work (Phase 5) needs it — nothing currently depends on it.

**Auth (Better Auth)**: `server/src/auth.ts` configures Better Auth with the Prisma adapter (`prismaAdapter(prisma, { provider: "postgresql" })`) and email/password sign-in with `disableSignUp: true` — there is no public registration; accounts are provisioned only by seeding (`bun run --cwd server db:seed`, requires `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `server/.env`; see `server/prisma/seed.ts`, which spins up a one-off Better Auth instance with sign-up re-enabled just to reuse its password hashing/user creation). A `role` field (`"admin" | "agent"`) is added to the `User` model via Better Auth's `user.additionalFields`, defaulting new users to `agent`. The `UserRole` const/type itself lives in `shared/src/user-types.ts` (imported as `shared/user-types`), not in `auth.ts` — `server/src/auth.ts` imports and re-exports it so existing server imports (`server/prisma/seed.ts`) keep working, and the client imports it directly for role checks. `server/src/index.ts` mounts the auth handler at `app.all("/api/auth/*splat", toNodeHandler(auth))` — this must stay registered *before* `express.json()`. The client (`:5173`) and server (`:3001`) are different origins in dev, so `server/.env`'s `TRUSTED_ORIGINS` must include the client origin or Better Auth rejects cookie-bearing requests. On the client, `client/src/lib/auth-client.ts` (`createAuthClient` from `better-auth/react`) is the only auth entrypoint — use `authClient.useSession()` / `authClient.signIn.email()` / `authClient.signOut()` rather than calling `/api/auth/*` directly. It registers the `inferAdditionalFields` plugin (`better-auth/client/plugins`, manually declaring `role: { type: "string" }`) so `session.user.role` is typed — since client and server are separate workspaces, this can't use the `inferAdditionalFields<typeof auth>()` monorepo shortcut, which would pull server code into the client bundle. `client/src/components/ProtectedRoute.tsx` gates routes on `authClient.useSession()` (any signed-in user); `client/src/components/AdminRoute.tsx` additionally gates on `session.user.role === UserRole.admin`, redirecting non-admins to `/`, and is meant to nest *inside* `ProtectedRoute` (so a session is already guaranteed resolved/non-null by the time it checks the role) — see the `/users` route in `client/src/App.tsx` for the pattern.

**Client dev proxy**: `client/vite.config.ts` proxies `/api/*` to `localhost:3001` in dev, so client code fetches same-origin paths (`fetch('/api/health')`) rather than a hardcoded server URL. Production API base URL (when client and server aren't co-located) is meant to go through `VITE_API_BASE_URL` (see `client/.env.example`) — not yet wired into any fetch calls.

**Styling (Tailwind v4 + shadcn/ui)**: Tailwind runs via the `@tailwindcss/vite` plugin — there is no `tailwind.config.js`; theme tokens (colors, radii, fonts) live as CSS custom properties directly in `client/src/index.css` (`@theme inline`, `:root`, `.dark`). shadcn/ui is installed on **Base UI**, not Radix (`components.json`: `"style": "base-nova"`) — this was an explicit choice (Base UI is the CLI's own recommended default; Radix is the older/classic option), so generated components import from `@base-ui/react/*`, and any shadcn examples or snippets you reach for should be Base UI-flavored, not Radix. `client/vite.config.ts` (`resolve.alias`) and `client/tsconfig.json`/`tsconfig.app.json` (`compilerOptions.paths`) both define a `@/*` → `client/src/*` alias — the shadcn CLI's `init` does not wire the Vite side of this itself, so it had to be added by hand; use `@/components/ui/...`, `@/lib/utils`, etc. for shadcn files rather than relative imports. Add components with `bunx shadcn@latest add <component>` from `client/` (reuses `components.json`, won't re-prompt). Favor the theme tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-destructive/10 text-destructive`, …) over hardcoded Tailwind colors like `gray-500`/`red-600` so components track light/dark theming consistently — this applies to hand-written JSX as much as generated `ui/` components.

**Testing setup**: Vitest config lives inside `client/vite.config.ts` (`test` block), not a separate file. `@testing-library/jest-dom` must be imported via its `/vitest` subpath (`client/src/test/setup.ts`) — the plain import doesn't auto-extend Vitest's `expect`. Playwright config is at the repo root (not inside `client`) since its tests drive both `client` and `server` together; `playwright.config.ts`'s `webServer` array boots both dev servers automatically and reuses already-running ones outside CI.
