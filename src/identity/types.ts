/**
 * GitHub identity types — a LEAF module (no imports) so the renderer can
 * type-only import it without dragging CLI/node code into remotion's
 * typecheck, exactly like src/facts/types.ts and src/voiceover/types.ts.
 *
 * Resolved CLI-side at pipeline time (docs/security-and-privacy.md "GitHub
 * identity carve-out"); rides the composition input props as a sidecar next
 * to facts/voiceover. The login/display name itself never reaches this
 * object — only the image and its derived tint.
 */

export interface UserIdentity {
  /** data:image/png;base64 — 48×48 palette-quantized avatar head, or the generated fallback tile. */
  headDataUri: string;
  /** Hex color for the character's body tint, HSL-clamped for legibility on the dark canvas. */
  bodyTint: string;
  /** true when the initials/identicon fallback was used (offline or no identity). */
  fallback: boolean;
}
