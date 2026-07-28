/**
 * Trčanje: pure helper that projects a run's GPS route into a tiny SVG polyline
 * for the history-row thumbnail. Money-math rule — the shape shown is computed
 * and tested here, not eyeballed in the component.
 *
 * The projection stretches the route's bounding box to fill the thumbnail box
 * (aspect is not preserved — at ~64×40 px a faithful little squiggle reads fine
 * and always fills the chip). Latitude maps to Y inverted (north = up).
 */

import type { RunRoutePoint } from "@/lib/types/db";

/**
 * SVG `points` string for a `<polyline>` inside a `width`×`height` viewBox, or
 * `null` for a route with fewer than two usable fixes (the caller shows a
 * fallback icon). `pad` insets the drawing so the stroke isn't clipped.
 */
export function routeThumbPoints(
  route: readonly RunRoutePoint[],
  width = 64,
  height = 40,
  pad = 4
): string | null {
  const pts = route.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)
  );
  if (pts.length < 2) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of pts) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  const spanLat = maxLat - minLat || 1e-9;
  const spanLng = maxLng - minLng || 1e-9;
  const w = width - 2 * pad;
  const h = height - 2 * pad;

  return pts
    .map((p) => {
      const x = pad + ((p.lng - minLng) / spanLng) * w;
      const y = pad + (1 - (p.lat - minLat) / spanLat) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
