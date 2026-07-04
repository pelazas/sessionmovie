import type { CSSProperties } from "react";
import { random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Emotion } from "../screenplay";
import { Agent } from "./Agent";
import { User } from "./User";
import { PIVOT, RIG_VIEWBOX, type RigTransforms } from "./rig";

/**
 * The puppet driver: swaps face groups by emotion and drives pose presets
 * as spring/sine transforms on the rig groups. South Park-level motion —
 * a handful of rotating groups reads as fully animated at 30fps.
 *
 * Determinism rules apply: seeded random() for phase offsets only, no
 * Math.random()/Date.now(). Same frame → same transform, always.
 */

export type Character = "agent" | "user";
export type Pose = "idle" | "typing" | "point" | "cheer" | "collapse";

const rot = (deg: number, pivot: readonly [number, number] | readonly number[]): string =>
  `rotate(${deg} ${pivot[0]} ${pivot[1]})`;

export const Mascot: React.FC<{
  character: Character;
  emotion: Emotion;
  pose: Pose;
  /** Rendered height in px; width follows the rig's 200:240 aspect. */
  size?: number;
  /** Desynchronizes phase so two mascots never move in lockstep. */
  seed?: string;
  /** Cursor-blink toggle — the contact sheet disables it so its fixed capture frame never shows mid-blink eyes. */
  blink?: boolean;
  style?: CSSProperties;
}> = ({ character, emotion, pose, size = 240, seed = character, blink = true, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phase = random(`mascot-${seed}`) * 60;
  const t = frame + phase;

  // Pose engagement springs, from the start of the enclosing sequence.
  // Computed only by the poses that use them — springs aren't free, and a
  // contact sheet renders dozens of puppets per frame.
  const settle = () => spring({ frame, fps, config: { damping: 200 } });
  const bounce = () => spring({ frame, fps, config: { damping: 9, stiffness: 130 } });
  const slump = () => spring({ frame, fps, config: { damping: 16, stiffness: 60 } });

  let rig: RigTransforms;
  // cheer lifts the WHOLE puppet (legs included) — a jump, not a torso detaching
  // from its shoes. Applied on the svg wrapper, outside the rig groups.
  let lift = 0;
  switch (pose) {
    case "idle": {
      const bob = Math.sin(t * 0.08) * 3;
      rig = {
        body: `translate(0 ${bob.toFixed(2)})`,
        head: rot(Math.sin(t * 0.05) * 2, PIVOT.head),
        armL: rot(Math.sin(t * 0.08) * 4, PIVOT.armL),
        armR: rot(Math.sin(t * 0.08 + Math.PI) * 4, PIVOT.armR),
      };
      break;
    }
    case "typing": {
      const s = settle();
      const alt = Math.sin(t * 0.55);
      rig = {
        body: rot(2 * s, PIVOT.body),
        head: `${rot(2 * s, PIVOT.head)} translate(0 ${(Math.sin(t * 0.55 + 1) * 1.5).toFixed(2)})`,
        armL: rot(30 + 9 * alt, PIVOT.armL),
        armR: rot(-30 + 9 * alt * -1, PIVOT.armR),
      };
      break;
    }
    case "point": {
      const s = settle();
      const b = bounce();
      rig = {
        body: rot(-2 * s, PIVOT.body),
        head: rot(-3 * s, PIVOT.head),
        armL: rot(6 * s, PIVOT.armL),
        // the money gesture: right arm swings up-forward with a little overshoot
        armR: rot(-125 * b, PIVOT.armR),
      };
      break;
    }
    case "cheer": {
      const b = bounce();
      const jump = Math.abs(Math.sin(t * 0.22)) * 9;
      lift = jump * b;
      rig = {
        head: rot(Math.sin(t * 0.22) * 4 * b, PIVOT.head),
        armL: rot(135 * b, PIVOT.armL),
        armR: rot(-135 * b, PIVOT.armR),
      };
      break;
    }
    case "collapse": {
      const sl = slump();
      rig = {
        body: `translate(0 ${(8 * sl).toFixed(2)}) ${rot(6 * sl, PIVOT.body)}`,
        head: rot(13 * sl, PIVOT.head),
        armL: rot(-7 * sl, PIVOT.armL),
        armR: rot(7 * sl, PIVOT.armR),
      };
      break;
    }
  }

  // Cursor blink: brief, every ~2.4s, character-desynced.
  const blinking = blink && (frame + Math.floor(phase)) % 72 < 5;

  const Char = character === "agent" ? Agent : User;
  return (
    <svg
      width={(size * 200) / 240}
      height={size}
      viewBox={RIG_VIEWBOX}
      style={
        lift > 0
          ? { ...style, transform: `translateY(${(-lift).toFixed(2)}px)` }
          : style
      }
      role="img"
      aria-label={`${character} mascot, ${emotion}, ${pose}`}
    >
      <Char emotion={emotion} rig={rig} blink={blinking} />
    </svg>
  );
};
