import { AbsoluteFill } from "remotion";
import type { Emotion } from "../screenplay";
import { theme } from "../theme";
import { Character, type Clip, type Who } from "./Character";
import { DEFAULT_IDENTITY, IdentityContext, type UserIdentity } from "./identity";
import { EMOTIONS } from "./rig";

export const CONTACT_SHEET_WIDTH = 1800;
export const CONTACT_SHEET_HEIGHT = 1520;
/** MIRROR: remotion/package.json `contact-sheet` passes --frame=45 — keep in sync. */
export const CONTACT_SHEET_FRAME = 45;

/** Every other cell renders DEFAULT_IDENTITY (empty headDataUri), so the
 * <image> raster path never gets exercised. A hardcoded 8x8 coral/ink
 * checkerboard PNG (deterministic, no generation code) verifies it once. */
const SAMPLE_IDENTITY: UserIdentity = {
  headDataUri:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAGUlEQVR42mN40BDDzc2LSTJgFQWSDINSBwB14TvhSMwhIQAAAABJRU5ErkJggg==",
  bodyTint: "#5A7CA6",
  fallback: false,
};

const CLIPS: Clip[] = ["idle", "walk", "typing", "thinking", "celebrate", "error-shake", "subagent-spawn"];
const WHO: Who[] = ["claude", "user"];
const CELL_W = 210, LABEL_W = 230;

export const ContactSheet: React.FC = () => (
  <IdentityContext.Provider value={DEFAULT_IDENTITY}>
    <AbsoluteFill style={{ backgroundColor: theme.bg, fontFamily: theme.mono, color: theme.textPrimary, padding: 40 }}>
      <div style={{ fontSize: 44, marginBottom: 8 }}>sessionmovie characters — contact sheet</div>
      <div style={{ fontSize: 26, color: theme.textDim, marginBottom: 30 }}>
        agent × 7 emotions · both × 7 clips · flat tokens · frame {CONTACT_SHEET_FRAME}
      </div>

      {/* agent emotions (eyes carry emotion; idle clip) */}
      <div style={{ display: "grid", gridTemplateColumns: `${LABEL_W}px repeat(${EMOTIONS.length}, ${CELL_W}px)`, gridTemplateRows: "auto 265px", alignItems: "center" }}>
        <div />
        {EMOTIONS.map((e) => <div key={e} style={{ fontSize: 24, color: theme.textDim, textAlign: "center", alignSelf: "start" }}>{e}</div>)}
        <div style={{ fontSize: 26 }}><span style={{ color: theme.accent }}>claude</span><span style={{ color: theme.textDim }}> · idle</span></div>
        {EMOTIONS.map((emotion) => (
          <div key={emotion} style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", borderLeft: `1px solid ${theme.panelBorder}` }}>
            <Character who="claude" emotion={emotion} clip="idle" sizePx={240} seed={`c-${emotion}`} blink={false} />
          </div>
        ))}
      </div>

      {/* clips × both characters (user uses the default head) */}
      <div style={{ display: "grid", gridTemplateColumns: `${LABEL_W}px repeat(${CLIPS.length}, ${CELL_W}px)`, gridTemplateRows: `auto repeat(${WHO.length}, 265px)`, alignItems: "center", marginTop: 20 }}>
        <div />
        {CLIPS.map((c) => <div key={c} style={{ fontSize: 22, color: theme.textDim, textAlign: "center", alignSelf: "start" }}>{c}</div>)}
        {WHO.flatMap((who) => [
          <div key={who} style={{ fontSize: 26, color: who === "claude" ? theme.accent : DEFAULT_IDENTITY.bodyTint }}>{who}</div>,
          ...CLIPS.map((clip) => (
            <div key={`${who}-${clip}`} style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", borderLeft: `1px solid ${theme.panelBorder}` }}>
              <Character who={who} emotion="neutral" clip={clip} sizePx={240} seed={`${who}-${clip}`} blink={false} />
            </div>
          )),
        ])}
      </div>

      {/* 120px floor */}
      <div style={{ display: "flex", alignItems: "center", gap: 40, marginTop: 30, paddingTop: 24, borderTop: `1px solid ${theme.panelBorder}` }}>
        <div style={{ width: LABEL_W, fontSize: 26, color: theme.textDim }}>120px check</div>
        {(["neutral", "panicking", "celebrating"] as Emotion[]).map((emotion) => (
          <div key={emotion} style={{ display: "flex", gap: 16 }}>
            <Character who="claude" emotion={emotion} sizePx={120} seed={`s-c-${emotion}`} blink={false} />
            <Character who="user" emotion={emotion} sizePx={120} seed={`s-u-${emotion}`} blink={false} />
          </div>
        ))}
      </div>

      {/* raster head check: DEFAULT_IDENTITY above has no headDataUri, so this
          is the only cell that exercises the <image>/pixelated raster path. */}
      <div style={{ display: "flex", alignItems: "center", gap: 40, marginTop: 30, paddingTop: 24, borderTop: `1px solid ${theme.panelBorder}` }}>
        <div style={{ width: LABEL_W, fontSize: 26, color: theme.textDim }}>raster head</div>
        <IdentityContext.Provider value={SAMPLE_IDENTITY}>
          <Character who="user" emotion="neutral" sizePx={240} seed="raster-240" blink={false} />
          <Character who="user" emotion="neutral" sizePx={120} seed="raster-120" blink={false} />
        </IdentityContext.Provider>
      </div>
    </AbsoluteFill>
  </IdentityContext.Provider>
);
