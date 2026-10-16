import { z } from "zod";

// Only the fields we actually consume. Zod strips unknown keys by default, so
// the rest of Postmark's payload (MessageStream, ToFull, Headers, Attachments,
// MailboxHash, Tag, ...) passes through harmlessly without being declared.
//
// This stays in `server/` rather than `shared/`: nothing client-side ever
// validates a Postmark payload, and `shared/` is for shapes checked on both
// sides of a request.
export const postmarkInboundSchema = z.object({
  // The `error` on the type itself, not just on `.min()`, so an absent field
  // reports the same message as an empty one -- this text is what shows up in
  // Postmark's Inbound Error view.
  MessageID: z.string({ error: "MessageID is required" }).trim().min(1),
  From: z.email({ error: "From must be a valid email address" }),
  FromName: z.string().optional(),
  FromFull: z
    .object({
      Email: z.email({ error: "FromFull.Email must be a valid email address" }),
      Name: z.string().optional(),
    })
    .optional(),
  Subject: z.string().optional(),
  TextBody: z.string().optional(),
  HtmlBody: z.string().optional(),
  Date: z.string().optional(),
  // Postmark fills this in only when the message was a reply that carried an
  // `In-Reply-To` or `References` header, so its presence is itself a reply
  // signal -- and it is the body with the quoted history already stripped.
  StrippedTextReply: z.string().optional(),
  // Every remaining header, as `[{Name, Value}]`. The threading headers
  // (`Message-ID`, `In-Reply-To`, `References`) are read out of here, since
  // none of them is a top-level field.
  Headers: z.array(z.object({ Name: z.string(), Value: z.string() })).optional(),
});

export type PostmarkInboundPayload = z.infer<typeof postmarkInboundSchema>;
