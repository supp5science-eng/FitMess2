import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// `/profil/moji-podaci` -- the page that shows WHAT is stored about a user
// before offering the export file, and that renders the Serbian message when
// `/api/export` bounces back after a failed download.

const collectExportSummaryMock = vi.fn();
vi.mock("@/lib/export/summary", async () => {
  const actual = await vi.importActual<typeof import("@/lib/export/summary")>(
    "@/lib/export/summary"
  );
  return {
    ...actual,
    collectExportSummary: (...args: unknown[]) => collectExportSummaryMock(...args),
  };
});

const getCurrentUserMock = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUser: () => getCurrentUserMock(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({}),
}));

import MojiPodaciPage from "../page";

const SUMMARY = {
  email: "marko@fitmess.app",
  memberSince: "2026-07-17T10:00:00.000Z",
  rows: [
    { key: "logs", labelSr: "Unosi hrane", count: 342 },
    { key: "weighIns", labelSr: "Merenja težine", count: 18 },
    { key: "habitChecks", labelSr: "Čekirane navike", count: null },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUserMock.mockResolvedValue({ id: "user-1", email: "marko@fitmess.app" });
  collectExportSummaryMock.mockResolvedValue(SUMMARY);
});

describe("Moji podaci: the summary", () => {
  it("test_shows_a_count_for_every_stored_category", async () => {
    render(await MojiPodaciPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByTestId("export-count-logs")).toHaveTextContent("342");
    expect(screen.getByTestId("export-count-weighIns")).toHaveTextContent("18");
    expect(screen.getByText("Unosi hrane")).toBeInTheDocument();
  });

  it("test_an_unreadable_category_shows_a_dash_not_a_zero", async () => {
    // Claiming "0" for something we could not read would be a false statement
    // about the user's own data.
    render(await MojiPodaciPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByTestId("export-count-habitChecks")).toHaveTextContent("—");
    expect(screen.getByTestId("export-count-habitChecks")).not.toHaveTextContent(
      "0"
    );
  });

  it("test_shows_the_account_email_and_member_since_date", async () => {
    render(await MojiPodaciPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("marko@fitmess.app")).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it("test_the_download_is_a_plain_link_to_the_export_route", async () => {
    render(await MojiPodaciPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByTestId("export-download-link")).toHaveAttribute(
      "href",
      "/api/export"
    );
  });

  it("test_there_is_always_a_way_back_to_podesavanja", async () => {
    render(await MojiPodaciPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("link", { name: /Podešavanja/ })).toHaveAttribute(
      "href",
      "/profil"
    );
  });
});

describe("Moji podaci: failure messages from the export route", () => {
  it("test_no_error_banner_without_a_greska_parameter", async () => {
    render(await MojiPodaciPage({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByTestId("export-error")).not.toBeInTheDocument();
  });

  it("test_a_failed_export_explains_itself_in_serbian", async () => {
    render(await MojiPodaciPage({ searchParams: Promise.resolve({ greska: "1" }) }));

    const error = screen.getByTestId("export-error");
    expect(error).toHaveTextContent(/Nismo uspeli da pripremimo tvoj fajl/);
    expect(error).not.toHaveTextContent(/error|exception|\{/i);
  });

  it("test_an_expired_session_gets_its_own_message", async () => {
    render(
      await MojiPodaciPage({ searchParams: Promise.resolve({ greska: "sesija" }) })
    );

    expect(screen.getByTestId("export-error")).toHaveTextContent(
      /Sesija je istekla/
    );
  });

  it("test_an_unknown_reason_falls_back_to_the_generic_message", async () => {
    render(
      await MojiPodaciPage({ searchParams: Promise.resolve({ greska: "xyz" }) })
    );

    expect(screen.getByTestId("export-error")).toHaveTextContent(
      /Nismo uspeli da pripremimo tvoj fajl/
    );
  });

  it("test_an_expired_session_never_renders_the_summary", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    render(await MojiPodaciPage({ searchParams: Promise.resolve({}) }));

    expect(screen.queryByTestId("export-summary")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/Sesija je istekla/);
  });
});
