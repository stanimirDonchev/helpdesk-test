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
`server/.env` holds `DATABASE_URL`; copy from `server/.env.example` if missing. A second database, `helpdesk_test`, also lives on this container for Playwright e2e runs — see the `e2e-test-writer` subagent for setup/details.

**Tests:**
```
bun run --cwd client test              # vitest run (unit/component)
bun run --cwd client test:watch        # vitest watch mode
bun run --cwd client test -- App.test.tsx   # single file
bun run test:e2e                       # playwright, from root — isolated test DB + dedicated ports, safe alongside a live dev session; opens an HTML report when done
bun run test:e2e:ui                    # same isolated setup, but opens Playwright's interactive UI mode instead of running headless
```
For writing or modifying Playwright e2e tests (`e2e/tests/`), use the `e2e-test-writer` subagent — it owns the full e2e infrastructure detail (isolated test DB, dedicated ports, auth/rate-limit setup, seeded test users).

**Build/lint:**
```
bun run --cwd client build   # tsc -b && vite build
bun run --cwd client lint    # oxlint
```

No root-level aggregate build/lint/test scripts exist yet — run workspace scripts with `--cwd <workspace>`, or `cd` into it.

## Architecture

**Workspace layout**: `client` (React 19 + Vite + TS) and `server` (Express 5 on the Bun runtime) are independent apps that share types through the `shared` workspace, imported as `shared/<file>` via the `workspace:*` protocol — not published, just a source-level TS package both sides resolve directly. Add new cross-cutting types there rather than duplicating them.

**Shared zod schemas**: when a `zod` schema validates the same shape on both sides of a request (client-side form validation *and* server-side request validation, e.g. creating a resource), define it once in `shared` rather than duplicating it per workspace — see `shared/src/user-validation.ts`'s `createUserSchema`, imported as `shared/user-validation` by both `client/src/pages/CreateUserDialog.tsx` (via `zodResolver(createUserSchema)`) and `server/src/routes/users.ts` (via `createUserSchema.safeParse(req.body)`). `shared`'s `package.json` needs `zod` as a real (not dev) dependency for this to resolve — it didn't have any runtime dependencies before. Export the schema's inferred type too (`z.infer<typeof schema>`) when a consumer needs it (e.g. `CreateUserFormValues` for `useForm`), instead of re-deriving it locally.

**Server runtime**: `server` has no build step — `bun --watch src/index.ts` executes TypeScript directly. `server/tsconfig.json` has `noEmit: true` accordingly; it's used for type-checking only (`bunx tsc --noEmit`).

**Express 5 error handling**: async route handlers don't need a `try/catch` just to forward a rejected promise — Express 5 awaits handler promises natively and calls `next(err)` on rejection automatically, unlike Express 4. Only reach for `try/catch` inside a route when you need to inspect/transform a specific error there and then; prefer a shared `ErrorRequestHandler` (4-arg `app.use`, registered after the routes it covers) for turning a known error shape into a response, so the logic isn't duplicated per route. See `server/src/index.ts`'s `handleDuplicateEmail` for the pattern (it maps Better Auth's duplicate-email `APIError` from `POST /api/users` to a 409 without the route itself catching anything).

**Prisma (v7, driver-adapter pattern)**: the schema (`server/prisma/schema.prisma`) declares `provider = "prisma-client"` with `output = "../src/generated/prisma"` — the generated client is checked into `.gitignore`, not source control. Config (schema path, migrations path, `DATABASE_URL`) lives in `server/prisma.config.ts`, loaded via `dotenv/config` since the Prisma CLI runs outside Bun's automatic env loading. `server/src/db.ts` wires the generated client to Postgres through `@prisma/adapter-pg` (`PrismaPg`) rather than the classic `prisma-client-js` engine — this is required for the `prisma-client` generator target.

**Postgres image**: `docker-compose.yml` uses `pgvector/pgvector:pg16`, not plain `postgres`, so the `vector` extension is available once the knowledge-base/RAG work (Phase 5) needs it — nothing currently depends on it.

**Auth (Better Auth)**: `server/src/auth.ts` configures Better Auth with the Prisma adapter (`prismaAdapter(prisma, { provider: "postgresql" })`) and email/password sign-in with `disableSignUp: true`. Rate limiting (`rateLimit: { enabled: ... }`) is on in every environment by default, not just production — deliberately, since the fixed/small account set makes login a brute-force target everywhere; `DISABLE_RATE_LIMIT=true` is a test-only escape hatch (see the `e2e-test-writer` subagent for how/where it's used) — there is no public registration; accounts are provisioned only by seeding (`bun run --cwd server db:seed`, requires `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `server/.env`; see `server/prisma/seed.ts`, which spins up a one-off Better Auth instance with sign-up re-enabled just to reuse its password hashing/user creation). A `role` field (`"admin" | "agent"`) is added to the `User` model via Better Auth's `user.additionalFields`, defaulting new users to `agent`. The `UserRole` const/type itself lives in `shared/src/user-types.ts` (imported as `shared/user-types`), not in `auth.ts` — `server/src/auth.ts` imports and re-exports it so existing server imports (`server/prisma/seed.ts`) keep working, and the client imports it directly for role checks. `server/src/index.ts` mounts the auth handler at `app.all("/api/auth/*splat", toNodeHandler(auth))` — this must stay registered *before* `express.json()`. The client (`:5173`) and server (`:3001`) are different origins in dev, so `server/.env`'s `TRUSTED_ORIGINS` must include the client origin or Better Auth rejects cookie-bearing requests. On the client, `client/src/lib/auth-client.ts` (`createAuthClient` from `better-auth/react`) is the only auth entrypoint — use `authClient.useSession()` / `authClient.signIn.email()` / `authClient.signOut()` rather than calling `/api/auth/*` directly. It registers the `inferAdditionalFields` plugin (`better-auth/client/plugins`, manually declaring `role: { type: "string" }`) so `session.user.role` is typed — since client and server are separate workspaces, this can't use the `inferAdditionalFields<typeof auth>()` monorepo shortcut, which would pull server code into the client bundle. `client/src/components/ProtectedRoute.tsx` gates routes on `authClient.useSession()` (any signed-in user); `client/src/components/AdminRoute.tsx` additionally gates on `session.user.role === UserRole.admin`, redirecting non-admins to `/`, and is meant to nest *inside* `ProtectedRoute` (so a session is already guaranteed resolved/non-null by the time it checks the role) — see the `/users` route in `client/src/App.tsx` for the pattern.

**Client dev proxy**: `client/vite.config.ts` proxies `/api/*` to `localhost:3001` in dev, so client code fetches same-origin paths (`axios.get('/api/health')`) rather than a hardcoded server URL. Production API base URL (when client and server aren't co-located) is meant to go through `VITE_API_BASE_URL` (see `client/.env.example`) — not yet wired into any requests.

**Data fetching (axios + TanStack Query)**: all calls to `/api/*` from the client — reads and writes alike — go through `axios` wrapped in `@tanstack/react-query`, not raw `fetch`/`useEffect`/`useState` and not a bare `axios` call in an event handler. Reads use `useQuery` (a `queryFn` that calls `axios.get<ResponseType>(url).then((res) => res.data...)`, branching on `isPending`/`isError` — see `client/src/pages/HomePage.tsx` / `UsersPage.tsx`). Writes use `useMutation` (a `mutationFn` that calls `axios.post<ResponseType>(url, values).then((res) => res.data...)`, with `onSuccess: () => queryClient.invalidateQueries({ queryKey: [...] })` to refresh the affected query rather than manually patching cached data — see `client/src/pages/CreateUserDialog.tsx`'s `createUser` mutation, invalidating the `['users']` query key that `UsersPage.tsx`'s `useQuery` reads). Don't wrap `mutateAsync`/`mutate` in a manual `try/catch` — `useMutation` already has `onSuccess`/`onError` callbacks for exactly this, so success side effects (invalidate queries, reset the form, close a dialog) go in `onSuccess` and error handling (e.g. extracting a message from an Axios error response to show inline) goes in `onError`. Call the fire-and-forget `mutate(values)` from the form's submit handler rather than `await mutateAsync(values)`, and drive the submit button's pending/disabled state off the mutation's own `isPending`, not react-hook-form's `formState.isSubmitting` (which only tracks a promise actually returned by/awaited in `onSubmit`, so it goes stale once `onSubmit` stops awaiting the mutation). `App.tsx` creates a single `QueryClient` and wraps the router in `QueryClientProvider` at the app root — reuse that provider (via `useQueryClient()`) rather than creating another one. Component tests render pages through `client/src/test/render-with-query.tsx`'s `renderWithQueryClient` helper (a fresh `QueryClient` per test with `retry: false`) and mock `axios` via `vi.mock('axios')` / `vi.mocked(axios.get)` / `vi.mocked(axios.post)`, rather than stubbing global `fetch`.

This is a client-only convention — `server` is a stateless Express API and doesn't itself call external endpoints today; TanStack Query is a React data/cache layer bound to `QueryClientProvider` and component render cycles, so it has no equivalent role on the server side. If `server` ever needs to call a third-party API, that's a plain `axios`/`fetch` call (with whatever retry/caching approach fits then), not TanStack Query.

**Forms (react-hook-form + zod)**: forms are built with `react-hook-form`'s `useForm` + `@hookform/resolvers/zod`'s `zodResolver`, validated against a `zod` schema (`z.object({...})`, with per-field messages via `{ error: '...' }`, and the form's type inferred via `z.infer<typeof schema>`) rather than hand-rolled `useState`/manual validation — see `client/src/pages/LoginPage.tsx` and `client/src/pages/CreateUserDialog.tsx`. Convention: `<form noValidate onSubmit={handleSubmit(onSubmit)}>`, each field wrapped in `<div className="flex flex-col gap-1.5">` with `aria-invalid={errors.field ? 'true' : 'false'}` on the `Input` and an inline `<p role="alert" className="text-[0.8125rem] text-destructive">{errors.field.message}</p>` beneath it, and the submit `Button` disabled via `formState.isSubmitting`. A top-level `formError` state + `role="alert"` paragraph (styled `bg-destructive/10 text-destructive`) surfaces server/request-level failures (e.g. a 409) that aren't per-field.

**Styling (Tailwind v4 + shadcn/ui)**: Tailwind runs via the `@tailwindcss/vite` plugin — there is no `tailwind.config.js`; theme tokens (colors, radii, fonts) live as CSS custom properties directly in `client/src/index.css` (`@theme inline`, `:root`, `.dark`). shadcn/ui is installed on **Base UI**, not Radix (`components.json`: `"style": "base-nova"`) — this was an explicit choice (Base UI is the CLI's own recommended default; Radix is the older/classic option), so generated components import from `@base-ui/react/*`, and any shadcn examples or snippets you reach for should be Base UI-flavored, not Radix. `client/vite.config.ts` (`resolve.alias`) and `client/tsconfig.json`/`tsconfig.app.json` (`compilerOptions.paths`) both define a `@/*` → `client/src/*` alias — the shadcn CLI's `init` does not wire the Vite side of this itself, so it had to be added by hand; use `@/components/ui/...`, `@/lib/utils`, etc. for shadcn files rather than relative imports. Add components with `bunx shadcn@latest add <component>` from `client/` (reuses `components.json`, won't re-prompt). Favor the theme tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-destructive/10 text-destructive`, …) over hardcoded Tailwind colors like `gray-500`/`red-600` so components track light/dark theming consistently — this applies to hand-written JSX as much as generated `ui/` components.

**Testing setup**: Vitest config lives inside `client/vite.config.ts` (`test` block), not a separate file. `@testing-library/jest-dom` must be imported via its `/vitest` subpath (`client/src/test/setup.ts`) — the plain import doesn't auto-extend Vitest's `expect`. Playwright config is at the repo root (not inside `client`) since its tests drive both `client` and `server` together — see the `e2e-test-writer` subagent for how it's wired (isolated test DB, dedicated ports, auth escape hatch).

**Writing component tests**: tests are co-located next to what they cover as `*.test.tsx` (e.g. `client/src/pages/UsersPage.tsx` → `UsersPage.test.tsx`), using Vitest + `@testing-library/react`. Run the whole suite with `bun run --cwd client test` (or `test:watch` for watch mode while writing), or a single file with `bun run --cwd client test -- UsersPage.test.tsx`. Prefer user-facing queries (`screen.getByRole`, `getByText`, `findByText` for async content) over test IDs or implementation details.

`client/vite.config.ts`'s `test` block sets `mockReset: true`, so every `vi.fn()`/`vi.mock()` mock is automatically reset (calls *and* implementations cleared) before each test, project-wide — don't add a manual `afterEach(() => vi.clearAllMocks())`/`resetAllMocks()`, it's redundant. Any mock behavior a test needs (`mockResolvedValue`, `mockReturnValue`, etc.) must be (re-)set inside that test, or in a `beforeEach` if every test in the file needs the same default (see `LoginPage.test.tsx`'s `beforeEach` for that pattern).

Two established mocking patterns, pick based on what the component under test uses:
- **Data-fetching pages** (`axios` + TanStack Query, per the Data fetching section above): `vi.mock('axios')` at the top of the file, then `vi.mocked(axios.get).mockResolvedValue({ data: ... })` / `mockRejectedValue(...)` / `mockReturnValue(new Promise(() => {}))` (never-resolving, for asserting a pending/loading state) per test. Render through `client/src/test/render-with-query.tsx`'s `renderWithQueryClient` helper, not plain `render`, so the component has a real (but `retry: false`) `QueryClientProvider` in its tree — see `HomePage.test.tsx` / `UsersPage.test.tsx`.
- **Components that read auth session state** (`NavBar`, `LoginPage`, anything using `authClient`): mock the module directly with `vi.mock('../lib/auth-client', () => ({ authClient: { useSession: useSessionMock, ... } }))`, declaring the mock functions via `vi.hoisted(() => ({ useSessionMock: vi.fn(), ... }))` above the `vi.mock` call so they exist before Vitest hoists it — see `NavBar.test.tsx` / `LoginPage.test.tsx`.
