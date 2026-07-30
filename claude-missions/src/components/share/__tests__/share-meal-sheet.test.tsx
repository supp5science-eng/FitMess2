import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { resetCardCache } from "@/lib/share/card-cache";
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

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  // Cards are cached in module-level state + Cache Storage, so each case starts
  // from a cold cache -- otherwise one test's card answers the next one's build.
  await resetCardCache();
  URL.createObjectURL = vi.fn(() => "blob:fake");
  URL.revokeObjectURL = vi.fn();
});

afterEach(async () => {
  // Unconditionally, and FIRST: a case that throws before its own cleanup would
  // otherwise leave fake timers installed, and every later test then hangs on a
  // `waitFor` whose clock never moves ("Test timed out", six cases at a time).
  vi.useRealTimers();
  await resetCardCache();
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

  it("test_only_the_story_format_is_offered", async () => {
    // The 1:1 "Objava" toggle is gone: the sheet shares 9:16 and nothing else.
    // (The server still renders `post`; there is just no UI asking for it.)
    fetchMock.mockResolvedValue(pngResponse());
    stubShare(async () => {});

    render(<ShareMealSheet {...PROPS} />);
    fireEvent.click(screen.getByTestId(`share-meal-open-${LOG_ID}`));
    await screen.findByAltText(/Pregled kartice/i);

    expect(screen.queryByRole("button", { name: /Objava/ })).toBeNull();
    expect(screen.queryByRole("group", { name: /Format kartice/ })).toBeNull();
    for (const call of fetchMock.mock.calls) {
      expect(JSON.parse(call[1].body as string).format).toBe("story");
    }
  });

  it("test_the_trigger_is_a_glass_chip_meant_to_sit_on_the_photo", async () => {
    // It floats over the meal photo, so the meal card passes its position in --
    // and it must not be the same neutral outline button as the corrections.
    render(<ShareMealSheet {...PROPS} className="absolute left-3 top-3 z-10" />);

    const trigger = screen.getByTestId(`share-meal-open-${LOG_ID}`);
    expect(trigger.className).toContain("absolute");
    expect(trigger.className).toContain("backdrop-blur-md");
    expect(trigger).toHaveTextContent("Podeli");
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

  /**
   * Puts a still-loading `<img>` in the document, the way `/danas` looks the
   * instant it is opened: one full-bleed meal photo per card, in flight.
   */
  function pendingPagePhoto() {
    const photo = document.createElement("img");
    Object.defineProperty(photo, "complete", {
      configurable: true,
      value: false,
    });
    document.body.appendChild(photo);
    return {
      finish: () =>
        Object.defineProperty(photo, "complete", {
          configurable: true,
          value: true,
        }),
      remove: () => photo.remove(),
    };
  }

  /**
   * Fakes only the clock the prewarm's wait actually uses. `requestIdleCallback`
   * is deliberately left ALONE (jsdom has none, so the component takes its
   * `setTimeout` fallback and every step is on the faked clock) -- faking it
   * here collided with the sinon fake-timer install and took the suite down.
   */
  function useWaitClock() {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  }

  it("test_the_prewarm_yields_to_the_screens_own_photos_before_spending_the_connection", async () => {
    // The reported symptom: opening the app showed BLANK meal cards for a
    // stretch. The photos were fine -- they were queued behind the card
    // prewarms, which are the far heavier request (a 1080x1920 rasterise and a
    // ~2.5 MB download each) and were firing while the photos were still in
    // flight. The visible thing has to win.
    fetchMock.mockResolvedValue(pngResponse());
    const photo = pendingPagePhoto();
    useWaitClock();

    try {
      render(<ShareMealSheet {...PROPS} />);

      // While a page photo is still loading, no card render is started at all.
      await vi.advanceTimersByTimeAsync(4000);
      expect(fetchMock).not.toHaveBeenCalled();

      // The moment the photo lands, the prewarm takes its turn.
      photo.finish();
      await vi.advanceTimersByTimeAsync(1500);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
      photo.remove();
    }
  });

  it("test_a_photo_that_never_loads_only_postpones_the_prewarm_it_never_cancels_it", async () => {
    // Waiting on the page's pictures is a courtesy, not a precondition: a
    // stalled or broken photo must not cost the user their prewarmed card.
    fetchMock.mockResolvedValue(pngResponse());
    const photo = pendingPagePhoto();
    useWaitClock();

    try {
      render(<ShareMealSheet {...PROPS} />);

      await vi.advanceTimersByTimeAsync(4000);
      expect(fetchMock).not.toHaveBeenCalled();

      // Past the 15 s cap the prewarm goes ahead regardless.
      await vi.advanceTimersByTimeAsync(13_000);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
      photo.remove();
    }
  });

  it("test_returning_to_the_screen_reuses_the_card_instead_of_rebuilding", async () => {
    // The reported bug: a card the user had already created rendered again from
    // scratch every time they came back to /danas, because the only cache was
    // per-component state.
    fetchMock.mockResolvedValue(pngResponse());
    stubShare(async () => {});

    const first = render(<ShareMealSheet {...PROPS} />);
    fireEvent.click(screen.getByTestId(`share-meal-open-${LOG_ID}`));
    await screen.findByAltText(/Pregled kartice/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    first.unmount();

    // Navigate back: a fresh mount of the same meal.
    render(<ShareMealSheet {...PROPS} />);
    fireEvent.click(screen.getByTestId(`share-meal-open-${LOG_ID}`));
    await screen.findByAltText(/Pregled kartice/i);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("test_tapping_the_preview_shows_the_same_card_full_screen", async () => {
    fetchMock.mockResolvedValue(pngResponse());
    stubShare(async () => {});

    render(<ShareMealSheet {...PROPS} />);
    fireEvent.click(screen.getByTestId(`share-meal-open-${LOG_ID}`));
    await screen.findByAltText(/Pregled kartice/i);
    expect(screen.queryByTestId("share-meal-zoom-overlay")).toBeNull();

    fireEvent.click(screen.getByTestId("share-meal-preview-zoom"));

    const zoom = await screen.findByTestId("share-meal-zoom-overlay");
    // Same object URL — zooming must not rebuild or refetch the card.
    const shown = zoom.querySelector("img");
    expect(shown?.getAttribute("src")).toBe("blob:fake");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // The sheet stays mounted underneath, so closing returns to it intact.
    expect(screen.getByTestId("share-meal-action")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("share-meal-zoom-close"));
    await waitFor(() =>
      expect(screen.queryByTestId("share-meal-zoom-overlay")).toBeNull()
    );
    expect(screen.getByTestId("share-meal-action")).toBeInTheDocument();
  });

  it("test_escape_leaves_the_zoom_without_closing_the_sheet", async () => {
    fetchMock.mockResolvedValue(pngResponse());
    stubShare(async () => {});

    render(<ShareMealSheet {...PROPS} />);
    fireEvent.click(screen.getByTestId(`share-meal-open-${LOG_ID}`));
    await screen.findByAltText(/Pregled kartice/i);
    fireEvent.click(screen.getByTestId("share-meal-preview-zoom"));
    await screen.findByTestId("share-meal-zoom-overlay");

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() =>
      expect(screen.queryByTestId("share-meal-zoom-overlay")).toBeNull()
    );
    expect(screen.getByTestId("share-meal-action")).toBeInTheDocument();
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
