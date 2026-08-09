import { afterEach, describe, expect, it, vi } from "vitest";

import { canShareFiles, shareFiles } from "../web-share";

/**
 * The share-card path inside the store app.
 *
 * On Android's web view `navigator.share` does not exist and a `blob:` link
 * click does nothing, so before this the "Podeli" button on a meal card read
 * "Sačuvaj" and then saved nothing at all. Untestable on a device here (none on
 * hand, 2026-08-09), so it is pinned down from both ends: the capability answer
 * that picks the button's label, and the delivery that follows it.
 */

const CARD = () =>
  new File([new Uint8Array([137, 80, 78, 71])], "obrok.png", { type: "image/png" });

function stubShell(share = vi.fn(async () => ({}))) {
  vi.stubGlobal("Capacitor", {
    isNativePlatform: () => true,
    isPluginAvailable: (name: string) => name === "Filesystem" || name === "Share",
    getPlatform: () => "android",
    Plugins: {
      Filesystem: { writeFile: vi.fn(async () => ({ uri: "file:///cache/obrok.png" })) },
      Share: { share },
    },
  });
  return share;
}

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "canShare");
});

describe("share files in the store app", () => {
  it("test_the_button_may_say_share_even_where_the_web_api_is_missing", () => {
    // Android's web view: no `navigator.share` whatsoever. The shell can still
    // open the system sheet, and the label must reflect that.
    stubShell();
    expect(canShareFiles([CARD()])).toBe(true);
  });

  it("test_the_card_reaches_the_system_sheet_through_the_shell", async () => {
    const share = stubShell();

    await expect(shareFiles([CARD()], { title: "Pileća čorba" })).resolves.toBe(
      "shared"
    );
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ files: ["file:///cache/obrok.png"] })
    );
  });

  it("test_a_dismissed_sheet_asks_for_another_tap_rather_than_claiming_success", async () => {
    stubShell(
      vi.fn(async () => {
        throw new Error("Share canceled");
      })
    );

    await expect(shareFiles([CARD()])).resolves.toBe("retry");
  });

  it("test_more_than_one_file_is_left_to_the_browser_path", async () => {
    // The native route delivers a single URI. Sharing two cards and handing
    // over one would be a lie, so multi-file falls through untouched.
    stubShell();
    const webShare = vi.fn(async () => {});
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "share", { configurable: true, value: webShare });

    await expect(shareFiles([CARD(), CARD()])).resolves.toBe("shared");
    expect(webShare).toHaveBeenCalledTimes(1);
  });

  it("test_a_plain_browser_is_untouched_by_any_of_this", async () => {
    // No `window.Capacitor`: every desktop and mobile browser, where the Web
    // Share API stays the only route.
    const webShare = vi.fn(async () => {});
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "share", { configurable: true, value: webShare });

    expect(canShareFiles([CARD()])).toBe(true);
    await expect(shareFiles([CARD()])).resolves.toBe("shared");
    expect(webShare).toHaveBeenCalledTimes(1);
  });
});
