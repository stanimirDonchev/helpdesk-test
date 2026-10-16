import { SenderType, TicketStatus } from "shared/ticket-types";
import { prisma } from "../db.ts";
import { Prisma, type Reply, type Ticket } from "../generated/prisma/client.js";
import { threadCandidates } from "./threading.ts";
import type { NormalizedEmail } from "./types.ts";

export type IngestResult = {
  ticket: Ticket;
  /** The appended reply when this email threaded onto an existing ticket. */
  reply: Reply | null;
  /** False when this delivery had already been ingested. */
  created: boolean;
};

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Finds the ticket this email is a reply to, if any.
 *
 * Candidates are checked in nearest-ancestor-first order, and a reply's own
 * `emailMessageId` counts as a parent too -- so a reply to a reply lands on the
 * same ticket rather than starting a new one.
 */
async function findThreadParent(email: NormalizedEmail): Promise<Ticket | null> {
  const candidates = threadCandidates(email);
  if (candidates.length === 0) return null;

  // Two queries rather than one per candidate; the candidate order is applied
  // afterwards so the nearest ancestor still wins.
  const [tickets, replies] = await Promise.all([
    prisma.ticket.findMany({ where: { emailMessageId: { in: candidates } } }),
    prisma.reply.findMany({
      where: { emailMessageId: { in: candidates } },
      include: { ticket: true },
    }),
  ]);

  const byMessageId = new Map<string, Ticket>();
  for (const reply of replies) {
    if (reply.emailMessageId) byMessageId.set(reply.emailMessageId, reply.ticket);
  }
  // Tickets are set second so an id that somehow matches both resolves to the
  // ticket itself.
  for (const ticket of tickets) {
    if (ticket.emailMessageId) byMessageId.set(ticket.emailMessageId, ticket);
  }

  for (const candidate of candidates) {
    const parent = byMessageId.get(candidate);
    if (parent) return parent;
  }
  return null;
}

async function appendReply(ticket: Ticket, email: NormalizedEmail): Promise<IngestResult> {
  // `strippedBody` is the message without the quoted history, so a long thread
  // doesn't repeat itself at every turn.
  const body = email.strippedBody ?? email.body;

  try {
    const reply = await prisma.reply.create({
      data: {
        ticketId: ticket.id,
        senderType: SenderType.customer,
        body,
        messageId: email.messageId,
        emailMessageId: email.emailMessageId ?? null,
      },
    });

    // Someone answering a resolved or closed ticket means it wasn't finished,
    // so it goes back in the queue. An already-open ticket is left untouched.
    const updated =
      ticket.status === TicketStatus.open
        ? ticket
        : await prisma.ticket.update({
            where: { id: ticket.id },
            data: { status: TicketStatus.open },
          });

    return { ticket: updated, reply, created: true };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;

    // A concurrent redelivery won the race. Prefer the row keyed by this
    // delivery id; if that isn't it, the collision was on `emailMessageId`
    // (the same email reaching us twice under different delivery ids), which
    // is still "already ingested".
    const existing = await prisma.reply.findUnique({
      where: { messageId: email.messageId },
      include: { ticket: true },
    });
    return existing
      ? { ticket: existing.ticket, reply: existing, created: false }
      : { ticket, reply: null, created: false };
  }
}

async function createTicket(email: NormalizedEmail): Promise<IngestResult> {
  try {
    const ticket = await prisma.ticket.create({
      data: {
        subject: email.subject,
        body: email.body,
        senderEmail: email.from.email,
        senderName: email.from.name ?? null,
        messageId: email.messageId,
        emailMessageId: email.emailMessageId ?? null,
        source: email.source,
        receivedAt: email.receivedAt,
        // `status` defaults to open; `category` stays null until Phase 4's
        // classifier exists.
      },
    });
    return { ticket, reply: null, created: true };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;

    const existing = await prisma.ticket.findUnique({
      where: { messageId: email.messageId },
    });
    if (existing) return { ticket: existing, reply: null, created: false };

    // The collision was on `emailMessageId`, so this same email already opened
    // a ticket under a different delivery id.
    const byEmailId = email.emailMessageId
      ? await prisma.ticket.findUnique({ where: { emailMessageId: email.emailMessageId } })
      : null;
    if (byEmailId) return { ticket: byEmailId, reply: null, created: false };
    throw error;
  }
}

/**
 * The single path that turns a received email into a ticket, or into a reply on
 * the ticket it answers.
 *
 * Idempotent on the provider's delivery id, which is what makes it safe to be
 * called more than once for the same email -- Postmark redelivers anything that
 * didn't answer 200, up to ten times, so a duplicate call is expected rather
 * than exceptional.
 */
export async function ingestEmail(email: NormalizedEmail): Promise<IngestResult> {
  const seenTicket = await prisma.ticket.findUnique({ where: { messageId: email.messageId } });
  if (seenTicket) {
    return { ticket: seenTicket, reply: null, created: false };
  }

  const seenReply = await prisma.reply.findUnique({
    where: { messageId: email.messageId },
    include: { ticket: true },
  });
  if (seenReply) {
    return { ticket: seenReply.ticket, reply: seenReply, created: false };
  }

  // Unthreadable mail -- no matching ancestor, or no threading headers at all
  // -- opens its own ticket, which is also the behaviour when a client mangles
  // `References`.
  const parent = await findThreadParent(email);
  return parent ? appendReply(parent, email) : createTicket(email);
}
