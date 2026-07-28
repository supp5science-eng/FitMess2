/**
 * Trčanje (F-runs): pure pace arithmetic + formatting, and the per-kilometre
 * split breakdown the run-detail screen draws as a little bar chart.
 *
 * Pace is the runner's headline number, so it lives here (money-math rule),
 * computed off the same trusted segments as distance/duration — never derived
 * separately in a component where it could drift from the distance shown.
 */

import {
  type RunSegment,
  sumDistanceM,
  toRunSegments,
} from "@/lib/run/distance";
import type { RunRoutePoint } from "@/lib/types/db";

/**
 * Average pace in seconds per kilometre, or `null` when there is no distance to
 * divide by (a zero-distance run has no pace — the UI shows "—", not "∞").
 */
export function paceSecPerKm(
  distanceM: number,
  durationS: number
): number | null {
  if (distanceM <= 0 || durationS <= 0) return null;
  return durationS / (distanceM / 1000);
}

/**
 * Format a whole-second duration as `M:SS` (or `H:MM:SS` past an hour). Used
 * for the elapsed timer and each split's time; negative/NaN clamps to `0:00`.
 */
export function formatDuration(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
  const whole = Math.round(safe);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = whole % 60;
  const ss = String(seconds).padStart(2, "0");

  if (hours > 0) {
    const mm = String(minutes).padStart(2, "0");
    return `${hours}:${mm}:${ss}`;
  }
  return `${minutes}:${ss}`;
}

/**
 * Format a pace (sec/km) as `M:SS` — e.g. `337` → `"5:37"`. `null` (no pace
 * yet) renders as an em dash so the recording screen has something calm to show
 * before the first fixes land.
 */
export function formatPace(secPerKm: number | null): string {
  if (secPerKm === null || !Number.isFinite(secPerKm) || secPerKm <= 0) {
    return "—";
  }
  const whole = Math.round(secPerKm);
  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** One kilometre (or the trailing partial) of a run, for the splits chart. */
export interface Split {
  /** 1-based split index. */
  km: number;
  /** Metres in this split — `1000` for a full km, `< 1000` for the last one. */
  distanceM: number;
  /** Whole seconds spent covering this split. */
  seconds: number;
  /** Pace over this split in sec/km (normalised, so the partial is comparable). */
  paceSecPerKm: number;
  /** True for the trailing sub-kilometre remainder. */
  partial: boolean;
}

/**
 * Break the run into per-kilometre splits from its moving segments. Kilometre
 * boundaries that fall inside a segment are interpolated by time (constant
 * speed within a leg), and any leftover distance past the last whole kilometre
 * becomes a final `partial` split so the chart accounts for the whole run.
 *
 * Returns `[]` for a run with no moving segments.
 */
export function computeSplitsFromSegments(
  segments: readonly RunSegment[]
): Split[] {
  if (segments.length === 0) return [];

  const startMs = segments[0].tStartMs;
  const endMs = segments[segments.length - 1].tEndMs;
  const total = sumDistanceM(segments);
  const fullKm = Math.floor(total / 1000);

  // Time (ms since start) at each whole-kilometre boundary, interpolated.
  const boundaryTimes: number[] = [];
  let cumulative = 0;
  let nextBoundary = 1000;
  for (const seg of segments) {
    const legStart = cumulative;
    const legEnd = cumulative + seg.distanceM;
    while (nextBoundary <= legEnd && boundaryTimes.length < fullKm) {
      const frac =
        seg.distanceM > 0 ? (nextBoundary - legStart) / seg.distanceM : 0;
      boundaryTimes.push(seg.tStartMs + frac * (seg.tEndMs - seg.tStartMs));
      nextBoundary += 1000;
    }
    cumulative = legEnd;
  }

  const splits: Split[] = [];
  let prevMs = startMs;
  for (let k = 1; k <= fullKm; k++) {
    const boundaryMs = boundaryTimes[k - 1];
    const seconds = Math.round((boundaryMs - prevMs) / 1000);
    splits.push({
      km: k,
      distanceM: 1000,
      seconds,
      paceSecPerKm: seconds,
      partial: false,
    });
    prevMs = boundaryMs;
  }

  const remaining = total - fullKm * 1000;
  if (remaining >= 1) {
    const seconds = Math.round((endMs - prevMs) / 1000);
    const pace = seconds / (remaining / 1000);
    splits.push({
      km: fullKm + 1,
      distanceM: Math.round(remaining),
      seconds,
      paceSecPerKm: Math.round(pace),
      partial: true,
    });
  }

  return splits;
}

/** Convenience: per-kilometre splits straight from a raw GPS trace. */
export function computeSplits(points: readonly RunRoutePoint[]): Split[] {
  return computeSplitsFromSegments(toRunSegments(points));
}
