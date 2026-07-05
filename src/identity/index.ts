/**
 * Resolve the current user's GitHub identity into a rendered pixel-art head
 * + body tint (docs/characters.md, docs/security-and-privacy.md "GitHub
 * identity carve-out"). Runs entirely at pipeline time — never inside a
 * Remotion composition (no network in compositions, same rule as
 * voiceover). Any failure at any step (no login, offline, private profile,
 * undecodable image) falls back to a deterministic initials tile; this
 * function never throws and never blocks the render beyond the avatar
 * fetch's own timeout.
 */
import { fetchAvatar } from "./fetch.js";
import { initialsFallback } from "./initials.js";
import { boxDownscale, clampTint, dominantColor, quantize, rasterToPngDataUri, type Raster } from "./pixelate.js";
import { resolveDisplayName, resolveGitHubLogin } from "./resolve.js";
import type { UserIdentity } from "./types.js";

const HEAD_SIZE = 48;
const PALETTE_SIZE = 32;

export interface ResolveUserIdentityDeps {
  /** Defaults to resolveGitHubLogin — injectable for tests, no mocking framework needed. */
  resolveLogin?: () => string | null;
  /** Defaults to fetchAvatar — injectable for tests, no mocking framework needed. */
  fetchAvatarImpl?: (login: string) => Promise<Raster | null>;
  /** Defaults to resolveDisplayName — injectable for tests, no mocking framework needed. */
  displayName?: (login: string | null) => string;
}

export async function resolveUserIdentity(deps: ResolveUserIdentityDeps = {}): Promise<UserIdentity> {
  const resolveLogin = deps.resolveLogin ?? resolveGitHubLogin;
  const fetchAvatarImpl = deps.fetchAvatarImpl ?? fetchAvatar;
  const displayName = deps.displayName ?? resolveDisplayName;

  let login: string | null = null;
  try {
    login = resolveLogin();
    if (login) {
      const avatar = await fetchAvatarImpl(login);
      if (avatar) {
        const head = quantize(boxDownscale(avatar, HEAD_SIZE), PALETTE_SIZE);
        return {
          headDataUri: rasterToPngDataUri(head),
          bodyTint: clampTint(dominantColor(avatar)),
          fallback: false,
        };
      }
    }
  } catch {
    // fall through to the initials tile below — never throw, never block the render.
  }

  const { headDataUri, bodyTint } = initialsFallback(displayName(login));
  return { headDataUri, bodyTint, fallback: true };
}
