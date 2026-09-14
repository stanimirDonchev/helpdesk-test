# AI-Powered Ticket Management System

## Problem

We receive hundreds of support emails daily. Our agents manually read, classify, and respond to each ticket — which is slow and leads to impersonal, canned responses.

## Solution

Build a ticket management system that uses AI to automatically classify, respond to, and route support tickets — delivering faster, more personalized responses to students while freeing up agents for complex issues.

## Features

- Receive support emails and create tickets
- Auto-generate human-friendly responses using a knowledge base
- Ticket list with filtering and sorting
- Ticket detail view
- AI-powered ticket classification
- AI summaries
- AI-suggested replies
- Route tickets to agents/teams
- Knowledge base management (create/edit articles used by the AI)
- User management (admin only)
- Dashboard to view and manage all tickets

## Ticket Statuses

- Open
- Resolved
- Closed

## Ticket Categories

- General Question
- Technical Question
- Refund Request

## User Roles

- **Admin**: Deployed with the system. Can create and manage agents.
- **Agent**: Created by admin. Can view and manage tickets.

## Email Ingestion

Staged approach:

1. **V1**: Tickets are created via an interim path (API/form/seed data) that mirrors the shape of a real email — sender, subject, body — so the schema doesn't need to change later.
2. **Later**: Wire up real email ingestion (IMAP polling or provider inbound webhook, e.g. Postmark/SendGrid).

## AI Reply Autonomy

Replies auto-send only for simple categories; others always go to an agent for review:

- **General Question**: AI drafts and sends automatically.
- **Technical Question / Refund Request**: AI drafts a suggested reply; an agent must review and send.

Open questions to resolve before implementation: how "simple" is determined (fixed per-category rule vs. AI confidence score), and whether auto-sent replies are flagged as AI-generated / logged for audit.

## Routing

Tickets route to specific agents/teams (not just categorized). This implies:

- A `Team` concept and/or `assignedAgent` field on tickets.
- An assignment strategy (e.g. category → team mapping, round-robin, load-based) — still to be defined.
- A fallback behavior when no agent/team is available.

## Knowledge Base

Built as part of this project (no existing KB to import). Still to define: who authors articles (admin, agent, or both), and how the AI consumes them (RAG lookup vs. stuffing all articles into the prompt).
