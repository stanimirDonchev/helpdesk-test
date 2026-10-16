import express, { Router, type ErrorRequestHandler } from "express";
import { ingestEmail } from "../ingest/ingest-email.ts";
import { normalizePostmarkEmail } from "../ingest/normalize-postmark.ts";
import { postmarkInboundSchema } from "../ingest/postmark-schema.ts";
import { requireWebhookAuth } from "../middleware/require-webhook-auth.ts";

export const inboundEmailRouter: Router = Router();

// Status codes here are chosen against Postmark's retry behaviour: anything
// that isn't a 200 is redelivered up to ten times (1m, 5m, 10m x3, 15m, 30m,
// 1h, 2h, 6h) and then shown as an Inbound Error, while a 403 stops retries
// immediately. With no queue in the system, those retries *are* the durability
// layer -- which only works because `ingestEmail` is idempotent.
//
// This router carries its own `express.json()` with a raised limit: the global
// parser in `index.ts` uses Express's 100kb default, which a real email with a
// long quoted thread exceeds. It is mounted ahead of that global parser.
inboundEmailRouter.post(
  "/postmark",
  requireWebhookAuth,
  express.json({ limit: "2mb" }),
  async (req, res) => {
    const parsed = postmarkInboundSchema.safeParse(req.body);
    if (!parsed.success) {
      // 422 lets Postmark retry and then surface the message as an Inbound
      // Error, which is the visibility we want: a payload we can't parse is a
      // bug to fix, and the message stays replayable from their dashboard.
      res.status(422).json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" });
      return;
    }

    const { ticket, reply, created } = await ingestEmail(normalizePostmarkEmail(parsed.data));

    // 200 for every outcome: a duplicate is a successful no-op, not a failure,
    // and answering anything else would invite yet another redelivery.
    // `replyId` is set when the email threaded onto an existing ticket rather
    // than opening a new one.
    res.status(200).json({ ticketId: ticket.id, replyId: reply?.id ?? null, created });
  },
);

// A transient failure (database down mid-delivery) must answer 500 so Postmark
// redelivers and the email isn't lost. Express 5 forwards the rejected promise
// from the handler above here on its own.
const handleIngestionFailure: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error("Inbound email ingestion failed:", error);
  res.status(500).json({ error: "Failed to ingest email" });
};
inboundEmailRouter.use(handleIngestionFailure);
