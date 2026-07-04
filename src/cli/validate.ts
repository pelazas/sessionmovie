/**
 * npm run validate -- <screenplay.json>
 *
 * Validates a screenplay file against the frozen IR schema.
 * Exits 0 when valid, 1 when not (with zod issue details).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ScreenplaySchema } from "../screenplay/schema.js";

const input = process.argv[2];
if (!input) {
  process.stderr.write("usage: npm run validate -- <screenplay.json>\n");
  process.exit(1);
}

const raw = JSON.parse(readFileSync(resolve(input), "utf8")) as unknown;
const result = ScreenplaySchema.safeParse(raw);

if (!result.success) {
  process.stderr.write(`✗ ${input} is NOT a valid screenplay:\n`);
  for (const issue of result.error.issues) {
    process.stderr.write(`  - ${issue.path.join(".") || "(root)"}: ${issue.message}\n`);
  }
  process.exit(1);
}

const { scenes, targetDurationSec } = result.data;
const sum = scenes.reduce((acc, s) => acc + s.targetSec, 0);
process.stdout.write(
  `✓ ${input} is a valid v${result.data.version} screenplay — ` +
    `${scenes.length} scenes (${scenes.map((s) => s.type).join(" → ")}), ` +
    `${sum}s of ${targetDurationSec}s target\n`,
);
