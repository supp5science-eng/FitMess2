import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ShareMealSheet } from "../share-meal-sheet";

// "Podeli" beside a logged meal on /danas: opens a bottom sheet that renders
// the meal's card server-side (from its logId), previews it, and hands it to
// the native share sheet -- same file-share + download-fallback contract as the
// data-export button.

const LOG_ID = "11111111-2222-4333-8444-555555555555";
const PROPS = { logId: LOG_ID, mealName: "Ćevapi sa lukom" };

function pngResponse() {
  return {
    ok: true,
    headers: new Headers({ "content-type": "image/png" }),
    blob: async () =>
      new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }),
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  URL.createObjectURL = vi.fn(() => "blob:fake");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "canShare");
});

function stubShare(impl: () => Promise<void>) {
  Object.defineProperty(navigator, "canShare", {
    configurable: true,
    value: () => true,
  });
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: vi.fn(impl),
  });
  return navigator.share as unknown as ReturnType<typeof vi.fn>;
}

describe("ShareMealSheet", () => {
  it("test_opening_builds_the_card_from_the_log_id_and_previews_it", async () => {
    fetchMock.mockResolvedValue(pngResponse());
    stubShare(async () => {});

    render(<ShareMealSheet {...PROPS} />);
    fireEvent.click(screen.getByTestId(`share-meal-open-${LOG_ID}`));

    await screen.findByAltText(/Pregled kartice/i);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/card/scan");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ logId: LOG_ID, format: "story" });
  });

  it("test_shares_the_built_png_with_the_meal_name_as_title", async () => {
    fetchMock.mockResolvedValue(pngResponse());
    const share = stubShare(async () => {});

    render(<ShareMealSheet {...PROPS} />);
    fireEvent.click(screen.getByTestId(`share-meal-open-${LOG_ID}`));
    await screen.findByAltText(/Pregled kartice/i);

    fireEvent.click(screen.getByTestId("share-meal-action"));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));

    const shared = share.mock.calls[0][0] as { files: File[]; title: string };
    expect(shared.files[0].type).toBe("image/png");
    expect(shared.title).toBe("Ćevapi sa lukom");
    await screen.findByText(/Podeljeno/);
  });

  it("test_falls_back_to_a_download_when_the_platform_cannot_share_files", async () => {
    fetchMock.mockResolvedValue(pngResponse());
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    render(<ShareMealSheet {...PROPS} />);
    fireEvent.click(screen.getByTestId(`share-meal-open-${LOG_ID}`));
    await screen.findByAltText(/Pregled kartice/i);

    fireEvent.click(screen.getByTestId("share-meal-action"));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    await screen.findByText(/Sačuvano/);
    click.mockRestore();
  });

  it("test_switching_format_rebuilds_the_card_for_the_new_aspect", async () => {
    fetchMock.mockResolvedValue(pngResponse());
    stubShare(async () => {});

    render(<ShareMealSheet {...PROPS} />);
    fireEvent.click(screen.getByTestId(`share-meal-open-${LOG_ID}`));
    await screen.findByAltText(/Pregled kartice/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Objava/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body.format).toBe("post");
  });

  it("test_prewarms_the_story_card_on_mount_so_the_first_open_is_instant", async () => {
    fetchMock.mockResolvedValue(pngResponse());
    stubShare(async () => {});
    // Run the idle prewarm synchronously so the mount-time build is observable.
    const ric = vi.fn((cb: IdleRequestCallback) => {
      cb({ didTimeout: false, timeRemaining: () => 0 } as IdleDeadline);
      return 1;
    });
    Object.defineProperty(window, "requestIdleCallback", {
      configurable: true,
      value: ric,
    });
    Object.defineProperty(window, "cancelIdleCallback", {
      configurable: true,
      value: vi.fn(),
    });

    render(<ShareMealSheet {...PROPS} />);

    // The story card is fetched on mount, before any "Podeli" tap.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const warmBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(warmBody).toEqual({ logId: LOG_ID, format: "story" });

    // Opening reuses the prewarmed card: the preview shows with no second build.
    fireEvent.click(screen.getByTestId(`share-meal-open-${LOG_ID}`));
    await screen.findByAltText(/Pregled kartice/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    Reflect.deleteProperty(window, "requestIdleCallback");
    Reflect.deleteProperty(window, "cancelIdleCallback");
  });

  it("test_a_failed_build_surfaces_a_calm_serbian_error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      headers: new Headers({ "content-type": "text/plain" }),
      blob: async () => new Blob([""]),
    } as unknown as Response);

    render(<ShareMealSheet {...PROPS} />);
    fireEvent.click(screen.getByTestId(`share-meal-open-${LOG_ID}`));

    await screen.findByText(/Nismo uspeli da napravimo karticu/);
  });
});
