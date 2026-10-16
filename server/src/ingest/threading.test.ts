import { describe, expect, test } from "bun:test";
import { headerValue, normalizeMessageId, parseReferences, threadCandidates } from "./threading.ts";

describe("normalizeMessageId", () => {
  test("strips angle brackets and whitespace", () => {
    expect(normalizeMessageId("  <abc@host>  ")).toBe("abc@host");
  });

  test("leaves a bare id alone", () => {
    expect(normalizeMessageId("abc@host")).toBe("abc@host");
  });

  test("returns undefined for empty input", () => {
    expect(normalizeMessageId(undefined)).toBeUndefined();
    expect(normalizeMessageId("   ")).toBeUndefined();
    expect(normalizeMessageId("<>")).toBeUndefined();
  });
});

describe("parseReferences", () => {
  test("parses whitespace- and newline-separated ids, oldest first", () => {
    expect(parseReferences("<a@h> <b@h>\r\n <c@h>")).toEqual(["a@h", "b@h", "c@h"]);
  });

  test("ignores anything not wrapped in brackets", () => {
    expect(parseReferences("garbage a@h <b@h>")).toEqual(["b@h"]);
  });

  test("returns [] for a missing header", () => {
    expect(parseReferences(undefined)).toEqual([]);
  });
});

describe("threadCandidates", () => {
  test("puts In-Reply-To first, then References newest to oldest", () => {
    expect(
      threadCandidates({ inReplyTo: "c", references: ["a", "b", "c"] }),
    ).toEqual(["c", "b", "a"]);
  });

  test("de-duplicates ids", () => {
    expect(threadCandidates({ inReplyTo: "b", references: ["a", "b"] })).toEqual(["b", "a"]);
  });

  test("is empty for a non-reply, and does not mutate References", () => {
    expect(threadCandidates({})).toEqual([]);
    const references = ["a", "b"];
    threadCandidates({ references });
    expect(references).toEqual(["a", "b"]);
  });
});

describe("headerValue", () => {
  const headers = [{ Name: "In-Reply-To", Value: " <a@h> " }];

  test("matches case-insensitively and trims", () => {
    expect(headerValue(headers, "in-reply-to")).toBe("<a@h>");
  });

  test("returns undefined when absent", () => {
    expect(headerValue(headers, "References")).toBeUndefined();
    expect(headerValue(undefined, "References")).toBeUndefined();
  });
});
