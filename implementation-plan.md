# Implementation Plan

Reference: `project-scope.md`, `tech-stack.md`. Phases are meant to be built roughly in order — each one produces something runnable/demoable before moving to the next. Tasks within a phase are PR-sized.

## Phase 0 — Project scaffolding

- [x] Init Bun workspace monorepo (`client` / `server` / `shared`)
- [x] `shared` package: enums for ticket status, category, role, sender type — `role` in `shared/src/user-types.ts`, ticket status/category/sender type in `shared/src/ticket-types.ts` (plus display-label maps). All plain const objects rather than Zod schemas or Prisma enums, deliberately: the DB columns stay `String`. Zod lives per-shape in `shared/src/user-validation.ts` / `server/src/ingest/postmark-schema.ts` instead of one enum module
- [ ] Shared TS/ESLint/Prettier config across workspaces — not present: no shared/base `tsconfig`, no ESLint anywhere (client uses `oxlint` standalone instead, per CLAUDE.md), no Prettier config
- [x] Postgres + `pgvector` via docker-compose for local dev
- [x] Prisma init in `server`, connect to local Postgres
- [x] `.env.example` for client and server
- [x] Vitest + Testing Library wired up in `client` with a smoke test
- [x] Playwright skeleton (`e2e` workspace) with a trivial passing test

## Phase 1 — Auth & user management

- [ ] Prisma schema: `User` (role: admin/agent, active/deactivated) — `role` field is on the model; no `active`/`deactivated` field yet
- [x] Integrate better-auth (email/password) on the server
- [x] Seed script: create the initial Admin user
- [x] better-auth client + session hook on the frontend
- [x] Login page
- [x] `ProtectedRoute` / `AdminRoute` wrappers
- [ ] API: create/list/deactivate agent (admin-only) — not started; `server/src/index.ts` only has `/api/health` and the mounted auth handler
- [ ] UI: Users page (list, create-agent form, deactivate action) — `UsersPage.tsx` is currently just a heading placeholder
- [x] App shell: layout, nav, role-aware menu

## Phase 2 — Core ticket data & CRUD (no AI yet)

- [x] Prisma schema: `Ticket` (subject, body, status, category, sender email, `messageId`, `source`, timestamps) and `Reply` (ticket, senderType, body, createdAt) — migration `20261009071749_add_tickets`
- [ ] Migration + seed sample tickets/replies — migration done; no sample-data seed (tickets arrive via the webhook)
- [x] API: create ticket — landed as the real Postmark webhook (Phase 9) rather than an interim endpoint, so the staged interim path was skipped entirely
- [x] API: list tickets — `GET /api/tickets`, newest first. Filtering by status/category, sorting and pagination still open
- [x] API: get ticket detail (ticket + reply thread) — `GET /api/tickets/:id`; the thread is always empty until replies are written
- [ ] API: post reply, update ticket status
- [ ] UI: ticket list (table, filters, sorting) with TanStack Table/Query — read-only table shipped (`client/src/pages/TicketsTable.tsx`, TanStack Query); filters and sorting still open
- [ ] UI: ticket detail (thread view + reply form)
- [ ] UI: manual "new ticket" form — not needed: real inbound email works, so there is nothing to substitute for

## Phase 3 — Teams & routing

- [ ] Prisma schema: `Team`, agent↔team relation, `Ticket.assignedAgentId` / `assignedTeamId`
- [ ] Category → team mapping (config or table)
- [ ] Assignment strategy (start simple: least-open-tickets within the mapped team)
- [ ] Fallback behavior when no agent/team available (unassigned, surfaced on dashboard)
- [ ] UI: Team management (admin: create team, assign agents)
- [ ] UI: assignment display + manual reassignment on ticket detail

## Phase 4 — AI classification & summaries

- [ ] Server: Vercel AI SDK + `@ai-sdk/anthropic` client setup
- [ ] Classification pipeline (Zod-typed output: category + confidence)
- [ ] pg-boss worker process + job to classify on ticket creation
- [ ] Store `category`, `confidence`, `classifiedBy` on ticket
- [ ] AI thread-summary generation for ticket detail view
- [ ] Manual override: agent can re-classify a ticket
- [ ] UI: AI category badge + confidence indicator + override control

## Phase 5 — Knowledge base & retrieval

- [ ] Prisma schema: `KnowledgeArticle` (title, body, embedding vector via `pgvector`)
- [ ] Decide + implement authorship permissions (admin-only vs admin+agent)
- [ ] UI: KB management (create/edit/delete articles)
- [ ] Job: generate embedding via Voyage AI on article save
- [ ] Retrieval function: embed query, top-k similarity search

## Phase 6 — AI-suggested replies & tiered auto-send

- [ ] Reply-generation pipeline: KB context + ticket thread → Claude draft
- [ ] Store draft reply linked to ticket, marked AI-generated
- [ ] Tiered logic: General Question → auto-send job; Technical/Refund → pending agent review
- [ ] Audit trail: flag AI vs. agent-sent replies, log model/confidence used
- [ ] Outbound-send abstraction (stub/log for now — real provider deferred to Phase 9)
- [ ] UI: draft reply on ticket detail with edit / send / regenerate actions
- [ ] UI: visual indicator for auto-sent AI replies

## Phase 7 — Dashboard

- [ ] API: metrics endpoint (volume by status/category, avg resolution time, AI auto-resolve rate)
- [ ] UI: dashboard (stat tiles + charts via recharts)
- [ ] Admin-only access control

## Phase 8 — Hardening & polish

- [ ] Unit tests for server routes/libs
- [ ] Component tests for key UI pieces
- [ ] E2E tests: auth, ticket create→classify→reply→resolve, user mgmt, KB mgmt
- [ ] Validation pass (Zod on every endpoint) + UI error boundaries
- [ ] `helmet` + `express-rate-limit` on the API
- [ ] Loading / empty / error states across the UI
- [ ] Docker production build + docker-compose finalized
- [ ] Setup docs in README

## Phase 9 — Real email ingestion (inbound + threading done; outbound open)

- [x] Pick email provider — **Postmark**
- [x] Inbound webhook endpoint — `POST /api/inbound/postmark`. **Signature verification is not possible:** Postmark does not sign webhooks, so the endpoint uses HTTP Basic auth in the webhook URL (their own documented recommendation) with a timing-safe comparison, and fails closed when unconfigured. IP allowlisting is left as an ops control since Postmark's origin IP can change per attempt
- [x] Map inbound email → ticket creation — `server/src/ingest/`: a provider payload is normalized to `NormalizedEmail`, then `ingestEmail()` is the single create-ticket path. Idempotent on `messageId`, which is what makes Postmark's retry schedule (up to 10 redeliveries of any non-200) safe
- [ ] Outbound sending via provider (replaces the Phase 6 stub)
- [x] Reply threading via email headers — `server/src/ingest/threading.ts` parses `Message-ID` / `In-Reply-To` / `References`; `ingestEmail()` appends a `Reply` (customer, `StrippedTextReply` preferred) to the nearest-ancestor ticket, reopens resolved/closed tickets, and is idempotent on the reply's delivery id. Unmatched `In-Reply-To` opens a new ticket
- [ ] Attachments — Postmark sends them base64-encoded; currently dropped (no `Attachment` model or storage)

## Open decisions that will surface mid-plan

- Assignment strategy tie-breaks (Phase 3)
- KB authorship permissions (Phase 5)
- Auto-send confidence rule refinement beyond fixed per-category (Phase 6)
- ~~Email provider choice (Phase 9)~~ — resolved: Postmark
