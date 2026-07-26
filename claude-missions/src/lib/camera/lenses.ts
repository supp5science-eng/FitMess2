// Working out which "0.5x / 1x / 2x" buttons a given phone can actually honour.
//
// There is no single web API for this -- the two big platforms expose the same
// user-facing idea through different mechanisms, and each is missing what the
// other has:
//
//  - Android / Chromium: the video track carries a real `zoom` capability with
//    a min/max range, driven by `applyConstraints`. On multi-lens phones the
//    system picks the right physical lens for the requested factor, so one
//    control covers everything. iOS Safari does NOT implement this at all.
//
//  - iOS (16.3+): every back lens is a SEPARATE device in `enumerateDevices()`
//    ("Back Ultra Wide Camera", "Back Camera", "Back Telephoto Camera"), so
//    switching lenses means restarting the stream on another `deviceId`. There
//    is no continuous zoom in between.
//
// So the buttons are built from whatever the device actually reports, and when
// it reports nothing usable, no buttons are shown at all. A dead "0.5x" that
// silently does nothing is worse than not offering it.

/** One lens/zoom stop offered in the viewfinder. Exactly one of `deviceId`
 * (switch to another physical camera) or `zoom` (apply a zoom factor to the
 * current one) is set, matching the two mechanisms above. */
export interface LensOption {
  key: string;
  /** What the user sees, e.g. "0.5x". */
  label: string;
  deviceId?: string;
  zoom?: number;
}

/** The subset of `MediaDeviceInfo` this module needs (so it can be unit-tested
 * without a browser). */
export interface DeviceLike {
  kind: string;
  deviceId: string;
  label: string;
}

/** The subset of a track's `zoom` capability this module needs. */
export interface ZoomRange {
  min: number;
  max: number;
}

export type LensKind = "ultrawide" | "wide" | "telephoto";

// Labels come straight from the OS and are localised to the phone's language,
// so this can never be exhaustive -- it is a best effort over the spellings we
// know. Anything unrecognised simply doesn't become a button (see
// `buildLensOptions`), which is why an unknown language degrades to "no lens
// switcher" rather than to wrong buttons.
const ULTRAWIDE_HINTS = [
  "ultra wide",
  "ultrawide",
  "ultra-wide",
  "ultraširok",
  "ultra širok",
  "ultrasirok",
  "ultra sirok",
];
const TELEPHOTO_HINTS = ["telephoto", "tele-photo", "teleobjektiv"];
const FRONT_HINTS = ["front", "facing front", "prednja", "selfie"];
const BACK_HINTS = ["back", "rear", "facing back", "zadnja", "zadnji", "stražnja"];

function normalise(label: string): string {
  return label.toLocaleLowerCase();
}

function hasAny(label: string, hints: readonly string[]): boolean {
  return hints.some((hint) => label.includes(hint));
}

/** Is this a rear-facing camera? Front cameras are excluded explicitly rather
 * than assumed, because a label that mentions neither is ambiguous and we would
 * rather drop it than offer the selfie camera as "1x". */
export function isBackCamera(label: string): boolean {
  const text = normalise(label);
  if (hasAny(text, FRONT_HINTS)) return false;
  return hasAny(text, BACK_HINTS);
}

/** Which lens a back camera's label describes, or null when we can't tell. */
export function classifyLens(label: string): LensKind | null {
  if (!isBackCamera(label)) return null;
  const text = normalise(label);
  if (hasAny(text, ULTRAWIDE_HINTS)) return "ultrawide";
  if (hasAny(text, TELEPHOTO_HINTS)) return "telephoto";
  // "Back Camera" / "Back Dual Wide Camera" -- the ordinary lens.
  return "wide";
}

const KIND_LABEL: Record<LensKind, string> = {
  ultrawide: "0.5x",
  wide: "1x",
  telephoto: "2x",
};

const KIND_ORDER: LensKind[] = ["ultrawide", "wide", "telephoto"];

/** Zoom factors worth offering as buttons, widest first. Anything outside the
 * device's real range is dropped rather than clamped: a "0.5x" button that
 * actually applies 1x would be a lie. */
const ZOOM_STOPS = [0.5, 1, 2, 3];

/**
 * The lens buttons to show, or `[]` when this device can't offer a real choice.
 *
 * Native zoom wins when present: it is continuous, language-independent, and on
 * multi-lens phones the system picks the physical lens itself. Device switching
 * is the iOS path, and depends on labels we may not recognise -- hence the
 * `null` classification handling.
 */
export function buildLensOptions({
  devices,
  zoom,
}: {
  devices: readonly DeviceLike[];
  zoom?: ZoomRange | null;
}): LensOption[] {
  if (zoom && zoom.max > zoom.min) {
    const stops = ZOOM_STOPS.filter(
      (stop) => stop >= zoom.min && stop <= zoom.max
    );
    // One stop is not a choice -- don't clutter the viewfinder with it.
    return stops.length > 1
      ? stops.map((stop) => ({
          key: `zoom-${stop}`,
          label: `${stop}x`,
          zoom: stop,
        }))
      : [];
  }

  const byKind = new Map<LensKind, DeviceLike>();
  for (const device of devices) {
    if (device.kind !== "videoinput") continue;
    const kind = classifyLens(device.label);
    if (kind === null) continue;
    // First device of each kind wins: iOS also lists combined cameras
    // ("Back Dual Wide Camera") that classify as the same lens.
    if (!byKind.has(kind)) byKind.set(kind, device);
  }

  const options = KIND_ORDER.filter((kind) => byKind.has(kind)).map((kind) => {
    const device = byKind.get(kind)!;
    return {
      key: `lens-${kind}`,
      label: KIND_LABEL[kind],
      deviceId: device.deviceId,
    };
  });

  return options.length > 1 ? options : [];
}

/** Which option is currently in use, so the viewfinder can mark it active. */
export function activeLensKey(
  options: readonly LensOption[],
  current: { deviceId?: string; zoom?: number }
): string | null {
  const match = options.find((option) =>
    option.deviceId !== undefined
      ? option.deviceId === current.deviceId
      : option.zoom === current.zoom
  );
  return match?.key ?? null;
}
