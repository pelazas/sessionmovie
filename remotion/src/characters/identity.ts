import { createContext, useContext } from "react";

/** User identity, resolved CLI-side (PR-F) and delivered via the `identity`
 * input-props sidecar (same plumbing as factTiles). The renderer only displays. */
export interface UserIdentity {
  headDataUri: string; // 48x48 PNG data URI (image-rendering:pixelated), or "" when none
  bodyTint: string;    // hex; CLI clamps HSL to L 0.45-0.65, S 0.35-0.8
  fallback: boolean;   // true = generated/default head, not the real avatar
}

export const DEFAULT_IDENTITY: UserIdentity = { headDataUri: "", bodyTint: "#5A7CA6", fallback: true };
export const IdentityContext = createContext<UserIdentity>(DEFAULT_IDENTITY);
export const useIdentity = (): UserIdentity => useContext(IdentityContext);
