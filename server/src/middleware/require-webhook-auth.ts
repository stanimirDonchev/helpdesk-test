import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

/**
 * Postmark does not sign its webhooks -- there is no HMAC to verify -- so HTTP
 * Basic auth embedded in the webhook URL is its own documented recommendation
 * (`https://user:password@host/api/inbound/postmark`, HTTPS only, since Basic
 * is cleartext otherwise).
 *
 * These credentials are therefore the *only* thing standing in front of an
 * endpoint that creates tickets, so a missing configuration fails closed.
 */
export const requireWebhookAuth: RequestHandler = (req, res, next) => {
  const user = process.env.INBOUND_WEBHOOK_USER;
  const password = process.env.INBOUND_WEBHOOK_PASSWORD;

  if (!user || !password) {
    // Never fall through to an open endpoint. 503 (not 403) because this is our
    // misconfiguration, not the caller's: Postmark should keep retrying so the
    // mail isn't lost once the credentials are set.
    console.error("INBOUND_WEBHOOK_USER/PASSWORD are not set; refusing inbound email.");
    res.status(503).json({ error: "Inbound email is not configured" });
    return;
  }

  const expected = `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
  // Hash both sides first: `timingSafeEqual` throws when the buffers differ in
  // length, and that throw would itself leak the credential length.
  const providedDigest = createHash("sha256").update(req.header("authorization") ?? "").digest();
  const expectedDigest = createHash("sha256").update(expected).digest();

  if (!timingSafeEqual(providedDigest, expectedDigest)) {
    // 403 rather than 401 on purpose: a 403 stops Postmark retrying, and wrong
    // credentials will never become right on a retry, so ten redeliveries over
    // ~10.5 hours would achieve nothing. The message is kept as an Inbound
    // Error in Postmark and can be replayed via their API once the config is
    // fixed. Tradeoff: credentials rotated mid-flight lose their retries.
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
};
