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
| AI | Vercel AI SDK + `@ai-sdk/anthropic` (Claude) |
| Embeddings | Voyage AI |
| Background jobs | pg-boss |
| Testing | Vitest + Testing Library (unit), Playwright (e2e) |
| Deployment | Docker / docker-compose |

## Open decisions

- **Email provider** for the real-ingestion phase (SendGrid, Postmark, or Mailgun inbound parse) — deferred until past v1 (staged/simulated ticket creation).
