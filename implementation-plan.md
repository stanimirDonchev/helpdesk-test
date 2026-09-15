# Implementation Plan

Reference: `project-scope.md`, `tech-stack.md`. Phases are meant to be built roughly in order — each one produces something runnable/demoable before moving to the next. Tasks within a phase are PR-sized.

## Phase 0 — Project scaffolding

- [ ] Init Bun workspace monorepo (`client` / `server` / `shared`)
- [ ] `shared` package: Zod schemas + enums for ticket status, category, role, sender type
- [ ] Shared TS/ESLint/Prettier config across workspaces
- [ ] Postgres + `pgvector` via docker-compose for local dev
- [ ] Prisma init in `server`, connect to local Postgres
- [ ] `.env.example` for client and server
- [ ] Vitest + Testing Library wired up in `client` with a smoke test
- [x] Playwright skeleton (`e2e` workspace) with a trivial passing test

## Phase 1 — Auth & user management

- [ ] Prisma schema: `User` (role: admin/agent, active/deactivated)
- [ ] Integrate better-auth (email/password) on the server
- [ ] Seed script: create the initial Admin user
- [ ] better-auth client + session hook on the frontend
- [ ] Login page
- [ ] `ProtectedRoute` / `AdminRoute` wrappers
- [ ] API: create/list/deactivate agent (admin-only)
- [ ] UI: Users page (list, create-agent form, deactivate action)
- [ ] App shell: layout, nav, role-aware menu

## Phase 2 — Core ticket data & CRUD (no AI yet)

- [ ] Prisma schema: `Ticket` (subject, body, status, category, sender email, timestamps) and `Reply` (ticket, senderType, body, createdAt)
- [ ] Migration + seed sample tickets/replies
- [ ] API: create ticket (interim endpoint standing in for real email — matches the staged-ingestion decision)
- [ ] API: list tickets (filter by status/category, sort, pagination)
- [ ] API: get ticket detail (ticket + reply thread)
- [ ] API: post reply, update ticket status
- [ ] UI: ticket list (table, filters, sorting) with TanStack Table/Query
- [ ] UI: ticket detail (thread view + reply form)
- [ ] UI: manual "new ticket" form (dev/demo substitute for inbound email)

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

## Phase 9 — Real email ingestion (deferred)

- [ ] Pick email provider (SendGrid / Postmark / Mailgun)
- [ ] Inbound webhook endpoint + signature verification
- [ ] Map inbound email → ticket creation (reuses Phase 2's create-ticket path)
- [ ] Outbound sending via provider (replaces the Phase 6 stub)
- [ ] Reply threading via email headers (`Message-ID` / `In-Reply-To`)

## Open decisions that will surface mid-plan

- Assignment strategy tie-breaks (Phase 3)
- KB authorship permissions (Phase 5)
- Auto-send confidence rule refinement beyond fixed per-category (Phase 6)
- Email provider choice (Phase 9)
