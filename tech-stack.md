# Tech Stack

| Layer | Pick |
|---|---|
| Language | TypeScript |
| Monorepo | Bun workspaces (`client` / `server` / `shared`) |
| Frontend | React + Vite, Tailwind + shadcn/ui, TanStack Query, react-hook-form + Zod, react-router |
| Backend API | Express |
| Database | Postgres (+ `pgvector`) |
| ORM | Prisma |
| Auth | better-auth |
| Inbound email | Postmark (inbound webhook) |
| AI | Vercel AI SDK + `@ai-sdk/anthropic` (Claude) |
| Embeddings | Voyage AI |
| Background jobs | pg-boss |
| Testing | Vitest + Testing Library (unit), Playwright (e2e) |
| Deployment | Docker / docker-compose |

## Open decisions

- ~~**Email provider** for the real-ingestion phase~~ — resolved: **Postmark**, via its inbound webhook (`POST /api/inbound/postmark`). The staged/simulated ticket-creation step was skipped, since real ingestion landed directly. Note Postmark does not sign webhooks, so the endpoint is secured with HTTP Basic auth rather than a signature.
- **Outbound sending** is still unaddressed (Phase 6 stub / Phase 9). Postmark can send as well, but nothing is wired up.
