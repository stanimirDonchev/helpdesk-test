/**
 * Provider-agnostic shape of one received email.
 *
 * This is the seam: a provider adapter's only job is to turn its own payload
 * into this, and `ingestEmail` is the only thing that writes a ticket. Adding
 * another provider (or IMAP polling) means adding a normalizer, not touching
 * ticket creation.
 */
export type NormalizedEmail = {
  /** The provider's message id. Never empty -- this is the idempotency key. */
  messageId: string;
  from: { email: string; name?: string };
  subject: string;
  /** Always plain text, never markup. See `normalize-postmark.ts`. */
  body: string;
  receivedAt: Date;
  /** Which adapter produced this, stored on the ticket for provenance. */
  source: string;

  /**
   * The email's own RFC-822 `Message-ID`, which is what a later reply's
   * `In-Reply-To` will point at. Distinct from `messageId` above: that one is
   * the provider's delivery id, which no replying client has ever seen.
   */
  emailMessageId?: string;
  /** `In-Reply-To` -- the direct parent, when this is a reply. */
  inReplyTo?: string;
  /** `References`, oldest ancestor first. */
  references?: string[];
  /**
   * The reply text with the quoted history removed, when the provider could
   * work it out. Preferred over `body` for a threaded reply, so the thread
   * doesn't repeat itself at every turn.
   */
  strippedBody?: string;
};
