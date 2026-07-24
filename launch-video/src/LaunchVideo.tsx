import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { Hook } from "./scenes/Hook";
import { LogoReveal } from "./scenes/LogoReveal";
import { Problem } from "./scenes/Problem";
import { Promise as PromiseScene } from "./scenes/Promise";
import { FeatureDanas } from "./scenes/FeatureDanas";
import { FeatureAnalitika } from "./scenes/FeatureAnalitika";
import { FeatureDodaj } from "./scenes/FeatureDodaj";
import { FeatureGrid } from "./scenes/FeatureGrid";
import { Tagline } from "./scenes/Tagline";
import { Outro } from "./scenes/Outro";
import { theme } from "./theme";

/**
 * Scene running order + durations (frames @ 30fps). Edit these numbers to
 * re-time the film — everything downstream (total length) follows from here.
 * Each scene fades itself in/out, so plain back-to-back cuts read as soft dips.
 */
export const SCENES = [
  { Comp: Hook, duration: 100 },
  { Comp: LogoReveal, duration: 85 },
  { Comp: Problem, duration: 95 },
  { Comp: PromiseScene, duration: 90 },
  { Comp: FeatureDanas, duration: 120 },
  { Comp: FeatureAnalitika, duration: 120 },
  { Comp: FeatureDodaj, duration: 120 },
  { Comp: FeatureGrid, duration: 110 },
  { Comp: Tagline, duration: 90 },
  { Comp: Outro, duration: 110 },
] as const;

export const TOTAL_DURATION = SCENES.reduce((n, s) => n + s.duration, 0); // 1040

export const LaunchVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: theme.color.bg }}>
      <Series>
        {SCENES.map(({ Comp, duration }, i) => (
          <Series.Sequence key={i} durationInFrames={duration}>
            <Comp />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
