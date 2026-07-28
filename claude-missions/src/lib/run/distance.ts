/**
 * Trčanje (F-runs): pure, DB-free geometry that turns a raw GPS trace into the
 * "moving" segments every run number is derived from.
 *
 * Same "money-math rule" as the rest of the app: deterministic code computes
 * every figure the UI shows (distance, pace, calories) — the recording screen
 * only samples `navigator.geolocation.watchPosition` and paints pixels; it
 * never eyeballs a total.
 *
 * A raw phone GPS trace is noisy: it jitters a metre or two while you stand
 * still, it "teleports" when a fix is briefly lost and regained, and it leaves
 * a large time gap across a Pauza/Nastavi. `toRunSegments` is the single filter
 * that rejects all three, so distance, active duration, and the per-km splits
 * are all computed off the same trusted segment list and can never disagree.
 */

import type { RunRoutePoint } from "@/lib/types/db";

/** A single GPS reading — the `lat`/`lng` half of a {@link RunRoutePoint}. */
export type GeoPoint = Pick<RunRoutePoint, "lat" | "lng">;

/**
 * Fastest a human runs (~12.4 m/s is the 100 m world-record pace). A segment
 * implying more than this is a lost-and-regained-fix "teleport", not running,
 * so its distance is dropped rather than added to the total.
 */
export const MAX_PLAUSIBLE_SPEED_MPS = 12.5;

/**
 * A gap longer than this between two fixes is treated as a pause boundary
 * (Pauza → Nastavi, or a tunnel) rather than moving time: the segment counts
 * toward neither distance nor active duration.
 */
export const MAX_ACTIVE_GAP_MS = 20_000;

/**
 * Sub-metre-and-a-half hops are stationary GPS drift, not travel. Dropping them
 * keeps a run logged while you wait at a crossing from slowly inflating the
 * distance (and deflating the pace).
 */
export const MIN_SEGMENT_METERS = 1.5;

/** Mean Earth radius in metres (WGS84 sphere approximation). */
const EARTH_RADIUS_M = 6_371_000;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Great-circle distance between two lat/lng points in metres (haversine).
 * Symmetric, and 0 for identical points. Clamps the intermediate term to 1 so
 * floating-point drift can never feed `asin` a value above its domain.
 */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** One trusted "moving" leg of a run, between two consecutive kept fixes. */
export interface RunSegment {
  distanceM: number;
  /** Milliseconds since the run started at the leg's start fix. */
  tStartMs: number;
  /** Milliseconds since the run started at the leg's end fix. */
  tEndMs: number;
}

/**
 * Reduce a raw GPS trace to the segments that represent actual running.
 *
 * A consecutive pair is KEPT only when it clears every noise filter:
 * - forward in time (`dt > 0`) — out-of-order/duplicate timestamps are dropped;
 * - not a pause/blackout gap (`dt <= MAX_ACTIVE_GAP_MS`);
 * - a real move, not drift (`distance >= MIN_SEGMENT_METERS`);
 * - physically possible (`speed <= MAX_PLAUSIBLE_SPEED_MPS`) — not a teleport.
 *
 * The kept segments are the single source of truth for distance, active
 * duration, and splits. Points is expected in capture order.
 */
export function toRunSegments(points: readonly RunRoutePoint[]): RunSegment[] {
  const segments: RunSegment[] = [];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const dtMs = curr.t - prev.t;

    if (dtMs <= 0 || dtMs > MAX_ACTIVE_GAP_MS) continue;

    const distanceM = haversineMeters(prev, curr);
    if (distanceM < MIN_SEGMENT_METERS) continue;

    const speedMps = distanceM / (dtMs / 1000);
    if (speedMps > MAX_PLAUSIBLE_SPEED_MPS) continue;

    segments.push({ distanceM, tStartMs: prev.t, tEndMs: curr.t });
  }

  return segments;
}

/** Total moving distance in metres across the kept segments. */
export function sumDistanceM(segments: readonly RunSegment[]): number {
  return segments.reduce((total, seg) => total + seg.distanceM, 0);
}

/** Active (moving) seconds — the summed durations of the kept segments,
 * i.e. wall-clock time minus paused gaps and dropped-fix jumps. */
export function sumActiveSeconds(segments: readonly RunSegment[]): number {
  return segments.reduce(
    (total, seg) => total + (seg.tEndMs - seg.tStartMs) / 1000,
    0
  );
}

/** Convenience: total moving distance in metres straight from a raw trace. */
export function computeDistanceM(points: readonly RunRoutePoint[]): number {
  return sumDistanceM(toRunSegments(points));
}
