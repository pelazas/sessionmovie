/**
 * Regenerate fixtures/golden/*.json from fixtures/raw/*.jsonl.
 * Run after intentional parser/screenwriter behavior changes:
 *
 *   npx tsx scripts/update-golden.ts
 *
 * Then review the diff — goldens are the eval set; unexplained changes
 * are regressions, not noise.
 */
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { snapshotFixture } from "./golden.js";

const RAW_DIR = join(import.meta.dirname, "..", "fixtures", "raw");
const GOLDEN_DIR = join(import.meta.dirname, "..", "fixtures", "golden");

mkdirSync(GOLDEN_DIR, { recursive: true });
for (const name of readdirSync(RAW_DIR).sort()) {
  if (!name.endsWith(".jsonl")) continue;
  const slug = name.replace(/\.jsonl$/, "");
  const snapshot = snapshotFixture(join(RAW_DIR, name), name);
  writeFileSync(join(GOLDEN_DIR, `${slug}.json`), `${JSON.stringify(snapshot, null, 2)}\n`);
  process.stdout.write(`golden: ${slug} → ${snapshot.result.kind}\n`);
}
