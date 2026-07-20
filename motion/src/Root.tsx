import React from "react";
import { Composition } from "remotion";
import { LaunchTeaser } from "./LaunchTeaser";

const FPS = 30;
const DURATION = 300; // 10s

/**
 * One teaser, three deliverables. Same component, different frame — Remotion
 * re-lays it out per aspect ratio (all sizing is relative to `height`).
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Instagram Reels / TikTok / Stories — app is phone-only, so this is the hero format */}
      <Composition
        id="LaunchTeaser"
        component={LaunchTeaser}
        durationInFrames={DURATION}
        fps={FPS}
        width={1080}
        height={1920}
      />
      {/* YouTube / landing-page hero embed */}
      <Composition
        id="LaunchTeaser16x9"
        component={LaunchTeaser}
        durationInFrames={DURATION}
        fps={FPS}
        width={1920}
        height={1080}
      />
      {/* Instagram feed post */}
      <Composition
        id="LaunchTeaser1x1"
        component={LaunchTeaser}
        durationInFrames={DURATION}
        fps={FPS}
        width={1080}
        height={1080}
      />
    </>
  );
};
