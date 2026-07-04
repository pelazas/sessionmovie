# Security & privacy

## Redaction is a v1 blocker, not a nice-to-have

Transcripts contain whatever the session saw: `.env` contents cat'd during debugging, API keys in error messages, internal URLs, proprietary code in diffs, usernames in paths. And this product's entire purpose is **making transcripts shareable**. One viral clip with a live AWS key in a diff panel kills the project's reputation permanently.

Therefore: **no string reaches a rendered frame without passing the redaction layer.** This is enforced architecturally — redaction runs in the parser, at the door, so nothing unredacted exists downstream. No render path may bypass it.

## The redaction layer

Applied to every piece of displayable content (messages, tool inputs/outputs, diffs, command output, file paths):

1. **Secret-pattern regexes** — known key shapes (AWS `AKIA…`, GitHub `ghp_`/`gho_`, Slack, Stripe, JWTs, private key blocks, connection strings, `Authorization:` headers…). Start from trufflehog/gitleaks pattern sets.
2. **Entropy detection** — high-entropy tokens above a length threshold that match no known pattern get masked as probable secrets.
3. **Environment heuristics** — values of variables whose names match `*_KEY|*_TOKEN|*_SECRET|*_PASSWORD` anywhere they appear.
4. **PII scrubbing** — home-directory usernames in paths (`/Users/<name>/…` → `~/…`), email addresses, hostnames/internal IPs (configurable).

Masked content renders as a styled `••••` chip — visibly redacted, not silently altered, so the human can spot over- or under-redaction in preview.

## Preview before share

The CLI's stance is **render → show → human eyeballs it**. Output lands locally; nothing is uploaded anywhere, ever, by this tool. The final gate is the user watching their own movie before posting it — the tool's job is to make that gate effective (visible redaction chips, a `--list-redactions` report of what was masked and why).

## Configuration

- `.sessionmovie.json` (per-repo or global): extra patterns, allowlist (things safe to show), denylist (paths/files never to display — e.g. `**/.env*`, `**/secrets/**` content is never displayed, only referenced by name).
- `--private` flag: aggressive mode — masks all string literals in diffs and all command output, keeping only structure (for movies of proprietary codebases).

## Honest limitations

- Redaction is pattern-based; novel secret formats can slip through. The preview step is the real backstop — the tool reduces risk, the human owns the final check, and the docs say so plainly.
- Bash-driven file changes aren't in the transcript (v1 limitation), which also means they can't leak — but a later shadow-git capture mode must route through the same redaction layer before anything renders.
- Fixture transcripts committed to `fixtures/` must themselves be redacted before commit (they're real sessions). The gate is `npx tsx scripts/scrub-fixtures.ts --check` — run it as a pre-commit hook locally (CI runs the same command, but only as a backstop: on a public repo, a secret that reaches the remote is already exposed *before* CI goes red, so the pre-push check is the one that matters).
- Scrubbing removes secrets and PII, **not meaning**. A fixture whose *content* is sensitive (private conversations, third parties, personal projects, anything you wouldn't publish as prose) stays out of the corpus no matter how clean it greps — a human reads every fixture before it's committed. This is a review gate, not a script.
