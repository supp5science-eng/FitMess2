import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// F027 / AS-043: proves that saving an edit or confirming a delete on a
// meal card updates the ring + macro bars + meal list IMMEDIATELY (plain
// React state, no navigation, no full page reload) -- the callbacks
// `LogEditSheet.onSaved` / `LogDeleteConfirm.onDeleted` (F026) are wired
// into `HomeScreen`'s own state exactly as its header comment documents.

const pushSpy = vi.fn();
const refreshSpy = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy, refresh: refreshSpy }),
}));

vi.stubGlobal("fetch", vi.fn());

import { HomeScreen } from "@/components/home/home-screen";
import type { LogWithFood } from "@/lib/home/attach-food";
import type { Food, Log, Target } from "@/lib/types/db";

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: "food-1",
    name_sr: "Jabuka",
    brand: null,
    kcal_100g: 200,
    protein_100g: 10,
    carbs_100g: 20,
    fat_100g: 5,
    common_units: [],
    source: "seed",
    verified: true,
    is_default: false,
    barcode: null,
    submitted_by: null,
    label_photo_path: null,
    price: null,
    is_removed: false,
    removed_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeLog(overrides: Partial<LogWithFood> = {}): LogWithFood {
  return {
    id: "log-1",
    user_id: "user-1",
    food_id: "food-1",
    name: "Jabuka",
    grams: 100,
    kcal: 200,
    protein: 10,
    carbs: 20,
    fat: 5,
    logged_at: "2026-07-17T10:00:00.000Z",
    method: "search",
    created_at: "2026-07-17T10:00:00.000Z",
    food: makeFood(),
    ...overrides,
  };
}

function makeTarget(overrides: Partial<Target> = {}): Target {
  return {
    id: "target-1",
    user_id: "user-1",
    daily_kcal: 2000,
    protein_g: 150,
    fat_g: 60,
    carbs_g: 200,
    weekly_kcal: 14000,
    goal: "lose",
    goal_weight_kg: 70,
    timeframe_weeks: 12,
    effective_from: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

beforeEach(() => {
  (global.fetch as ReturnType<typeof vi.fn>).mockReset();
  pushSpy.mockReset();
  refreshSpy.mockReset();
});

describe("AS-047/AS-048/AS-049: HomeScreen renders the ring, bars, and meal list from server-fetched props", () => {
  it("test_AS_047_AS_048_AS_049_initial_render_reflects_the_server_fetched_logs_and_target", () => {
    render(
      <HomeScreen initialLogs={[makeLog()]} target={makeTarget()} />
    );

    // AS-047: 2000 target - 200 consumed = 1800 remaining.
    expect(screen.getByTestId("home-ring-value")).toHaveTextContent("1800");
    // AS-048: three macro bars present.
    expect(screen.getByTestId("home-macro-bars")).toBeInTheDocument();
    // AS-049: the one seeded log is listed.
    expect(screen.getByTestId("meal-card-log-1")).toBeInTheDocument();
  });
});

describe("AS-043: editing a log updates the ring/bars/list immediately, without navigation", () => {
  it("test_AS_043_saving_an_edited_portion_updates_the_remaining_kcal_and_the_meal_cards_own_kcal_with_no_navigation_call", async () => {
    render(
      <HomeScreen initialLogs={[makeLog({ grams: 100, kcal: 200 })]} target={makeTarget({ daily_kcal: 2000 })} />
    );

    expect(screen.getByTestId("home-ring-value")).toHaveTextContent("1800");

    // Doubling the portion (100g -> 200g) via the edit sheet: kcal becomes 400.
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({
        ok: true,
        data: {
          id: "log-1",
          user_id: "user-1",
          food_id: "food-1",
          name: "Jabuka",
          grams: 200,
          kcal: 400,
          protein: 20,
          carbs: 40,
          fat: 10,
          logged_at: "2026-07-17T10:00:00.000Z",
          method: "search",
          created_at: "2026-07-17T10:00:00.000Z",
        } satisfies Log,
      })
    );

    fireEvent.click(screen.getByTestId("log-edit-open-button"));
    fireEvent.change(screen.getByTestId("log-edit-grams-input"), {
      target: { value: "200" },
    });
    fireEvent.click(screen.getByTestId("log-edit-save-button"));

    // The ring updates the instant the PATCH resolves -- no reload needed.
    await waitFor(() =>
      expect(screen.getByTestId("home-ring-value")).toHaveTextContent("1600")
    );
    expect(screen.getByTestId("meal-card-kcal-log-1")).toHaveTextContent(
      "400 kcal"
    );

    // Side-effect verification: no navigation of any kind was triggered.
    expect(pushSpy).not.toHaveBeenCalled();
    expect(refreshSpy).not.toHaveBeenCalled();
  });
});

describe("AS-043: deleting a log removes it and updates totals immediately, without navigation", () => {
  it("test_AS_043_confirming_delete_removes_the_card_and_recomputes_remaining_kcal_with_no_navigation_call", async () => {
    const logs = [
      makeLog({ id: "log-1", name: "Jabuka", kcal: 200 }),
      makeLog({
        id: "log-2",
        name: "Banana",
        food_id: "food-2",
        kcal: 100,
        food: makeFood({ id: "food-2", name_sr: "Banana" }),
      }),
    ];
    render(<HomeScreen initialLogs={logs} target={makeTarget({ daily_kcal: 2000 })} />);

    // 2000 - (200 + 100) = 1700 remaining initially.
    expect(screen.getByTestId("home-ring-value")).toHaveTextContent("1700");

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true })
    );

    const deleteButtons = screen.getAllByTestId("log-delete-open-button");
    fireEvent.click(deleteButtons[0]!);
    fireEvent.click(screen.getByTestId("log-delete-confirm-button"));

    await waitFor(() =>
      expect(screen.queryByTestId("meal-card-log-1")).not.toBeInTheDocument()
    );
    // Only the deleted card's kcal (200) is gone -> 2000 - 100 = 1900 remaining.
    expect(screen.getByTestId("home-ring-value")).toHaveTextContent("1900");
    expect(screen.getByTestId("meal-card-log-2")).toBeInTheDocument();

    expect(pushSpy).not.toHaveBeenCalled();
    expect(refreshSpy).not.toHaveBeenCalled();
  });
});

describe("F027: HomeScreen handles the no-target state gracefully", () => {
  it("test_no_target_row_shows_a_friendly_message_instead_of_a_broken_ring", () => {
    render(<HomeScreen initialLogs={[]} target={null} />);

    expect(screen.getByTestId("home-no-target")).toBeInTheDocument();
    expect(screen.queryByTestId("home-ring")).not.toBeInTheDocument();
  });
});

describe("Deo 2: adaptive daily target is reflected on today's dashboard", () => {
  const adjustedPlan = {
    baseDailyTarget: 2000,
    adaptiveDailyTarget: 1600,
    isAdjusted: true,
    weeklyBudget: 14000,
    spentBeforeToday: 6000,
    daysLeftIncludingToday: 5,
    carryInKcal: 0,
    trimmedKcal: 400,
    trainingSuggestionKcal: 0,
    trainingWalkMinutes: 0,
  };

  it("test_the_ring_targets_the_adapted_number_and_a_note_explains_why", () => {
    render(
      <HomeScreen
        initialLogs={[makeLog({ kcal: 200 })]}
        target={makeTarget({ daily_kcal: 2000 })}
        adaptivePlan={adjustedPlan}
      />
    );

    // Ring "Cilj" is the adapted 1600, not the base 2000.
    expect(screen.getByTestId("home-ring-target")).toHaveTextContent("1600");
    // Remaining = 1600 - 200 = 1400.
    expect(screen.getByTestId("home-ring-value")).toHaveTextContent("1400");
    // The explanation note is shown with the adapted number.
    expect(screen.getByTestId("adaptive-note-target")).toHaveTextContent(
      "1600 kcal"
    );
  });

  it("test_a_training_suggestion_is_shown_when_food_alone_cannot_absorb_the_overshoot", () => {
    render(
      <HomeScreen
        initialLogs={[makeLog({ kcal: 200 })]}
        target={makeTarget({ daily_kcal: 2000 })}
        adaptivePlan={{
          ...adjustedPlan,
          adaptiveDailyTarget: 1400,
          trainingSuggestionKcal: 800,
          trainingWalkMinutes: 160,
        }}
      />
    );

    expect(screen.getByTestId("adaptive-note-training")).toHaveTextContent(
      "~800 kcal"
    );
    expect(screen.getByTestId("adaptive-note-training")).toHaveTextContent(
      "160 min"
    );
  });

  it("test_no_note_and_base_target_when_the_week_is_on_track", () => {
    render(
      <HomeScreen
        initialLogs={[makeLog({ kcal: 200 })]}
        target={makeTarget({ daily_kcal: 2000 })}
        adaptivePlan={null}
      />
    );

    expect(screen.queryByTestId("adaptive-note")).not.toBeInTheDocument();
    // Falls back to the plain daily target.
    expect(screen.getByTestId("home-ring-target")).toHaveTextContent("2000");
  });
});
