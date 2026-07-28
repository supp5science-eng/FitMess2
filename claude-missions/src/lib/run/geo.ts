/**
 * Trčanje: pure geo helpers for the *live* map layer — the facing direction of
 * the "you are here" beam, the crow-flies distance to a searched goal, and how
 * that distance is written on the goal chip.
 *
 * Same money-math rule as the rest of `lib/run/**`: every number the recording
 * screen shows (distance to the cilj, the beam's heading) is derived here in a
 * deterministic, tested function — the map component only rotates a marker and
 * paints a label from what these return.
 */

import { haversineMeters, type GeoPoint } from "@/lib/run/distance";

/**
 * Initial great-circle bearing from `from` to `to`, in degrees clockwise from
 * true north and normalised to `[0, 360)`. Used as the fallback heading for the
 * location beam when the device gives no `coords.heading` (e.g. standing still):
 * we point it along the last movement instead.
 *
 * Returns `0` (north) for two identical points — there is no defined direction,
 * and north is the calm default the compass already rests at.
 */
export function bearingDegrees(from: GeoPoint, to: GeoPoint): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLng = toRadians(to.lng - from.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  if (x === 0 && y === 0) return 0;
  return (radToDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Straight-line ("as the crow flies") distance in metres from the runner to
 * their searched goal. A thin, intention-revealing alias over
 * {@link haversineMeters} so the recorder reads `distanceToGoalM(me, cilj)`
 * rather than a bare haversine call.
 */
export function distanceToGoalM(from: GeoPoint, goal: GeoPoint): number {
  return haversineMeters(from, goal);
}

/**
 * Human distance for the goal chip: `"850 m"` under a kilometre, else kilometres
 * with one decimal up to 10 km (`"1.2 km"`) and whole kilometres beyond
 * (`"12 km"`). Negative/NaN clamps to `"0 m"` so a bad fix never prints junk.
 */
export function formatDistanceShort(meters: number): string {
  const safe = Number.isFinite(meters) && meters > 0 ? meters : 0;
  if (safe < 1000) return `${Math.round(safe)} m`;
  const km = safe / 1000;
  return km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

const toRadians = (deg: number): number => (deg * Math.PI) / 180;
const radToDeg = (rad: number): number => (rad * 180) / Math.PI;
