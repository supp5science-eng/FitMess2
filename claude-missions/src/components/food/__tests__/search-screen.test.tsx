import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { SearchScreen } from "@/components/food/search-screen";
import type { Food } from "@/lib/types/db";

// F024: component-level coverage of `/dodaj/pretraga`'s rendered states
// (loading skeleton / populated / empty / error, per the clarified API
// contract answer) plus AS-039 (neprovereno marker survives through the
// full search flow) and AS-040 (a recent food shown in a live search result
// is rendered at the top of the list, and the "Nedavno korišćeno" quick-add
// list appears when the search box is empty). The live-DB proof that
// recents are the signed-in user's OWN logs lives in
// `src/app/api/foods/recents/__tests__/route.integration.test.ts`.

function makeFood(overrides: Partial<Food> & { id: string }): Food {
  return {
    name_sr: "Test namirnica",
    brand: null,
    kcal_100g: 100,
    protein_100g: 1,
    carbs_100g: 1,
    fat_100g: 1,
    common_units: [],
    source: "seed",
    verified: true,
    barcode: null,
    submitted_by: null,
    label_photo_path: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("F024: SearchScreen empty state (no query, no recents)", () => {
  it("test_no_query_and_no_recents_shows_the_friendly_serbian_empty_hint", () => {
    render(<SearchScreen initialRecents={[]} />);

    const empty = screen.getByTestId("search-empty-state");
    expect(empty).toHaveTextContent(/nedavno korišćenu namirnicu/i);
    expect(screen.queryByTestId("recents-list")).not.toBeInTheDocument();
  });
});

describe("F024 / AS-040: SearchScreen recents quick-add list", () => {
  it("test_AS_040_recents_are_shown_as_a_quick_add_list_when_the_search_box_is_empty", () => {
    const recentFood = makeFood({ id: "recent-1", name_sr: "Nedavna namirnica" });

    render(<SearchScreen initialRecents={[recentFood]} />);

    const list = screen.getByTestId("recents-list");
    expect(list).toBeInTheDocument();
    expect(screen.getByTestId("food-item-recent-1")).toBeInTheDocument();
    expect(screen.queryByTestId("search-empty-state")).not.toBeInTheDocument();
  });
});

describe("F024: SearchScreen loading state", () => {
  it("test_typing_a_query_shows_a_loading_skeleton_before_results_arrive", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    render(<SearchScreen initialRecents={[]} />);
    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "jabuka" },
    });

    // Skeleton shows immediately while the debounce timer is pending.
    expect(screen.getByTestId("search-loading-skeleton")).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(400);
    expect(screen.getByTestId("search-loading-skeleton")).toBeInTheDocument();
  });
});

describe("F024: SearchScreen populated results state", () => {
  it("test_AS_039_a_populated_results_list_marks_an_unverified_food_neprovereno_and_not_a_verified_one", async () => {
    const verifiedFood = makeFood({ id: "verified-1", name_sr: "Jabuka", verified: true });
    const unverifiedFood = makeFood({ id: "unverified-1", name_sr: "Jabuka domaća", verified: false });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true, data: [verifiedFood, unverifiedFood] })
    );

    render(<SearchScreen initialRecents={[]} />);
    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "jabuka" },
    });

    await vi.advanceTimersByTimeAsync(400);

    await waitFor(() =>
      expect(screen.getByTestId("search-results-list")).toBeInTheDocument()
    );

    expect(
      screen.getByTestId("food-badge-neprovereno-unverified-1")
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("food-badge-neprovereno-verified-1")
    ).not.toBeInTheDocument();
  });

  it("test_AS_040_a_recent_food_returned_by_search_is_rendered_above_generic_results", async () => {
    const recentFood = makeFood({ id: "recent-1", name_sr: "Recent" });
    const genericFood = makeFood({ id: "generic-1", name_sr: "Generic" });

    // Search response deliberately orders the generic food first -- the
    // client-side re-rank (not the API's own order) is what must move
    // recentFood to the top.
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true, data: [genericFood, recentFood] })
    );

    render(<SearchScreen initialRecents={[recentFood]} />);
    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "generic" },
    });

    await vi.advanceTimersByTimeAsync(400);

    await waitFor(() =>
      expect(screen.getByTestId("search-results-list")).toBeInTheDocument()
    );

    const items = screen
      .getByTestId("search-results-list")
      .querySelectorAll("li");
    expect(items[0]).toHaveAttribute("data-testid", "food-item-recent-1");
    expect(items[1]).toHaveAttribute("data-testid", "food-item-generic-1");
  });

  it("test_a_query_with_no_matches_shows_the_serbian_no_results_empty_state", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true, data: [] })
    );

    render(<SearchScreen initialRecents={[]} />);
    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "zzzznepostojeca" },
    });

    await vi.advanceTimersByTimeAsync(400);

    await waitFor(() =>
      expect(screen.getByTestId("search-no-results")).toBeInTheDocument()
    );
    expect(screen.getByTestId("search-no-results")).toHaveTextContent(
      /nema rezultata/i
    );
  });
});

describe("F024: SearchScreen error/retry state (failure handling)", () => {
  it("test_a_failed_search_shows_an_inline_serbian_error_with_a_retry_affordance", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: false, error_sr: "Pretraga trenutno ne radi. Pokušaj ponovo." }, false)
    );

    render(<SearchScreen initialRecents={[]} />);
    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "jabuka" },
    });

    await vi.advanceTimersByTimeAsync(400);

    await waitFor(() =>
      expect(screen.getByTestId("search-error")).toBeInTheDocument()
    );
    expect(screen.getByTestId("search-error")).toHaveTextContent(
      /pretraga trenutno ne radi/i
    );
    expect(screen.getByTestId("search-retry-button")).toBeInTheDocument();
  });

  it("test_a_network_exception_also_shows_the_inline_serbian_error_state", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network down"));

    render(<SearchScreen initialRecents={[]} />);
    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "jabuka" },
    });

    await vi.advanceTimersByTimeAsync(400);

    await waitFor(() =>
      expect(screen.getByTestId("search-error")).toBeInTheDocument()
    );
  });

  it("test_clicking_retry_re_issues_the_search_request", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(
      jsonResponse({ ok: false, error_sr: "Pretraga trenutno ne radi. Pokušaj ponovo." }, false)
    );

    render(<SearchScreen initialRecents={[]} />);
    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "jabuka" },
    });

    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() =>
      expect(screen.getByTestId("search-error")).toBeInTheDocument()
    );

    const callsBeforeRetry = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByTestId("search-retry-button"));

    await waitFor(() =>
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBeforeRetry)
    );
  });
});

describe("F024: SearchScreen side effects", () => {
  it("test_clearing_the_search_box_returns_to_the_recents_view_without_an_extra_fetch_call", async () => {
    const recentFood = makeFood({ id: "recent-1" });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true, data: [] })
    );

    render(<SearchScreen initialRecents={[recentFood]} />);
    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "jabuka" },
    });
    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "" } });
    await vi.advanceTimersByTimeAsync(400);

    expect(screen.getByTestId("recents-list")).toBeInTheDocument();
    // No additional fetch for an empty query -- recents came from props.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("AS-128: form inputs are labeled and interactive elements are keyboard-reachable", () => {
  it("test_AS_128_the_search_input_has_an_accessible_label_findable_by_its_text", () => {
    render(<SearchScreen initialRecents={[]} />);

    // `getByLabelText` only succeeds when a real, associated <label> (here
    // `<Label htmlFor="food-search-input">Pretraga hrane</Label>`) points at
    // the input -- a placeholder alone would not satisfy this.
    const input = screen.getByLabelText("Pretraga hrane");
    expect(input).toBe(screen.getByTestId("search-input"));
    expect(input.tagName).toBe("INPUT");
  });

  it("test_AS_128_the_search_input_is_a_native_input_reachable_by_the_tab_key", () => {
    render(<SearchScreen initialRecents={[]} />);

    const input = screen.getByTestId("search-input");
    // A native <input> with no explicit negative tabindex is keyboard
    // (Tab) reachable by default -- no `tabIndex="-1"` or non-interactive
    // element standing in for it.
    expect(input.tagName).toBe("INPUT");
    expect(input).not.toHaveAttribute("tabindex", "-1");
  });

  it("test_AS_128_the_retry_button_is_a_real_keyboard_reachable_button_element", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: false, error_sr: "Pretraga trenutno ne radi. Pokušaj ponovo." }, false)
    );

    render(<SearchScreen initialRecents={[]} />);
    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "jabuka" },
    });
    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() =>
      expect(screen.getByTestId("search-retry-button")).toBeInTheDocument()
    );

    const retryButton = screen.getByRole("button", { name: "Pokušaj ponovo" });
    expect(retryButton).toBe(screen.getByTestId("search-retry-button"));
  });

  it("test_AS_128_food_items_render_no_bare_images_without_alt_text", () => {
    const recentFood = makeFood({ id: "recent-1", name_sr: "Jabuka" });
    render(<SearchScreen initialRecents={[recentFood]} />);

    // This screen renders no <img> elements at all (macro preview is text,
    // badges are text) -- so there is nothing that could be missing alt
    // text. Asserted explicitly rather than assumed.
    const images = screen.getByTestId("recents-list").querySelectorAll("img");
    expect(images.length).toBe(0);
  });
});
