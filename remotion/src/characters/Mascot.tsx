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
  style?: CSSProperties;
}> = ({ character, emotion, pose, size = 240, seed = character, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phase = random(`mascot-${seed}`) * 60;
  const t = frame + phase;

  // Pose engagement springs, from the start of the enclosing sequence.
  const settle = spring({ frame, fps, config: { damping: 200 } });
  const bounce = spring({ frame, fps, config: { damping: 9, stiffness: 130 } });
  const slump = spring({ frame, fps, config: { damping: 16, stiffness: 60 } });

  let rig: RigTransforms;
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
      const alt = Math.sin(t * 0.55);
      rig = {
        body: rot(2 * settle, PIVOT.body),
        head: `${rot(2 * settle, PIVOT.head)} translate(0 ${(Math.sin(t * 0.55 + 1) * 1.5).toFixed(2)})`,
        armL: rot(30 + 9 * alt, PIVOT.armL),
        armR: rot(-30 + 9 * alt * -1, PIVOT.armR),
      };
      break;
    }
    case "point": {
      rig = {
        body: rot(-2 * settle, PIVOT.body),
        head: rot(-3 * settle, PIVOT.head),
        armL: rot(6 * settle, PIVOT.armL),
        // the money gesture: right arm swings up-forward with a little overshoot
        armR: rot(-125 * bounce, PIVOT.armR),
      };
      break;
    }
    case "cheer": {
      const jump = Math.abs(Math.sin(t * 0.22)) * 9;
      rig = {
        body: `translate(0 ${(-jump * bounce).toFixed(2)})`,
        head: rot(Math.sin(t * 0.22) * 4 * bounce, PIVOT.head),
        armL: rot(135 * bounce, PIVOT.armL),
        armR: rot(-135 * bounce, PIVOT.armR),
      };
      break;
    }
    case "collapse": {
      rig = {
        body: `translate(0 ${(8 * slump).toFixed(2)}) ${rot(6 * slump, PIVOT.body)}`,
        head: rot(13 * slump, PIVOT.head),
        armL: rot(-7 * slump, PIVOT.armL),
        armR: rot(7 * slump, PIVOT.armR),
      };
      break;
    }
  }

  // Cursor blink: brief, every ~2.4s, character-desynced.
  const blink = (frame + Math.floor(phase)) % 72 < 5;

  const Char = character === "agent" ? Agent : User;
  return (
    <svg
      width={(size * 200) / 240}
      height={size}
      viewBox={RIG_VIEWBOX}
      style={style}
      role="img"
      aria-label={`${character} mascot, ${emotion}, ${pose}`}
    >
      <Char emotion={emotion} rig={rig} blink={blink} />
    </svg>
  );
};
