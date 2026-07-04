#!/usr/bin/env node
/**
 * npx sessionmovie … — the published binary.
 *
 * Routing only: `sessionmovie doctor` runs the setup checks; everything else
 * is the movie pipeline. The dynamic imports are load-bearing — both modules
 * execute at import time, so importing eagerly would run both.
 */
if (process.argv[2] === "doctor") {
  process.argv.splice(2, 1);
  await import("./doctor.js");
} else {
  await import("./movie.js");
}
