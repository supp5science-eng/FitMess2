import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// `/profil/pravila` -- "Navike". Proves the route joins the habit definitions
// (`profiles.rules`) with the check-off history (`habit_checks`) into a usable
// daily list, shows the friendly empty state when `rules` is still the
// migration's `[]` default, and renders an inline Serbian retry (never a blank
// screen) when the profile read fails.

const updateRulesActionMock = vi.fn();
const regenerateRulesActionMock = vi.fn();
const toggleHabitActionMock = vi.fn();
vi.mock("@/app/(app)/profil/pravila/actions", () => ({
  updateRulesAction: (...args: unknown[]) => updateRulesActionMock(...args),
  regenerateRulesAction: (...args: unknown[]) => regenerateRulesActionMock(...args),
  toggleHabitAction: (...args: unknown[]) => toggleHabitActionMock(...args),
}));

type MockUser = { id: string } | null;

function mockCreateClient(options: {
  user?: MockUser;
  rules?: { id: string; textSr: string; enabled: boolean }[];
  profileError?: { message: string };
  dailyKcal?: number | null;
  /** Rows the `habit_checks` read returns (habit_id + Belgrade day key). */
  checks?: { habit_id: string; day: string }[];
  checksError?: { message: string };
}) {
  const user = options.user === undefined ? { id: "user-1" } : options.user;

  return {
    auth: {
      // The page resolves identity via `getClaims` (local verify); `getUser`
      // is kept for any other caller but no longer drives this page.
      getClaims: vi.fn().mockResolvedValue({
        data: { claims: user ? { sub: user.id } : null },
        error: null,
      }),
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: options.profileError ? null : { rules: options.rules ?? [] },
                error: options.profileError ?? null,
              }),
            }),
          }),
        };
      }
      if (table === "targets") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data:
                      options.dailyKcal === undefined
                        ? null
                        : { daily_kcal: options.dailyKcal },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "habit_checks") {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lte: vi.fn().mockResolvedValue({
                  data: options.checksError ? null : options.checks ?? [],
                  error: options.checksError ?? null,
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table in test double: ${table}`);
    }),
  };
}

const createClientMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClientMock(),
}));

import PravilaPage from "../page";

/** Today's Belgrade day key, computed the same way the page does -- these
 * tests must not hard-code a date or they rot overnight. */
async function todayKey(): Promise<string> {
  const { toBelgradeCalendarDay } = await import("@/lib/dates");
  return toBelgradeCalendarDay();
}

describe("/profil/pravila renders the user's habits", () => {
  it("test_renders_the_tracked_habits_with_their_check_state", async () => {
    createClientMock.mockResolvedValue(
      mockCreateClient({
        rules: [
          { id: "protein-2-obroka", textSr: "Unesi protein u bar 2 obroka svaki dan.", enabled: true },
          { id: "povrce-svaki-dan", textSr: "Jedi povrće svaki dan.", enabled: true },
          { id: "voda-pre-obroka", textSr: "Popij čašu vode pre svakog obroka.", enabled: false },
        ],
        checks: [{ habit_id: "protein-2-obroka", day: await todayKey() }],
        dailyKcal: 1900,
      })
    );

    const ui = await PravilaPage();
    render(ui);

    expect(screen.getByTestId("habits-list")).toBeInTheDocument();
    // Two tracked habits (the third is switched off -> settings only).
    expect(screen.getAllByTestId(/^habit-check-/).length).toBe(2);
    // The check row read from `habit_checks` arrives already checked.
    expect(screen.getByTestId("habit-check-protein-2-obroka")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByTestId("habits-today-progress")).toHaveTextContent("1/2");
    expect(screen.getByTestId("day-structure-guidance")).toBeInTheDocument();
  });

  it("test_a_failed_history_read_still_renders_the_habits", async () => {
    // History is a nice-to-have; losing it must not cost the user the screen.
    createClientMock.mockResolvedValue(
      mockCreateClient({
        rules: [
          { id: "povrce-svaki-dan", textSr: "Jedi povrće svaki dan.", enabled: true },
        ],
        checksError: { message: "db unreachable" },
      })
    );

    const ui = await PravilaPage();
    render(ui);

    expect(screen.getByTestId("habit-check-povrce-svaki-dan")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });
});

describe("empty state: a profile with no habits yet gets a friendly Serbian next action", () => {
  it("test_zero_habits_renders_the_empty_state_with_a_suggest_button", async () => {
    createClientMock.mockResolvedValue(mockCreateClient({ rules: [] }));

    const ui = await PravilaPage();
    render(ui);

    expect(screen.getByTestId("habits-empty-state")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Predloži mi navike/ })
    ).toBeInTheDocument();
  });
});

describe("failure-state render test (forced failure shows Serbian retry)", () => {
  it("test_a_failed_profile_read_shows_an_inline_serbian_error_with_a_retry_link_not_a_blank_screen", async () => {
    createClientMock.mockResolvedValue(
      mockCreateClient({ profileError: { message: "db unreachable" } })
    );

    const ui = await PravilaPage();
    render(ui);

    expect(screen.getByTestId("pravila-load-error")).toBeInTheDocument();
    expect(screen.getByTestId("pravila-load-error")).not.toHaveTextContent(
      /db unreachable/
    );
    expect(
      screen.getByRole("link", { name: /Pokušaj ponovo/ })
    ).toHaveAttribute("href", "/profil/pravila");
  });

  it("test_no_session_shows_an_inline_serbian_error_not_a_blank_screen", async () => {
    createClientMock.mockResolvedValue(mockCreateClient({ user: null }));

    const ui = await PravilaPage();
    render(ui);

    expect(screen.getByTestId("pravila-load-error")).toBeInTheDocument();
  });
});
