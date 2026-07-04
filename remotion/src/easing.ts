import { Easing } from "remotion";

/**
 * The two easing curves of the classic pack, exported once (issue #13) —
 * new code imports these instead of re-declaring the bezier literals.
 *
 * EASE_OUT: fast start, long settle — entrances and reveals.
 * EASE_BACK_OUT: overshoots ~6% then settles — pops with personality
 * (speech bubbles, stat tiles, corner-mascot reactions).
 */
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_BACK_OUT = Easing.bezier(0.34, 1.56, 0.64, 1);
