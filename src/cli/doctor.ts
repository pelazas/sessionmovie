/**
 * npx sessionmovie doctor
 *
 * Setup checks with honest progress and fix-it hints (the first-run UX in
 * docs/distribution-and-cost.md is binding: no silent multi-minute steps).
 * Exit 0 when everything is ready to render, 1 when something needs fixing.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { remotionCliInstalled, remotionDir, repoRoot, runNpx } from "./workspace.js";
import { checkApiKey } from "../voiceover/tts.js";

const MIN_NODE_MAJOR = 18;

let failures = 0;
const ok = (msg: string) => process.stdout.write(`✓ ${msg}\n`);
const bad = (msg: string, hint: string) => {
  failures++;
  process.stdout.write(`✗ ${msg}\n  fix: ${hint}\n`);
};

// First output within the first second.
process.stdout.write("🩺 sessionmovie doctor\n\n");

// 1. Node version — Remotion and this repo's tooling need a modern runtime.
const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor >= MIN_NODE_MAJOR) {
  ok(`node v${process.versions.node} (>= ${MIN_NODE_MAJOR} required)`);
} else {
  bad(
    `node v${process.versions.node} is too old (>= ${MIN_NODE_MAJOR} required)`,
    "install a current Node LTS, e.g. `nvm install --lts` or https://nodejs.org",
  );
}

// 2. Workspace install state — the Remotion CLI must be resolvable.
if (remotionCliInstalled()) {
  let version = "";
  try {
    for (const dir of [repoRoot, remotionDir]) {
      const pkg = join(dir, "node_modules", "@remotion", "cli", "package.json");
      try {
        version = (JSON.parse(readFileSync(pkg, "utf8")) as { version: string }).version;
        break;
      } catch {
        // try the other location
      }
    }
  } catch {
    // version stays cosmetic-only
  }
  ok(`workspace installed (@remotion/cli${version ? ` ${version}` : ""} resolvable)`);
} else {
  bad(
    "workspace not installed — @remotion/cli is not resolvable",
    `run \`npm install\` in ${repoRoot}`,
  );
}

// 3. Headless browser — Remotion downloads one on first use; make that an
// explicit, visible step here instead of a silent hang inside `render`.
if (remotionCliInstalled()) {
  process.stdout.write(
    "… checking headless browser (this downloads ~150 MB the first time — progress below)\n",
  );
  const code = await runNpx(["remotion", "browser", "ensure"]);
  if (code === 0) {
    ok("headless browser present");
  } else {
    bad(
      `\`npx remotion browser ensure\` failed (exit ${code})`,
      "re-run `sessionmovie doctor` (flaky downloads happen); check network/proxy settings",
    );
  }
} else {
  process.stdout.write("- headless browser check skipped (install the workspace first)\n");
}

// 4. ffmpeg — deliberately NOT a requirement; say so to preempt the question.
ok("ffmpeg not required — Remotion bundles its own encoder");

// 5. ElevenLabs key — voiceover is opt-in (docs/audio.md), so no key is fine;
// a key that IS set gets validated now so it fails here, not mid-render.
const elevenLabsKey = process.env["ELEVENLABS_API_KEY"];
if (!elevenLabsKey) {
  process.stdout.write(
    "- voiceover skipped — ELEVENLABS_API_KEY not set (voiceover is opt-in)\n",
  );
} else {
  const keyCheck = await checkApiKey(elevenLabsKey);
  if (keyCheck.ok) {
    ok("ELEVENLABS_API_KEY accepted by ElevenLabs");
  } else if (keyCheck.kind === "invalid") {
    bad(
      `ELEVENLABS_API_KEY rejected by ElevenLabs (${keyCheck.detail})`,
      "create a fresh key at https://elevenlabs.io (Profile → API keys) and re-export ELEVENLABS_API_KEY",
    );
  } else {
    bad(
      `could not validate ELEVENLABS_API_KEY — ElevenLabs unreachable (${keyCheck.detail})`,
      "check network/proxy and re-run doctor; or unset ELEVENLABS_API_KEY to render without voiceover",
    );
  }
}

process.stdout.write("\n");
if (failures === 0) {
  process.stdout.write("🎬 all checks passed — `sessionmovie <transcript.jsonl>` is ready\n");
} else {
  process.stdout.write(`${failures} check(s) failed — see fixes above, then re-run doctor\n`);
  process.exit(1);
}
