// Stored values, mirroring how `user-types.ts` models roles: a plain const
// object rather than a Prisma enum, so the DB column stays a `String` and a
// value can be added without a migration.
export const TicketStatus = {
  open: "open",
  resolved: "resolved",
  closed: "closed",
} as const;

export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const TicketCategory = {
  generalQuestion: "general_question",
  technicalQuestion: "technical_question",
  refundRequest: "refund_request",
} as const;

export type TicketCategory = (typeof TicketCategory)[keyof typeof TicketCategory];

export const SenderType = {
  customer: "customer",
  agent: "agent",
  ai: "ai",
} as const;

export type SenderType = (typeof SenderType)[keyof typeof SenderType];

// `project-scope.md` spells the user-facing labels. Keeping them out of the
// stored values means renaming a label never needs a migration, and no
// component has to hand-write the display text.
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  resolved: "Resolved",
  closed: "Closed",
};

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  general_question: "General Question",
  technical_question: "Technical Question",
  refund_request: "Refund Request",
};
