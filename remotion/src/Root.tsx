import "./index.css";
import { Composition } from "remotion";
import { Classic, totalFrames } from "./Classic";
import { sampleScreenplay } from "./screenplay/sample";

const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Classic"
      component={Classic}
      durationInFrames={totalFrames(sampleScreenplay, FPS)}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{ screenplay: sampleScreenplay }}
    />
  );
};
