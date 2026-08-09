import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ExportDownloadButton } from "../export-download-button";

// The whole point of this control: on an installed PWA (iOS especially) the
// export must NEVER be reached by navigating to it -- a PDF opened in the
// standalone webview has no way back to the app. So it is fetched, then handed
// to the share sheet or to a blob download.

const PROPS = {
  href: "/api/export/pdf",
  contentType: "application/pdf",
  fallbackFilename: "fitmess-moji-podaci.pdf",
  label: "Preuzmi PDF",
  readyLabel: "Sačuvaj PDF",
  doneText: "PDF je sačuvan.",
  testId: "export-pdf-link",
};

function pdfResponse(url = "https://fitmess.app/api/export/pdf") {
  return {
    ok: true,
    url,
    headers: new Headers({
      "content-type": "application/pdf",
      "content-disposition": 'attachment; filename="fitmess-moji-podaci-2026-07-25.pdf"',
    }),
    blob: async () => new Blob(["%PDF-1.4"], { type: "application/pdf" }),
  } as unknown as Response;
}

/** What the routes actually answer with on failure: a redirect back to the
 * page, which through `fetch` arrives as an HTML document. */
function bouncedResponse(reason: string) {
  return {
    ok: true,
    url: `https://fitmess.app/profil/moji-podaci?greska=${reason}`,
    headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
    blob: async () => new Blob(["<html>"], { type: "text/html" }),
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  URL.createObjectURL = vi.fn(() => "blob:fake");
  URL.revokeObjectURL = vi.fn();
});

const BROWSER_UA = navigator.userAgent;

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "canShare");
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: BROWSER_UA,
  });
});

/** Puts the component inside the store app: the UA marker the Capacitor shell
 * appends is the only thing that tells the web app the two apart. */
function stubNativeShell(plugins: { Filesystem?: unknown; Share?: unknown } | null) {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: `${BROWSER_UA} FitMessApp/1.0`,
  });
  if (!plugins) return;
  vi.stubGlobal("Capacitor", {
    isNativePlatform: () => true,
    isPluginAvailable: (name: string) => name in plugins,
    getPlatform: () => "android",
    Plugins: plugins,
  });
}

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

describe("ExportDownloadButton", () => {
  it("test_hands_the_file_to_the_share_sheet_when_the_platform_has_one", async () => {
    fetchMock.mockResolvedValue(pdfResponse());
    const share = stubShare(async () => {});

    render(<ExportDownloadButton {...PROPS} />);
    fireEvent.click(screen.getByTestId("export-pdf-link"));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));

    const shared = share.mock.calls[0][0] as { files: File[] };
    expect(shared.files[0].name).toBe("fitmess-moji-podaci-2026-07-25.pdf");
    expect(shared.files[0].type).toBe("application/pdf");
    await screen.findByText("PDF je sačuvan.");
  });

  it("test_a_blocked_share_keeps_the_file_and_retries_on_the_next_tap", async () => {
    // iOS spends the user gesture on the fetch and rejects share() with
    // NotAllowedError. The next tap is a fresh gesture -- and must not cost a
    // second round trip to rebuild the PDF.
    fetchMock.mockResolvedValue(pdfResponse());
    let calls = 0;
    const share = stubShare(async () => {
      calls += 1;
      if (calls === 1) {
        const err = new Error("blocked");
        err.name = "NotAllowedError";
        throw err;
      }
    });

    render(<ExportDownloadButton {...PROPS} />);
    fireEvent.click(screen.getByTestId("export-pdf-link"));

    await screen.findByText(/dodirni još jednom/i);
    expect(screen.getByTestId("export-pdf-link")).toHaveTextContent("Sačuvaj PDF");

    fireEvent.click(screen.getByTestId("export-pdf-link"));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await screen.findByText("PDF je sačuvan.");
  });

  it("test_falls_back_to_a_blob_download_without_a_share_sheet", async () => {
    fetchMock.mockResolvedValue(pdfResponse());
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<ExportDownloadButton {...PROPS} />);
    fireEvent.click(screen.getByTestId("export-pdf-link"));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    await screen.findByText("PDF je sačuvan.");

    click.mockRestore();
  });

  it("test_a_bounced_request_shows_the_serbian_reason_instead_of_navigating", async () => {
    fetchMock.mockResolvedValue(bouncedResponse("pdf"));

    render(<ExportDownloadButton {...PROPS} />);
    fireEvent.click(screen.getByTestId("export-pdf-link"));

    await screen.findByText(/Nismo uspeli da napravimo PDF/);
    expect(screen.getByTestId("export-pdf-link")).toHaveTextContent("Preuzmi PDF");
  });

  it("test_an_expired_session_says_so", async () => {
    fetchMock.mockResolvedValue(bouncedResponse("sesija"));

    render(<ExportDownloadButton {...PROPS} />);
    fireEvent.click(screen.getByTestId("export-pdf-link"));

    await screen.findByText(/Sesija je istekla/);
  });

  it("test_inside_the_store_app_the_file_goes_through_the_native_share_sheet", async () => {
    fetchMock.mockResolvedValue(pdfResponse());
    const share = vi.fn(async () => ({}));
    stubNativeShell({
      Filesystem: { writeFile: vi.fn(async () => ({ uri: "file:///cache/f.pdf" })) },
      Share: { share },
    });
    // A web share sheet is also present (this is what iOS looks like); the
    // native route still wins, so both platforms behave identically.
    const webShare = stubShare(async () => {});

    render(<ExportDownloadButton {...PROPS} />);
    fireEvent.click(screen.getByTestId("export-pdf-link"));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(webShare).not.toHaveBeenCalled();
    await screen.findByText("PDF je sačuvan.");
  });

  it("test_a_store_app_that_cannot_save_says_so_instead_of_doing_nothing", async () => {
    // THE failure this whole path exists for: Android's web view has no
    // `navigator.share`, and its answer to a blob-link click is silence. An
    // older shell without the save plugins lands exactly here -- and the user
    // must get a sentence, not a button that does nothing when tapped.
    fetchMock.mockResolvedValue(pdfResponse());
    stubNativeShell(null);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    render(<ExportDownloadButton {...PROPS} />);
    fireEvent.click(screen.getByTestId("export-pdf-link"));

    const status = await screen.findByTestId("export-pdf-link-status");
    expect(status).toHaveTextContent(/ne ume da sačuva fajl/i);
    // And it must not pretend: no blob click, no "saved" message.
    expect(click).not.toHaveBeenCalled();
    expect(status).not.toHaveTextContent("PDF je sačuvan.");

    click.mockRestore();
  });

  it("test_a_dead_connection_does_not_leak_an_exception_into_the_ui", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    render(<ExportDownloadButton {...PROPS} />);
    fireEvent.click(screen.getByTestId("export-pdf-link"));

    const status = await screen.findByTestId("export-pdf-link-status");
    expect(status).toHaveTextContent(/Nema veze sa internetom/);
    expect(status).not.toHaveTextContent(/TypeError|Failed to fetch/);
  });
});
