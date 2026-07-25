import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { HabitsScreen } from "@/components/profil/habits-screen";
import type { HabitProgress } from "@/lib/habits/streak";

// The server actions are the boundary this component talks to -- mocked so the
// tests exercise the screen's own optimistic-update / revert behaviour.
const toggleHabitAction = vi.fn();
const updateRulesAction = vi.fn();
const regenerateRulesAction = vi.fn();

vi.mock("@/app/(app)/profil/pravila/actions", () => ({
  toggleHabitAction: (...args: unknown[]) => toggleHabitAction(...args),
  updateRulesAction: (...args: unknown[]) => updateRulesAction(...args),
  regenerateRulesAction: (...args: unknown[]) => regenerateRulesAction(...args),
}));

const RULES = [
  { id: "protein", textSr: "Protein u 2 obroka.", enabled: true },
  { id: "povrce", textSr: "Povrće svaki dan.", enabled: true },
  { id: "voda", textSr: "Čaša vode pre obroka.", enabled: false },
];

function habit(
  id: string,
  textSr: string,
  overrides: Partial<HabitProgress> = {}
): HabitProgress {
  return {
    id,
    textSr,
    enabled: true,
    doneToday: false,
    streak: 0,
    doneInHistory: 0,
    recentDays: ["2026-07-13", "2026-07-14", "2026-07-15"].map((dayKey) => ({
      dayKey,
      done: false,
    })),
    ...overrides,
  };
}

const HABITS: HabitProgress[] = [
  habit("protein", "Protein u 2 obroka.", {
    doneToday: true,
    streak: 5,
    doneInHistory: 12,
  }),
  habit("povrce", "Povrće svaki dan."),
  habit("voda", "Čaša vode pre obroka.", { enabled: false }),
];

function renderScreen() {
  return render(
    <HabitsScreen
      initialHabits={HABITS}
      initialRules={RULES}
      dailyKcal={2000}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  toggleHabitAction.mockResolvedValue({ ok: true, done: true });
  updateRulesAction.mockResolvedValue({ ok: true });
});

describe("Navike: the daily list", () => {
  it("test_only_tracked_habits_appear_in_the_daily_list", () => {
    renderScreen();

    expect(screen.getByTestId("habit-check-protein")).toBeInTheDocument();
    expect(screen.getByTestId("habit-check-povrce")).toBeInTheDocument();
    // Disabled habit is settings-only, never a daily row.
    expect(screen.queryByTestId("habit-check-voda")).not.toBeInTheDocument();
  });

  it("test_todays_progress_counts_only_tracked_habits", () => {
    renderScreen();
    expect(screen.getByTestId("habits-today-progress")).toHaveTextContent("1/2");
  });

  it("test_a_running_streak_is_shown_next_to_the_habit", () => {
    renderScreen();
    expect(screen.getByTestId("habit-streak-protein")).toHaveTextContent("5");
    // No streak yet -> no flame at all, rather than a bare "0".
    expect(screen.queryByTestId("habit-streak-povrce")).not.toBeInTheDocument();
  });

  it("test_checking_a_habit_updates_the_row_and_persists_it", async () => {
    renderScreen();

    fireEvent.click(screen.getByTestId("habit-check-povrce"));

    // Optimistic: pressed state and the progress count move immediately.
    expect(screen.getByTestId("habit-check-povrce")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByTestId("habits-today-progress")).toHaveTextContent("2/2");
    expect(screen.getByTestId("habit-streak-povrce")).toHaveTextContent("1");

    await waitFor(() =>
      expect(toggleHabitAction).toHaveBeenCalledWith("povrce", true)
    );
  });

  it("test_unchecking_a_habit_sends_done_false_and_lowers_the_streak", async () => {
    renderScreen();

    fireEvent.click(screen.getByTestId("habit-check-protein"));

    expect(screen.getByTestId("habit-check-protein")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByTestId("habit-streak-protein")).toHaveTextContent("4");

    await waitFor(() =>
      expect(toggleHabitAction).toHaveBeenCalledWith("protein", false)
    );
  });

  it("test_a_failed_check_reverts_the_row_and_explains_why", async () => {
    toggleHabitAction.mockResolvedValue({
      ok: false,
      error_sr: "Nema veze sa internetom.",
    });
    renderScreen();

    fireEvent.click(screen.getByTestId("habit-check-povrce"));

    await waitFor(() =>
      expect(screen.getByTestId("save-error")).toHaveTextContent(
        "Nema veze sa internetom."
      )
    );
    expect(screen.getByTestId("habit-check-povrce")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByTestId("habits-today-progress")).toHaveTextContent("1/2");
  });
});

describe("Navike: the settings panel", () => {
  it("test_settings_are_collapsed_until_asked_for", () => {
    renderScreen();

    expect(
      screen.queryByTestId("habits-settings-panel")
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("habits-settings-toggle"));

    expect(screen.getByTestId("habits-settings-panel")).toBeInTheDocument();
    // Every habit is listed there, tracked or not.
    expect(screen.getByTestId("habit-setting-voda")).toBeInTheDocument();
  });

  it("test_turning_a_habit_off_removes_it_from_the_daily_list", async () => {
    renderScreen();
    fireEvent.click(screen.getByTestId("habits-settings-toggle"));

    fireEvent.click(screen.getByTestId("habit-toggle-povrce"));

    expect(screen.queryByTestId("habit-check-povrce")).not.toBeInTheDocument();
    expect(screen.getByTestId("habits-today-progress")).toHaveTextContent("1/1");
    await waitFor(() => expect(updateRulesAction).toHaveBeenCalled());
  });

  it("test_the_track_switch_is_a_real_switch_with_state", () => {
    renderScreen();
    fireEvent.click(screen.getByTestId("habits-settings-toggle"));

    expect(screen.getByTestId("habit-toggle-protein")).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByTestId("habit-toggle-voda")).toHaveAttribute(
      "aria-checked",
      "false"
    );
    // Never disabled mid-save: a frozen switch reads as broken.
    expect(screen.getByTestId("habit-toggle-protein")).not.toBeDisabled();
  });

  it("test_editing_a_habits_text_updates_both_the_list_and_the_settings", async () => {
    renderScreen();
    fireEvent.click(screen.getByTestId("habits-settings-toggle"));

    fireEvent.click(screen.getByLabelText("Izmeni tekst: Povrće svaki dan."));
    fireEvent.change(screen.getByLabelText("Izmeni tekst navike"), {
      target: { value: "Povrće uz svaki obrok." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sačuvaj" }));

    expect(screen.getByTestId("habit-check-povrce")).toHaveTextContent(
      "Povrće uz svaki obrok."
    );
    await waitFor(() => expect(updateRulesAction).toHaveBeenCalled());
  });

  it("test_an_empty_edit_is_rejected_before_it_is_sent", () => {
    renderScreen();
    fireEvent.click(screen.getByTestId("habits-settings-toggle"));

    fireEvent.click(screen.getByLabelText("Izmeni tekst: Povrće svaki dan."));
    fireEvent.change(screen.getByLabelText("Izmeni tekst navike"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sačuvaj" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Pravilo ne sme biti prazno."
    );
    expect(updateRulesAction).not.toHaveBeenCalled();
  });
});

describe("Navike: empty states and navigation", () => {
  it("test_there_is_always_a_way_back_to_podesavanja", () => {
    renderScreen();
    expect(screen.getByRole("link", { name: /Podešavanja/ })).toHaveAttribute(
      "href",
      "/profil"
    );
  });

  it("test_a_user_with_no_habits_is_offered_a_starting_set", () => {
    render(
      <HabitsScreen initialHabits={[]} initialRules={[]} dailyKcal={null} />
    );

    expect(screen.getByTestId("habits-empty-state")).toHaveTextContent(
      "Još uvek nemaš navike."
    );
    expect(
      screen.getByRole("button", { name: "Predloži mi navike" })
    ).toBeInTheDocument();
  });

  it("test_tracking_nothing_points_at_the_settings_instead_of_regenerating", () => {
    render(
      <HabitsScreen
        initialHabits={HABITS.map((h) => ({ ...h, enabled: false }))}
        initialRules={RULES.map((r) => ({ ...r, enabled: false }))}
        dailyKcal={null}
      />
    );

    expect(screen.getByTestId("habits-empty-state")).toHaveTextContent(
      "Ne pratiš nijednu naviku."
    );
    expect(
      screen.queryByRole("button", { name: "Predloži mi navike" })
    ).not.toBeInTheDocument();
  });
});
