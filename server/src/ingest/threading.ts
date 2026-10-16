import type { NormalizedEmail } from "./types.ts";

/**
 * Message-IDs travel wrapped in angle brackets (`<abc@host>`), and not every
 * client is consistent about whitespace. Everything is stored and compared
 * bare so both sides of a lookup agree.
 */
export function normalizeMessageId(raw: string | undefined | null): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/^</, "").replace(/>$/, "").trim() || undefined;
}

/**
 * `References` is a whitespace-separated list of bracketed ids, oldest first.
 * Anything not inside brackets is ignored rather than guessed at -- a mangled
 * header should fail to thread, not thread onto the wrong conversation.
 */
export function parseReferences(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return (raw.match(/<[^>]*>/g) ?? [])
    .map((id) => normalizeMessageId(id))
    .filter((id): id is string => Boolean(id));
}

/**
 * The ids this email might be a reply to, nearest ancestor first.
 *
 * `In-Reply-To` names the direct parent, so it wins. `References` runs oldest
 * to newest, so it is walked backwards -- threading onto the most recent
 * ancestor keeps a long conversation attached to its latest message rather
 * than its first.
 */
export function threadCandidates(
  email: Pick<NormalizedEmail, "inReplyTo" | "references">,
): string[] {
  const ordered = [email.inReplyTo, ...[...(email.references ?? [])].reverse()];
  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const id of ordered) {
    if (id && !seen.has(id)) {
      seen.add(id);
      candidates.push(id);
    }
  }

  return candidates;
}

/** Reads a header out of Postmark's `[{Name, Value}]` array, case-insensitively. */
export function headerValue(
  headers: readonly { Name: string; Value: string }[] | undefined,
  name: string,
): string | undefined {
  const match = headers?.find((header) => header.Name.toLowerCase() === name.toLowerCase());
  return match?.Value?.trim() || undefined;
}
