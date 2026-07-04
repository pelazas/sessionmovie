/**
 * Redaction layer — runs in the parser, at the door. No string may reach a
 * rendered frame without passing through redactString(). See
 * docs/security-and-privacy.md. Masked content is visibly redacted
 * (a `[••••:label]` token), never silently altered.
 */

export interface SecretPattern {
  /** Short label shown inside the redaction chip, e.g. "aws-key". */
  label: string;
  pattern: RegExp;
}

/** Known secret shapes. Extend here; keep the interface. */
export const SECRET_PATTERNS: SecretPattern[] = [
  { label: "aws-key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { label: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
];

export function mask(label: string): string {
  return `[••••:${label}]`;
}

/** Scrub home-directory usernames from paths: /Users/<name>/… → ~/… */
export function scrubPaths(input: string): string {
  return input.replace(/(?:\/home|\/Users)\/[A-Za-z0-9._-]+/g, "~");
}

/**
 * Redact one displayable string. Every string that can reach a rendered
 * frame must pass through here — no render path may bypass it.
 */
export function redactString(input: string): string {
  let out = input;
  for (const { label, pattern } of SECRET_PATTERNS) {
    out = out.replace(pattern, mask(label));
  }
  return scrubPaths(out);
}
