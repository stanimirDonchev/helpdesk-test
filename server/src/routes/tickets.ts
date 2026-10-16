import { Router } from "express";
import type { TicketResponse, TicketsListResponse, TicketSummary } from "shared/api-types";
import type { SenderType, TicketCategory, TicketStatus } from "shared/ticket-types";
import { prisma } from "../db.ts";
import { requireSession } from "../middleware/require-session.ts";

export const ticketsRouter: Router = Router();

const summarySelect = {
  id: true,
  subject: true,
  senderEmail: true,
  senderName: true,
  status: true,
  category: true,
  receivedAt: true,
} as const;

type TicketRow = {
  id: string;
  subject: string;
  senderEmail: string;
  senderName: string | null;
  status: string;
  category: string | null;
  receivedAt: Date;
};

// `status`/`category` are plain String columns (the project keeps its enums in
// `shared/`, not in Prisma), so they're cast here at the boundary -- the same
// thing `users.ts` does with `role`.
function toSummary(ticket: TicketRow): TicketSummary {
  return {
    ...ticket,
    status: ticket.status as TicketStatus,
    category: ticket.category as TicketCategory | null,
    receivedAt: ticket.receivedAt.toISOString(),
  };
}

ticketsRouter.get("/", requireSession, async (_req, res) => {
  const tickets = await prisma.ticket.findMany({
    select: summarySelect,
    orderBy: { receivedAt: "desc" },
  });

  const body: TicketsListResponse = { tickets: tickets.map(toSummary) };
  res.json(body);
});

// Typed param: Express 5 types a bare `req.params` value as `string | string[]`.
ticketsRouter.get<{ id: string }>("/:id", requireSession, async (req, res) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    select: {
      ...summarySelect,
      body: true,
      replies: {
        select: { id: true, senderType: true, body: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const body: TicketResponse = {
    ticket: {
      ...toSummary(ticket),
      body: ticket.body,
      // Nothing writes replies yet -- inbound mail always opens a new ticket,
      // and agent replies land with Phase 2's reply form.
      replies: ticket.replies.map((reply) => ({
        ...reply,
        senderType: reply.senderType as SenderType,
        createdAt: reply.createdAt.toISOString(),
      })),
    },
  };
  res.json(body);
});
