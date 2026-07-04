/**
 * Redaction layer — runs in the parser, at the door. No string may reach a
 * rendered frame without passing through redactString(). See
 * docs/security-and-privacy.md. Masked content is visibly redacted
 * (a `[••••:label]` token), never silently altered.
 *
 * Order matters: specific secret patterns first, then env-var heuristics,
 * then generic entropy detection, then PII/path scrubbing.
 */

export interface SecretPattern {
  /** Short label shown inside the redaction chip, e.g. "aws-key". */
  label: string;
  pattern: RegExp;
}

/** Known secret shapes. Extend here; keep the interface. */
export const SECRET_PATTERNS: SecretPattern[] = [
  // Cloud / VCS / SaaS keys (pattern shapes follow trufflehog/gitleaks)
  { label: "aws-key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { label: "aws-secret", pattern: /\baws_secret_access_key\s*[=:]\s*\S+/gi },
  { label: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { label: "github-pat", pattern: /\bgithub_pat_[A-Za-z0-9_]{60,}\b/g },
  { label: "gitlab-token", pattern: /\bglpat-[A-Za-z0-9_-]{20,}\b/g },
  { label: "slack-token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { label: "stripe-key", pattern: /\b[sr]k_(?:live|test)_[A-Za-z0-9]{20,}\b/g },
  { label: "anthropic-key", pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { label: "openai-key", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { label: "google-key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { label: "sendgrid-key", pattern: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g },
  { label: "npm-token", pattern: /\bnpm_[A-Za-z0-9]{36}\b/g },
  // Structural shapes
  { label: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/g },
  {
    label: "private-key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  },
  {
    label: "connection-string",
    pattern:
      /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:@/]+:[^\s@/]+@[^\s]+/gi,
  },
  {
    label: "auth-header",
    pattern:
      /\b(?:Authorization|Proxy-Authorization):\s*(?:Bearer|Basic|token)\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  },
  { label: "bearer-token", pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{20,}={0,2}(?=[\s"'`]|$)/g },
];

/**
 * Values assigned to secret-looking variable names, wherever they appear:
 * FOO_KEY=..., "api_token": "...", export DB_PASSWORD='...'
 */
const ENV_HEURISTIC =
  /\b([A-Za-z_][A-Za-z0-9_]*(?:_KEY|_TOKEN|_SECRET|_PASSWORD|_PASSWD|_CREDENTIALS|_APIKEY)|(?:api[_-]?key|auth[_-]?token|secret|password|passwd))\b(["']?\s*[=:]\s*)(["']?)([^\s"'`,;]{6,})\3/gi;

/** Candidate tokens for entropy screening: long, single-run, plausible key alphabet. */
const ENTROPY_CANDIDATE = /\b[A-Za-z0-9+/_=-]{32,}\b/g;

export function shannonEntropy(s: string): number {
  const freq = new Map<string, number>();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / s.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function looksLikeSecretToken(token: string): boolean {
  // Skip common non-secrets that match the candidate shape:
  if (/^[0-9a-f]{32,64}$/i.test(token)) return false; // git SHAs, md5/sha hashes
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return false; // UUIDs
  // Real keys mix character classes; identifiers and words don't.
  if (!/[A-Z]/.test(token) || !/[a-z]/.test(token) || !/[0-9]/.test(token)) return false;
  return shannonEntropy(token) >= 4.2;
}

export function mask(label: string): string {
  return `[••••:${label}]`;
}

/**
 * Scrub home-directory usernames from paths: /Users/<name>/… → ~/…
 * Also covers Claude Code's dash-encoded project slugs
 * (~/.claude/projects/-Users-<name>-repo, scratchpad dirs): the username
 * segment is replaced, the rest of the slug survives.
 */
export function scrubPaths(input: string): string {
  return input
    .replace(/(?:\/home|\/Users)\/[A-Za-z0-9._-]+/g, "~")
    .replace(/-(?:home|Users)-[A-Za-z0-9._]+/g, "-Users-dev");
}

/** Scrub email addresses (PII). */
export function scrubEmails(input: string): string {
  return input.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, mask("email"));
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
  out = out.replace(
    ENV_HEURISTIC,
    (_m, name: string, sep: string, quote: string) =>
      `${name}${sep}${quote}${mask("env-value")}${quote}`,
  );
  out = out.replace(ENTROPY_CANDIDATE, (token) =>
    looksLikeSecretToken(token) ? mask("high-entropy") : token,
  );
  out = scrubEmails(out);
  return scrubPaths(out);
}
