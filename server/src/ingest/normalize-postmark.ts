import type { PostmarkInboundPayload } from "./postmark-schema.ts";
import { headerValue, normalizeMessageId, parseReferences } from "./threading.ts";
import type { NormalizedEmail } from "./types.ts";

const MAX_SUBJECT_LENGTH = 500;
const MAX_BODY_LENGTH = 32_000;

/**
 * Deliberately crude HTML-to-text: plenty of real mail is HTML-only, and
 * dropping it would lose the message entirely. Tags are stripped *before*
 * entities are decoded, so text that merely reads like `&lt;script&gt;` can't
 * turn itself back into a tag. The result is stored and rendered as plain text,
 * which is what keeps the UI free of provider markup.
 *
 * A real HTML-to-text pass (lists, tables, links) is a later refinement.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#3[49];/g, "'")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncateBody(body: string): string {
  return body.length <= MAX_BODY_LENGTH
    ? body
    : `${body.slice(0, MAX_BODY_LENGTH)}\n\n[truncated]`;
}

export function normalizePostmarkEmail(payload: PostmarkInboundPayload): NormalizedEmail {
  // `FromFull` carries the parsed address and display name; `From` is the raw
  // header and the fallback. Lowercased to match how emails are stored
  // elsewhere (see `shared/user-validation.ts`).
  const email = (payload.FromFull?.Email ?? payload.From).trim().toLowerCase();
  const name = payload.FromFull?.Name?.trim() || payload.FromName?.trim() || undefined;

  const text = payload.TextBody?.trim();
  const body = text || (payload.HtmlBody ? stripHtml(payload.HtmlBody) : "") || "(no content)";

  const subject = payload.Subject?.trim();

  // Postmark can't normalize `Date` -- its format follows the sending mail
  // server -- so an unparseable value falls back to now instead of writing an
  // Invalid Date into the row.
  const sentAt = payload.Date ? new Date(payload.Date) : null;
  const receivedAt = sentAt && !Number.isNaN(sentAt.getTime()) ? sentAt : new Date();

  // Falls back to the provider's delivery id when the header is missing. If
  // that id happens to be the real Message-ID the fallback makes threading
  // work; if it's an opaque GUID it simply never matches an `In-Reply-To`,
  // which is the same outcome as storing nothing.
  const emailMessageId =
    normalizeMessageId(headerValue(payload.Headers, "Message-ID")) ??
    normalizeMessageId(payload.MessageID);
  const inReplyTo = normalizeMessageId(headerValue(payload.Headers, "In-Reply-To"));
  const references = parseReferences(headerValue(payload.Headers, "References"));
  const strippedBody = payload.StrippedTextReply?.trim() || undefined;

  return {
    messageId: payload.MessageID.trim(),
    from: name ? { email, name } : { email },
    subject: subject ? subject.slice(0, MAX_SUBJECT_LENGTH) : "(no subject)",
    body: truncateBody(body),
    receivedAt,
    source: "postmark",
    ...(emailMessageId ? { emailMessageId } : {}),
    ...(inReplyTo ? { inReplyTo } : {}),
    ...(references.length > 0 ? { references } : {}),
    ...(strippedBody ? { strippedBody: truncateBody(strippedBody) } : {}),
  };
}
