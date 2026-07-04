/**
 * Scrub the fixture corpus in place: every line of every fixtures/raw/*.jsonl
 * goes through the parser's redaction layer (the same one that guards
 * rendered frames — see docs/security-and-privacy.md), plus a small
 * fixture-only PII list for strings redactString can't know about
 * (the repo owner's identifiers). Fixtures are committed public.
 *
 *   npx tsx scripts/scrub-fixtures.ts           # scrub in place
 *   npx tsx scripts/scrub-fixtures.ts --check   # pre-commit / CI gate:
 *                                               # exit 1 if anything WOULD change
 *
 * --check is the single source of truth for "is the corpus clean" — it
 * exercises redact.ts patterns directly, so new secret patterns added there
 * are enforced here with no second pattern list to keep in sync.
 *
 * Idempotent: scrubbing an already-scrubbed file is a no-op.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { redactString } from "../src/parser/redact.js";

/** Fixture-only PII replacements (owner identifiers, machine names). */
const PII_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\/Users\/pelazas/gi, "/Users/dev"], // before redactString so `~` scrub still applies
  [/-Users-pelazas/gi, "-Users-dev"],
  [/\b(?:carlos|cg)?pelazas\b/gi, "dev"],
  [/\bCarlos Pelazas\b/gi, "Dev Developer"],
  // Not a secret (public verification data), but masked so the corpus greps
  // clean for `-----BEGIN` without exceptions.
  [/-----BEGIN SSH SIGNATURE-----[\s\S]*?-----END SSH SIGNATURE-----/g, "[••••:ssh-signature]"],
];

const RAW_DIR = join(import.meta.dirname, "..", "fixtures", "raw");
const checkMode = process.argv.includes("--check");

function scrubText(text: string): string {
  let out = text;
  for (const [pattern, replacement] of PII_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return redactString(out);
}

/**
 * Redact every string in a parsed JSON tree — values AND object keys
 * (transcripts key objects by file path, e.g. toolUseResult.filesByPath).
 * Redacting the raw line instead would let a regex eat an escaped quote
 * and corrupt the JSON.
 */
function scrubValue(value: unknown): unknown {
  if (typeof value === "string") return scrubText(value);
  if (Array.isArray(value)) return value.map(scrubValue);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        scrubText(k),
        scrubValue(v),
      ]),
    );
  }
  return value;
}

let filesChanged = 0;
let badLines = 0;
for (const name of readdirSync(RAW_DIR).sort()) {
  if (!name.endsWith(".jsonl")) continue;
  const path = join(RAW_DIR, name);
  const original = readFileSync(path, "utf8");
  const scrubbed = original
    .split("\n")
    .map((line) => {
      if (!line.trim()) return line;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        // Unparseable transcript lines can't be safely scrubbed field-by-field;
        // drop them rather than risk shipping unredacted content.
        badLines++;
        process.stderr.write(`✗ ${name}: dropping unparseable line\n`);
        return "";
      }
      return JSON.stringify(scrubValue(parsed));
    })
    .filter((line) => line !== "")
    .join("\n");
  const finalText = scrubbed.endsWith("\n") ? scrubbed : `${scrubbed}\n`;
  if (finalText !== original) {
    if (checkMode) {
      process.stderr.write(`✗ ${name}: NOT scrubbed (would change)\n`);
    } else {
      writeFileSync(path, finalText);
      process.stdout.write(`scrubbed ${name}\n`);
    }
    filesChanged++;
  } else if (!checkMode) {
    process.stdout.write(`clean    ${name}\n`);
  }
}

if (checkMode) {
  if (filesChanged > 0 || badLines > 0) {
    process.stderr.write(
      `✗ corpus dirty: ${filesChanged} file(s) need scrubbing, ${badLines} unparseable line(s). Run: npx tsx scripts/scrub-fixtures.ts\n`,
    );
    process.exit(1);
  }
  process.stdout.write("✓ corpus clean\n");
} else {
  process.stdout.write(
    `done — ${filesChanged} file(s) rewritten, ${badLines} bad line(s) dropped\n`,
  );
  // Dropped lines change parse-visible content; force a human to notice.
  if (badLines > 0) process.exit(1);
}
