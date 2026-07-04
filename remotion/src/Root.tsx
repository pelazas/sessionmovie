import "./index.css";
import { Composition } from "remotion";
import {
  CONTACT_SHEET_HEIGHT,
  CONTACT_SHEET_WIDTH,
  ContactSheet,
} from "./characters/ContactSheet";
import { PACKS, makePackComposition } from "./packs";
import type { Screenplay } from "./screenplay";
import { totalFrames } from "./timing";
import sampleJson from "../../fixtures/screenplays/sample.json";

const FPS = 30;

// The canonical fixture is schema-validated by `npm run validate` (CI);
// the JSON import is display data, not a trusted boundary.
const sampleScreenplay = sampleJson as unknown as Screenplay;

// Built once at module scope: inline makePackComposition(pack) in the JSX would
// mint a new component identity on every RemotionRoot render (Studio remounts).
const PACK_COMPOSITIONS = PACKS.map((pack) => ({
  pack,
  PackComp: makePackComposition(pack),
}));

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* One composition per registered genre pack (docs/genre-packs.md). */}
      {PACK_COMPOSITIONS.map(({ pack, PackComp }) => (
        <Composition
          key={pack.id}
          id={pack.compositionId}
          component={PackComp}
          fps={FPS}
          width={1080}
          height={1920}
          defaultProps={sampleScreenplay}
          // Duration always derives from the screenplay actually being rendered —
          // including one injected via --props — never from the default fixture.
          calculateMetadata={({ props }) => ({
            durationInFrames: totalFrames(props, FPS),
          })}
        />
      ))}
      {/* Character acceptance harness — rendered as a still by `npm run contact-sheet`.
          A timed Composition (not <Still>) so pose springs can be sampled mid-motion. */}
      <Composition
        id="ContactSheet"
        component={ContactSheet}
        fps={FPS}
        width={CONTACT_SHEET_WIDTH}
        height={CONTACT_SHEET_HEIGHT}
        durationInFrames={90}
      />
    </>
  );
};
