import { AbsoluteFill } from "remotion";
import type { Emotion } from "../screenplay";
import { theme } from "../theme";
import { Mascot, type Character, type Pose } from "./Mascot";
import { EMOTIONS } from "./rig";

/**
 * The acceptance harness from docs/characters.md: every character × emotion
 * × pose in one grid still. Character work is judged by looking at this one
 * PNG — regenerate with `npm run contact-sheet` on every change.
 * The footer renders both puppets at 120px, the corner-reaction size floor.
 */

export const CONTACT_SHEET_WIDTH = 1800;
export const CONTACT_SHEET_HEIGHT = 3260;
/**
 * Frame where entrance springs have landed but cycles are mid-swing.
 * MIRROR: remotion/package.json's `contact-sheet` script passes --frame=45 —
 * JSON can't import this constant (or carry a comment), so keep them in sync
 * by hand when changing either.
 */
export const CONTACT_SHEET_FRAME = 45;

const POSES: Pose[] = ["idle", "typing", "point", "cheer", "collapse"];
const CHARACTERS: Character[] = ["agent", "user"];

const CELL_W = 210;
const LABEL_W = 230;

export const ContactSheet: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        fontFamily: theme.mono,
        color: theme.text,
        padding: 40,
      }}
    >
      <div style={{ fontSize: 44, marginBottom: 8 }}>
        sessionmovie characters — contact sheet
      </div>
      <div style={{ fontSize: 26, color: theme.textDim, marginBottom: 30 }}>
        2 characters × 7 emotions × 5 poses · flat theme tokens · frame {CONTACT_SHEET_FRAME}
      </div>

      {/* the sheet: one CSS grid — label column + one column per Emotion,
          in schema order (EMOTIONS is exhaustiveness-checked in rig.tsx) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${LABEL_W}px repeat(${EMOTIONS.length}, ${CELL_W}px)`,
          gridTemplateRows: `auto repeat(${CHARACTERS.length * POSES.length}, 265px)`,
          alignItems: "center",
        }}
      >
        {/* header row */}
        <div style={{ height: "auto" }} />
        {EMOTIONS.map((e) => (
          <div
            key={e}
            style={{
              fontSize: 24,
              color: theme.textDim,
              textAlign: "center",
              alignSelf: "start",
            }}
          >
            {e}
          </div>
        ))}

        {CHARACTERS.flatMap((character) =>
          POSES.flatMap((pose) => [
            <div key={`${character}-${pose}`} style={{ fontSize: 26 }}>
              <span style={{ color: character === "agent" ? theme.purple : theme.blue }}>
                {character}
              </span>
              <span style={{ color: theme.textDim }}> · {pose}</span>
            </div>,
            ...EMOTIONS.map((emotion) => (
              <div
                key={`${character}-${pose}-${emotion}`}
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                  borderLeft: `1px solid ${theme.panelBorder}`,
                }}
              >
                <Mascot
                  blink={false}
                  character={character}
                  emotion={emotion}
                  pose={pose}
                  size={240}
                  seed={`${character}-${pose}-${emotion}`}
                />
              </div>
            )),
          ]),
        )}
      </div>

      {/* the 120px floor: corner-reaction size, must still read */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 40,
          marginTop: 30,
          paddingTop: 24,
          borderTop: `1px solid ${theme.panelBorder}`,
        }}
      >
        <div style={{ width: LABEL_W, fontSize: 26, color: theme.textDim }}>120px check</div>
        {(["neutral", "panicking", "celebrating"] as Emotion[]).map((emotion) => (
          <div key={emotion} style={{ display: "flex", gap: 16 }}>
            <Mascot character="agent" emotion={emotion} pose="idle" size={120} seed={`s-a-${emotion}`} blink={false} />
            <Mascot character="user" emotion={emotion} pose="idle" size={120} seed={`s-u-${emotion}`} blink={false} />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
