import { describe, expect, test } from "bun:test";
import { normalizePostmarkEmail, stripHtml } from "./normalize-postmark.ts";
import { postmarkInboundSchema } from "./postmark-schema.ts";

// Parse through the schema first, so these tests exercise the same path the
// route does rather than a hand-built payload shape.
function normalize(payload: Record<string, unknown>) {
  return normalizePostmarkEmail(postmarkInboundSchema.parse(payload));
}

const base = {
  MessageID: "883953f4-6105-42a2-a16a-77a8eac79483",
  From: "alanturing@computers.com",
  FromName: "Alan Turing",
  Subject: "Saying Hello!",
  TextBody: "This is a test text body.",
  Date: "Thu, 5 Nov 2026 16:33:54 -0500",
};

describe("normalizePostmarkEmail", () => {
  test("maps a typical payload", () => {
    const email = normalize(base);

    expect(email.messageId).toBe("883953f4-6105-42a2-a16a-77a8eac79483");
    expect(email.from).toEqual({ email: "alanturing@computers.com", name: "Alan Turing" });
    expect(email.subject).toBe("Saying Hello!");
    expect(email.body).toBe("This is a test text body.");
    expect(email.source).toBe("postmark");
    expect(email.receivedAt.toISOString()).toBe("2026-11-05T21:33:54.000Z");
  });

  test("prefers FromFull over the raw From header", () => {
    const email = normalize({
      ...base,
      FromFull: { Email: "Parsed@Example.com", Name: "Parsed Name" },
    });

    expect(email.from.email).toBe("parsed@example.com");
    expect(email.from.name).toBe("Parsed Name");
  });

  test("lowercases the sender address", () => {
    expect(normalize({ ...base, From: "Alan.Turing@Computers.COM" }).from.email).toBe(
      "alan.turing@computers.com",
    );
  });

  test("omits the name when neither FromFull nor FromName has one", () => {
    const { FromName: _unused, ...withoutName } = base;
    expect(normalize(withoutName).from).toEqual({ email: "alanturing@computers.com" });
  });

  test("falls back to a placeholder subject", () => {
    expect(normalize({ ...base, Subject: "   " }).subject).toBe("(no subject)");
    const { Subject: _unused, ...withoutSubject } = base;
    expect(normalize(withoutSubject).subject).toBe("(no subject)");
  });

  test("truncates a very long subject", () => {
    const email = normalize({ ...base, Subject: "s".repeat(600) });
    expect(email.subject).toHaveLength(500);
  });

  test("converts an HTML-only body to text", () => {
    const { TextBody: _unused, ...htmlOnly } = base;
    const email = normalize({
      ...htmlOnly,
      HtmlBody: "<html><body><p>Hello there</p><p>Second line</p></body></html>",
    });

    expect(email.body).toBe("Hello there\nSecond line");
    expect(email.body).not.toContain("<");
  });

  test("falls back to a placeholder when there is no content at all", () => {
    const { TextBody: _unused, ...noBody } = base;
    expect(normalize(noBody).body).toBe("(no content)");
  });

  test("truncates an oversized body and marks it", () => {
    const email = normalize({ ...base, TextBody: "x".repeat(40_000) });

    expect(email.body).toEndWith("[truncated]");
    expect(email.body.length).toBeLessThan(40_000);
  });

  test("falls back to now when Date is unparseable", () => {
    const before = Date.now();
    const email = normalize({ ...base, Date: "not a date" });

    expect(email.receivedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  test("falls back to now when Date is absent", () => {
    const { Date: _unused, ...withoutDate } = base;
    expect(Number.isNaN(normalize(withoutDate).receivedAt.getTime())).toBe(false);
  });
});

describe("normalizePostmarkEmail threading", () => {
  test("reads Message-ID, In-Reply-To and References from the headers", () => {
    const email = normalize({
      ...base,
      StrippedTextReply: "Thanks, that worked.",
      Headers: [
        { Name: "message-id", Value: "<reply@host>" },
        { Name: "In-Reply-To", Value: "<parent@host>" },
        { Name: "References", Value: "<root@host> <parent@host>" },
      ],
    });

    expect(email.emailMessageId).toBe("reply@host");
    expect(email.inReplyTo).toBe("parent@host");
    expect(email.references).toEqual(["root@host", "parent@host"]);
    expect(email.strippedBody).toBe("Thanks, that worked.");
  });

  test("a plain email carries no threading fields beyond the fallback id", () => {
    const email = normalize(base);

    expect(email.inReplyTo).toBeUndefined();
    expect(email.references).toBeUndefined();
    expect(email.strippedBody).toBeUndefined();
    expect(email.emailMessageId).toBe(base.MessageID);
  });
});

describe("postmarkInboundSchema", () => {
  test("rejects a payload with no MessageID", () => {
    const { MessageID: _unused, ...withoutId } = base;
    expect(postmarkInboundSchema.safeParse(withoutId).success).toBe(false);
  });

  test("rejects an unusable sender address", () => {
    expect(postmarkInboundSchema.safeParse({ ...base, From: "not-an-email" }).success).toBe(false);
  });

  test("ignores the Postmark fields we do not consume", () => {
    const parsed = postmarkInboundSchema.safeParse({
      ...base,
      MessageStream: "inbound",
      Attachments: [{ Name: "x.pdf", Content: "...", ContentType: "application/pdf", ContentLength: 3 }],
      Headers: [{ Name: "X-Spam-Status", Value: "No" }],
    });

    expect(parsed.success).toBe(true);
  });
});

describe("stripHtml", () => {
  test("drops script and style content entirely", () => {
    const text = stripHtml("<style>p{color:red}</style><p>Keep</p><script>alert(1)</script>");

    expect(text).toBe("Keep");
  });

  test("decodes entities after stripping tags, so escaped markup stays inert", () => {
    expect(stripHtml("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>")).toBe(
      "<script>alert(1)</script>",
    );
  });
});
