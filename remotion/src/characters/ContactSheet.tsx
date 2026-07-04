import { AbsoluteFill } from "remotion";
import type { Emotion } from "../screenplay";
import { theme } from "../theme";
import { Mascot, type Character, type Pose } from "./Mascot";

/**
 * The acceptance harness from docs/characters.md: every character × emotion
 * × pose in one grid still. Character work is judged by looking at this one
 * PNG — regenerate with `npm run contact-sheet` on every change.
 * The footer renders both puppets at 120px, the corner-reaction size floor.
 */

export const CONTACT_SHEET_WIDTH = 1800;
export const CONTACT_SHEET_HEIGHT = 3260;
/** Frame where entrance springs have landed but cycles are mid-swing. */
export const CONTACT_SHEET_FRAME = 45;

const EMOTIONS: Emotion[] = [
  "neutral",
  "confident",
  "confused",
  "panicking",
  "smug",
  "defeated",
  "celebrating",
];
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

      {/* column headers: the Emotion enum, in schema order */}
      <div style={{ display: "flex", marginLeft: LABEL_W }}>
        {EMOTIONS.map((e) => (
          <div
            key={e}
            style={{
              width: CELL_W,
              fontSize: 24,
              color: theme.textDim,
              textAlign: "center",
            }}
          >
            {e}
          </div>
        ))}
      </div>

      {CHARACTERS.map((character) =>
        POSES.map((pose) => (
          <div
            key={`${character}-${pose}`}
            style={{ display: "flex", alignItems: "center", height: 265 }}
          >
            <div style={{ width: LABEL_W, fontSize: 26 }}>
              <span style={{ color: character === "agent" ? theme.purple : theme.blue }}>
                {character}
              </span>
              <span style={{ color: theme.textDim }}> · {pose}</span>
            </div>
            {EMOTIONS.map((emotion) => (
              <div
                key={emotion}
                style={{
                  width: CELL_W,
                  display: "flex",
                  justifyContent: "center",
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
            ))}
          </div>
        )),
      )}

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
