import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ShareCardButton } from "../share-card-button";

// The "Podeli karticu" trigger on the Prizma result screen. It builds the card
// server-side, previews the exact image, and hands it to the native share sheet
// -- with the same iOS-gesture and download-fallback contract the data-export
// button follows.

const PROPS = {
  photo: new File([new Uint8Array([1, 2, 3])], "obrok.jpg", {
    type: "image/jpeg",
  }),
  dishName: "Ćevapi sa lukom",
  kcal: 642,
  protein: 38,
  carbs: 41,
  fat: 22,
};

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

describe("ShareCardButton", () => {
  it("test_builds_the_png_card_and_hands_it_to_the_share_sheet", async () => {
    fetchMock.mockResolvedValue(pngResponse());
    const share = stubShare(async () => {});

    render(<ShareCardButton {...PROPS} />);
    fireEvent.click(screen.getByTestId("share-card-button"));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));

    const shared = share.mock.calls[0][0] as { files: File[] };
    expect(shared.files[0].type).toBe("image/png");
    expect(shared.files[0].name).toBe("fitmess-story.png");

    // The confirmed macros go up as the request body.
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get("naziv")).toBe("Ćevapi sa lukom");
    expect(body.get("kcal")).toBe("642");
    expect(body.get("format")).toBe("story");

    await screen.findByText(/Podeljeno/);
  });

  it("test_previews_the_generated_card", async () => {
    fetchMock.mockResolvedValue(pngResponse());
    stubShare(async () => {});

    render(<ShareCardButton {...PROPS} />);
    fireEvent.click(screen.getByTestId("share-card-button"));

    const preview = (await screen.findByAltText(
      /Pregled kartice/i
    )) as HTMLImageElement;
    expect(preview.src).toContain("blob:fake");
  });

  it("test_a_blocked_share_keeps_the_card_and_retries_without_rebuilding", async () => {
    fetchMock.mockResolvedValue(pngResponse());
    let calls = 0;
    const share = stubShare(async () => {
      calls += 1;
      if (calls === 1) {
        const err = new Error("blocked");
        err.name = "NotAllowedError";
        throw err;
      }
    });

    render(<ShareCardButton {...PROPS} />);
    fireEvent.click(screen.getByTestId("share-card-button"));

    await screen.findByText(/dodirni još jednom/i);
    expect(screen.getByTestId("share-card-button")).toHaveTextContent(
      "Podeli još jednom"
    );

    fireEvent.click(screen.getByTestId("share-card-button"));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2));
    // The card was built exactly once across both taps.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("test_falls_back_to_a_download_when_the_platform_cannot_share_files", async () => {
    fetchMock.mockResolvedValue(pngResponse());
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    render(<ShareCardButton {...PROPS} />);
    fireEvent.click(screen.getByTestId("share-card-button"));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    // No native file-share on this platform -> the card is saved, not shared.
    await screen.findByText(/Sačuvano/);
    click.mockRestore();
  });

  it("test_switching_format_rebuilds_the_card_for_the_new_aspect", async () => {
    fetchMock.mockResolvedValue(pngResponse());
    stubShare(async () => {});

    render(<ShareCardButton {...PROPS} />);
    fireEvent.click(screen.getByTestId("share-card-button"));
    await screen.findByText(/Podeljeno/);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Objava/ }));
    fireEvent.click(screen.getByTestId("share-card-button"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body = fetchMock.mock.calls[1][1].body as FormData;
    expect(body.get("format")).toBe("post");
  });

  it("test_a_failed_build_surfaces_a_calm_serbian_error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      headers: new Headers({ "content-type": "text/plain" }),
      blob: async () => new Blob([""]),
    } as unknown as Response);

    render(<ShareCardButton {...PROPS} />);
    fireEvent.click(screen.getByTestId("share-card-button"));

    const status = await screen.findByTestId("share-card-status");
    expect(status).toHaveTextContent(/Nismo uspeli da napravimo karticu/);
  });
});
