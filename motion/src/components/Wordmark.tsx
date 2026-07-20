import React from "react";
import { useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { theme } from "../theme";
import { archivoFamily } from "../fonts";

/**
 * "FitMess" brand lockup. The dot on the "i" pops as a teal beat, echoing the
 * app's single-accent identity.
 */
export const Wordmark: React.FC<{ size?: number; startAt?: number }> = ({
  size = 130,
  startAt = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rise = spring({
    frame: frame - startAt,
    fps,
    config: { damping: 200, stiffness: 55 },
    durationInFrames: 40,
  });
  const y = interpolate(rise, [0, 1], [40, 0]);
  const dotPop = spring({
    frame: frame - startAt - 14,
    fps,
    config: { damping: 12, stiffness: 180 },
  });

  return (
    <div
      style={{
        fontFamily: archivoFamily,
        fontSize: size,
        letterSpacing: -size * 0.02,
        color: theme.fg,
        opacity: rise,
        transform: `translateY(${y}px)`,
        display: "flex",
        alignItems: "flex-start",
        lineHeight: 1,
      }}
    >
      <span>F</span>
      <span style={{ position: "relative" }}>
        it
        {/* teal dot on the i */}
        <span
          style={{
            position: "absolute",
            top: -size * 0.02,
            right: size * 0.03,
            width: size * 0.12,
            height: size * 0.12,
            borderRadius: "50%",
            background: theme.brand,
            transform: `scale(${dotPop})`,
            boxShadow: `0 0 ${size * 0.2}px ${theme.brand}`,
          }}
        />
      </span>
      <span style={{ color: theme.brand }}>Mess</span>
    </div>
  );
};
