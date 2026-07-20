import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { AdminFoodQueue } from "@/components/admin/admin-food-queue";
import type { AdminQueueFood } from "@/lib/food/admin-review";

// F034 / AS-060 (renders the queue: name/brand/macros/submitter/label
// photo, "neprovereno" badge), AS-062 (a successful verify removes the row
// from the queue), AS-063 (a successful remove removes the row from the
// queue) -- component-level coverage of `AdminFoodQueue`'s rendered states
// (populated / empty / per-row error+retry, per the clarified API contract
// answer) plus the definition-of-done's failure-state and side-effect
// (no unintended navigation / global state mutation) requirements.

function makeQueueFood(
  overrides: Partial<AdminQueueFood> & { id: string }
): AdminQueueFood {
  return {
    name_sr: "Domaći ajvar",
    brand: "Bakina kuhinja",
    kcal_100g: 220,
    protein_100g: 3,
    carbs_100g: 12,
    fat_100g: 18,
    common_units: [],
    source: "user",
    verified: false,
    is_default: false,
    barcode: null,
    submitted_by: "user-a",
    label_photo_path: null,
    price: null,
    is_removed: false,
    removed_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    submitterEmail: "korisnik@example.com",
    ...overrides,
  };
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("F034 / AS-060: AdminFoodQueue renders the review queue", () => {
  it("test_AS_060_a_populated_queue_shows_name_brand_macros_submitter_and_the_neprovereno_badge", () => {
    const food = makeQueueFood({ id: "food-1" });
    render(<AdminFoodQueue initialFoods={[food]} />);

    expect(screen.getByTestId("admin-hrana-queue-list")).toBeInTheDocument();
    expect(screen.getByTestId("admin-hrana-item-food-1")).toBeInTheDocument();
    expect(screen.getByTestId("admin-hrana-name-food-1")).toHaveTextContent(
      "Domaći ajvar"
    );
    expect(
      screen.getByTestId("admin-hrana-badge-neprovereno-food-1")
    ).toBeInTheDocument();
    expect(screen.getByTestId("admin-hrana-macros-food-1")).toHaveTextContent(
      "220 kcal"
    );
    expect(
      screen.getByTestId("admin-hrana-submitter-food-1")
    ).toHaveTextContent("korisnik@example.com");
  });

  it("test_AS_060_a_food_with_no_submitter_email_shows_a_friendly_fallback_never_blank", () => {
    const food = makeQueueFood({ id: "food-2", submitterEmail: null });
    render(<AdminFoodQueue initialFoods={[food]} />);

    expect(
      screen.getByTestId("admin-hrana-submitter-food-2")
    ).toHaveTextContent("nepoznat korisnik");
  });

  it("test_AS_060_a_food_with_a_label_photo_renders_it_with_alt_text", () => {
    const food = makeQueueFood({
      id: "food-3",
      label_photo_path: "https://example.com/label.jpg",
    });
    render(<AdminFoodQueue initialFoods={[food]} />);

    const img = screen.getByTestId("admin-hrana-label-photo-food-3");
    expect(img).toHaveAttribute("src", "https://example.com/label.jpg");
    expect(img).toHaveAttribute("alt");
    expect(img.getAttribute("alt")?.length).toBeGreaterThan(0);
  });

  it("test_AS_060_a_food_with_no_label_photo_renders_no_image_for_that_row", () => {
    const food = makeQueueFood({ id: "food-4", label_photo_path: null });
    render(<AdminFoodQueue initialFoods={[food]} />);

    expect(
      screen.queryByTestId("admin-hrana-label-photo-food-4")
    ).not.toBeInTheDocument();
  });

  it("test_empty_queue_shows_the_friendly_serbian_empty_state_not_a_blank_screen", () => {
    render(<AdminFoodQueue initialFoods={[]} />);

    const empty = screen.getByTestId("admin-hrana-empty-state");
    expect(empty).toHaveTextContent(/nema namirnica za proveru/i);
    expect(
      screen.queryByTestId("admin-hrana-queue-list")
    ).not.toBeInTheDocument();
  });
});

describe("F034 / AS-062: verifying a food", () => {
  it("test_AS_062_a_successful_verify_removes_the_row_from_the_queue", async () => {
    const food = makeQueueFood({ id: "food-verify-1" });
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ ok: true, data: { ...food, verified: true } }) as Response
    );

    render(<AdminFoodQueue initialFoods={[food]} />);
    fireEvent.click(screen.getByTestId("admin-hrana-verify-food-verify-1"));

    await waitFor(() => {
      expect(
        screen.queryByTestId("admin-hrana-item-food-verify-1")
      ).not.toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/admin/foods/food-verify-1/verify",
      { method: "POST" }
    );
    // Side-effect verification: the empty state now shows (no leftover row,
    // no unintended navigation -- jsdom's location is never touched).
    expect(screen.getByTestId("admin-hrana-empty-state")).toBeInTheDocument();
  });

  it("test_AS_062_a_failed_verify_shows_an_inline_serbian_error_and_keeps_the_row_never_a_blank_screen", async () => {
    const food = makeQueueFood({ id: "food-verify-2" });
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        { ok: false, error_sr: "Nemaš administratorski pristup." },
        false
      ) as Response
    );

    render(<AdminFoodQueue initialFoods={[food]} />);
    fireEvent.click(screen.getByTestId("admin-hrana-verify-food-verify-2"));

    const error = await screen.findByTestId("admin-hrana-error-food-verify-2");
    expect(error).toHaveTextContent("Nemaš administratorski pristup.");
    // The row is still there -- a failed action never silently removes data.
    expect(
      screen.getByTestId("admin-hrana-item-food-verify-2")
    ).toBeInTheDocument();
  });

  it("test_a_network_failure_during_verify_shows_a_fallback_serbian_error_and_allows_retry", async () => {
    const food = makeQueueFood({ id: "food-verify-3" });
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(
        jsonResponse({ ok: true, data: { ...food, verified: true } }) as Response
      );

    render(<AdminFoodQueue initialFoods={[food]} />);
    fireEvent.click(screen.getByTestId("admin-hrana-verify-food-verify-3"));

    const error = await screen.findByTestId("admin-hrana-error-food-verify-3");
    expect(error).toHaveTextContent(/nismo uspeli da potvrdimo/i);

    // Retry (same button) succeeds the second time.
    fireEvent.click(screen.getByTestId("admin-hrana-verify-food-verify-3"));
    await waitFor(() => {
      expect(
        screen.queryByTestId("admin-hrana-item-food-verify-3")
      ).not.toBeInTheDocument();
    });
  });
});

describe("F034 / AS-063: removing a food", () => {
  it("test_AS_063_a_successful_remove_removes_the_row_from_the_queue", async () => {
    const food = makeQueueFood({ id: "food-remove-1" });
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        data: { ...food, is_removed: true, removed_at: "2026-01-02T00:00:00.000Z" },
      }) as Response
    );

    render(<AdminFoodQueue initialFoods={[food]} />);
    fireEvent.click(screen.getByTestId("admin-hrana-remove-food-remove-1"));

    await waitFor(() => {
      expect(
        screen.queryByTestId("admin-hrana-item-food-remove-1")
      ).not.toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/admin/foods/food-remove-1/remove",
      { method: "POST" }
    );
  });

  it("test_AS_063_a_failed_remove_shows_an_inline_serbian_error_and_keeps_the_row", async () => {
    const food = makeQueueFood({ id: "food-remove-2" });
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ ok: false, error_sr: "Namirnica nije pronađena." }, false) as Response
    );

    render(<AdminFoodQueue initialFoods={[food]} />);
    fireEvent.click(screen.getByTestId("admin-hrana-remove-food-remove-2"));

    const error = await screen.findByTestId("admin-hrana-error-food-remove-2");
    expect(error).toHaveTextContent("Namirnica nije pronađena.");
    expect(
      screen.getByTestId("admin-hrana-item-food-remove-2")
    ).toBeInTheDocument();
  });

  it("test_removing_one_row_does_not_affect_a_sibling_row_no_unintended_global_state_mutation", async () => {
    const foodA = makeQueueFood({ id: "food-a" });
    const foodB = makeQueueFood({ id: "food-b", name_sr: "Turšija" });
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        data: { ...foodA, is_removed: true, removed_at: "2026-01-02T00:00:00.000Z" },
      }) as Response
    );

    render(<AdminFoodQueue initialFoods={[foodA, foodB]} />);
    fireEvent.click(screen.getByTestId("admin-hrana-remove-food-a"));

    await waitFor(() => {
      expect(
        screen.queryByTestId("admin-hrana-item-food-a")
      ).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("admin-hrana-item-food-b")).toBeInTheDocument();
  });
});

describe("F034: buttons are disabled (not double-submittable) while an action is pending", () => {
  it("test_verify_and_remove_buttons_disable_while_the_request_is_in_flight", async () => {
    const food = makeQueueFood({ id: "food-pending-1" });
    let resolveFetch: (value: Response | PromiseLike<Response>) => void = () => {};
    vi.mocked(fetch).mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      })
    );

    render(<AdminFoodQueue initialFoods={[food]} />);
    const verifyButton = screen.getByTestId("admin-hrana-verify-food-pending-1");
    const removeButton = screen.getByTestId("admin-hrana-remove-food-pending-1");

    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(verifyButton).toBeDisabled();
      expect(removeButton).toBeDisabled();
    });

    resolveFetch(
      jsonResponse({ ok: true, data: { ...food, verified: true } }) as Response
    );
    await waitFor(() => {
      expect(
        screen.queryByTestId("admin-hrana-item-food-pending-1")
      ).not.toBeInTheDocument();
    });
  });
});
