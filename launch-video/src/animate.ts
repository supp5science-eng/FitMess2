import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Fade a scene in at the start and out at the end. Returns an opacity 0..1.
 * Keeps cuts between scenes soft without any extra wiring.
 */
export const useFadeInOut = (fadeIn = 12, fadeOut = 12): number => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return interpolate(
    frame,
    [0, fadeIn, durationInFrames - fadeOut, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
};

/**
 * A gentle push-up + settle used for cards/panels entering a scene.
 * Returns a translateY in px and an opacity.
 */
export const useRise = (
  delay = 0,
  distance = 40,
): { y: number; opacity: number } => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [delay, delay + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { y: (1 - p) * distance, opacity: p };
};
