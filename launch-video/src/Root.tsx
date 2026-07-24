import React from "react";
import { Composition } from "remotion";
import { LaunchVideo, TOTAL_DURATION } from "./LaunchVideo";
import { waitUntilDone } from "./fonts";

const FPS = 30;

// Block rendering until Inter is ready so no frame falls back to a system font.
waitUntilDone();

/**
 * Two compositions off the same scenes:
 *   • FitMessLaunch          — 1920×1080 hero cut (YouTube, site, decks)
 *   • FitMessLaunchVertical  — 1080×1920 social cut (Reels, TikTok, Stories)
 * Scenes read useVideoConfig() and re-flow for the aspect ratio.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 9:16 is the primary cut — phone-first product, phone-first video. */}
      <Composition
        id="FitMessLaunchVertical"
        component={LaunchVideo}
        durationInFrames={TOTAL_DURATION}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="FitMessLaunch"
        component={LaunchVideo}
        durationInFrames={TOTAL_DURATION}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </>
  );
};
