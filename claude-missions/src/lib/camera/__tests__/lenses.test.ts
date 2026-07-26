import { describe, expect, it } from "vitest";

import {
  activeLensKey,
  buildLensOptions,
  classifyLens,
  isBackCamera,
} from "@/lib/camera/lenses";

// Which "0.5x / 1x / 2x" buttons a phone can actually honour. The two platforms
// expose the idea through different mechanisms (Android: a zoom capability on
// the track; iOS: one device per physical lens), and neither has the other's --
// so the rule that matters is: never render a stop the device can't deliver.

function device(label: string, deviceId = label) {
  return { kind: "videoinput", deviceId, label };
}

describe("classifying camera labels", () => {
  it("test_front_cameras_are_never_offered_as_a_rear_lens", () => {
    expect(isBackCamera("Front Camera")).toBe(false);
    expect(isBackCamera("camera2 1, facing front")).toBe(false);
    expect(classifyLens("Front Camera")).toBeNull();
  });

  it("test_an_ambiguous_label_is_dropped_rather_than_guessed", () => {
    // Says neither front nor back. Guessing here risks handing someone the
    // selfie camera when they tapped "1x".
    expect(isBackCamera("USB Video Device")).toBe(false);
    expect(classifyLens("USB Video Device")).toBeNull();
  });

  it("test_ios_back_lens_labels_map_to_the_expected_stops", () => {
    expect(classifyLens("Back Ultra Wide Camera")).toBe("ultrawide");
    expect(classifyLens("Back Camera")).toBe("wide");
    expect(classifyLens("Back Dual Wide Camera")).toBe("wide");
    expect(classifyLens("Back Telephoto Camera")).toBe("telephoto");
  });

  it("test_serbian_labels_are_understood_too", () => {
    // Phones set to Serbian report localised labels; missing these would silently
    // cost those users the lens switcher.
    expect(classifyLens("Zadnja ultraširoka kamera")).toBe("ultrawide");
    expect(classifyLens("Zadnja kamera")).toBe("wide");
  });
});

describe("buildLensOptions on the iOS path (one device per lens)", () => {
  it("test_each_physical_back_lens_becomes_a_stop", () => {
    const options = buildLensOptions({
      devices: [
        device("Front Camera"),
        device("Back Ultra Wide Camera"),
        device("Back Camera"),
        device("Back Telephoto Camera"),
      ],
    });

    expect(options.map((o) => o.label)).toEqual(["0.5x", "1x", "2x"]);
    // Switching lens means restarting the stream on that device.
    expect(options.every((o) => typeof o.deviceId === "string")).toBe(true);
    expect(options.every((o) => o.zoom === undefined)).toBe(true);
  });

  it("test_duplicate_lenses_collapse_to_one_stop", () => {
    // iOS also lists combined cameras that classify as the same lens; showing
    // "1x" twice would be nonsense.
    const options = buildLensOptions({
      devices: [
        device("Back Camera", "a"),
        device("Back Dual Wide Camera", "b"),
        device("Back Ultra Wide Camera", "c"),
      ],
    });

    expect(options.map((o) => o.label)).toEqual(["0.5x", "1x"]);
    expect(options.find((o) => o.label === "1x")?.deviceId).toBe("a");
  });

  it("test_a_single_lens_phone_gets_no_switcher", () => {
    // One stop is not a choice -- rendering it would just clutter the viewfinder.
    expect(
      buildLensOptions({
        devices: [device("Front Camera"), device("Back Camera")],
      })
    ).toEqual([]);
  });

  it("test_unrecognised_labels_produce_no_buttons_rather_than_wrong_ones", () => {
    // Labels are localised by the OS, so this list can never be exhaustive.
    // An unknown language must cost the switcher, never mislabel a lens.
    expect(
      buildLensOptions({
        devices: [device("カメラ 1"), device("カメラ 2")],
      })
    ).toEqual([]);
  });
});

describe("buildLensOptions on the Android path (zoom capability)", () => {
  it("test_zoom_stops_come_from_the_devices_real_range", () => {
    const options = buildLensOptions({
      devices: [device("camera2 0, facing back")],
      zoom: { min: 0.5, max: 2 },
    });

    expect(options.map((o) => o.label)).toEqual(["0.5x", "1x", "2x"]);
    // Zoom is applied to the running track, not by switching device.
    expect(options.every((o) => o.deviceId === undefined)).toBe(true);
    expect(options.map((o) => o.zoom)).toEqual([0.5, 1, 2]);
  });

  it("test_stops_outside_the_range_are_dropped_not_clamped", () => {
    // A "0.5x" button that actually applies 1x would be a lie, and a "3x" on a
    // phone that maxes out at 2x would be a dead tap.
    const options = buildLensOptions({
      devices: [device("camera2 0, facing back")],
      zoom: { min: 1, max: 2 },
    });

    expect(options.map((o) => o.label)).toEqual(["1x", "2x"]);
  });

  it("test_a_fixed_zoom_camera_gets_no_switcher", () => {
    expect(
      buildLensOptions({
        devices: [device("camera2 0, facing back")],
        zoom: { min: 1, max: 1 },
      })
    ).toEqual([]);
  });

  it("test_zoom_wins_over_device_switching_when_both_are_available", () => {
    // Android reports both. Native zoom is continuous and language-independent,
    // and the system picks the physical lens itself -- so it is the better of
    // the two mechanisms wherever it exists.
    const options = buildLensOptions({
      devices: [
        device("camera2 0, facing back"),
        device("camera2 2, facing back"),
      ],
      zoom: { min: 0.5, max: 3 },
    });

    expect(options.every((o) => o.zoom !== undefined)).toBe(true);
  });
});

describe("activeLensKey", () => {
  it("test_marks_the_running_lens_on_each_mechanism", () => {
    const deviceOptions = buildLensOptions({
      devices: [device("Back Ultra Wide Camera", "uw"), device("Back Camera", "w")],
    });
    expect(activeLensKey(deviceOptions, { deviceId: "uw" })).toBe(
      "lens-ultrawide"
    );

    const zoomOptions = buildLensOptions({
      devices: [device("camera2 0, facing back")],
      zoom: { min: 0.5, max: 2 },
    });
    expect(activeLensKey(zoomOptions, { zoom: 2 })).toBe("zoom-2");
  });

  it("test_reports_nothing_when_the_running_lens_is_not_a_listed_stop", () => {
    // The default stream before the user has picked anything: no button should
    // light up rather than an arbitrary one.
    const options = buildLensOptions({
      devices: [device("Back Ultra Wide Camera", "uw"), device("Back Camera", "w")],
    });
    expect(activeLensKey(options, {})).toBeNull();
  });
});
