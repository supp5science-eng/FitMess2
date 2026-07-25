import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// `/profil/koraci` -- "Cilj koraka". The screen that replaced "everybody walks
// 10.000 steps" with a goal derived from the user's activity level, plus an
// override.

const maybeSingleMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
      }),
    }),
}));

const getCurrentUserIdMock = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUserId: () => getCurrentUserIdMock(),
}));

const getCustomStepGoalMock = vi.fn();
const getRecentStepDaysMock = vi.fn();
vi.mock("@/lib/steps/step-goal-read", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/steps/step-goal-read")
  >("@/lib/steps/step-goal-read");
  return {
    ...actual,
    getCustomStepGoal: () => getCustomStepGoalMock(),
    getRecentStepDays: () => getRecentStepDaysMock(),
  };
});

const saveStepGoalActionMock = vi.fn();
vi.mock("../actions", () => ({
  saveStepGoalAction: (...args: unknown[]) => saveStepGoalActionMock(...args),
}));

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import CiljKorakaPage from "../page";

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUserIdMock.mockResolvedValue("user-1");
  maybeSingleMock.mockResolvedValue({ data: { activity_level: "sedentary" } });
  getCustomStepGoalMock.mockResolvedValue(null);
  getRecentStepDaysMock.mockResolvedValue([]);
  saveStepGoalActionMock.mockResolvedValue({ ok: true });
});

describe("Cilj koraka", () => {
  it("test_a_sedentary_user_is_not_shown_a_10000_step_goal", async () => {
    render(await CiljKorakaPage());

    const auto = screen.getByTestId("step-goal-auto");
    expect(auto).toHaveTextContent("5.000");
    expect(auto).not.toHaveTextContent("10.000");
    expect(auto).toHaveTextContent(/sedentaran/i);
  });

  it("test_it_explains_where_the_number_comes_from", async () => {
    // The complaint was "nerealne brojke" -- so the screen has to answer the
    // question the number provokes, not just change it.
    render(await CiljKorakaPage());

    expect(screen.getByText(/Odakle uopšte 10.000 koraka/)).toBeInTheDocument();
    expect(screen.getByText(/manpo-kei/)).toBeInTheDocument();
  });

  it("test_there_is_always_a_way_back_to_podesavanja", async () => {
    render(await CiljKorakaPage());

    expect(screen.getByRole("link", { name: /Podešavanja/ })).toHaveAttribute(
      "href",
      "/profil"
    );
  });

  it("test_choosing_your_own_number_opens_a_picker_and_saves_it", async () => {
    render(await CiljKorakaPage());

    fireEvent.click(screen.getByTestId("step-goal-custom"));
    fireEvent.change(screen.getByTestId("step-goal-select"), {
      target: { value: "6500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sačuvaj cilj" }));

    await screen.findByText("Cilj koraka je sačuvan.");
    expect(saveStepGoalActionMock).toHaveBeenCalledWith({ goal: 6500 });
  });

  it("test_going_back_to_automatic_clears_the_stored_goal", async () => {
    getCustomStepGoalMock.mockResolvedValue(12000);

    render(await CiljKorakaPage());

    fireEvent.click(screen.getByTestId("step-goal-auto"));
    fireEvent.click(screen.getByRole("button", { name: "Sačuvaj cilj" }));

    await screen.findByText("Cilj koraka je sačuvan.");
    expect(saveStepGoalActionMock).toHaveBeenCalledWith({ goal: null });
  });

  it("test_offers_the_users_own_average_once_there_is_enough_history", async () => {
    getRecentStepDaysMock.mockResolvedValue([4000, 4200, 3800, 4100]);

    render(await CiljKorakaPage());
    fireEvent.click(screen.getByTestId("step-goal-custom"));

    const suggestion = screen.getByTestId("step-goal-suggestion");
    expect(suggestion).toHaveTextContent("4.025");

    fireEvent.click(suggestion);
    fireEvent.click(screen.getByRole("button", { name: "Sačuvaj cilj" }));

    await screen.findByText("Cilj koraka je sačuvan.");
    expect(saveStepGoalActionMock).toHaveBeenCalledWith({ goal: 4500 });
  });

  it("test_no_suggestion_is_invented_from_two_days", async () => {
    getRecentStepDaysMock.mockResolvedValue([4000, 4200]);

    render(await CiljKorakaPage());
    fireEvent.click(screen.getByTestId("step-goal-custom"));

    expect(screen.queryByTestId("step-goal-suggestion")).not.toBeInTheDocument();
  });

  it("test_a_failed_save_says_so_and_stays_put", async () => {
    saveStepGoalActionMock.mockResolvedValue({
      ok: false,
      error_sr: "Nismo uspeli da sačuvamo cilj. Pokušaj ponovo.",
    });

    render(await CiljKorakaPage());
    fireEvent.click(screen.getByTestId("step-goal-custom"));
    fireEvent.change(screen.getByTestId("step-goal-select"), {
      target: { value: "8000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sačuvaj cilj" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Nismo uspeli da sačuvamo cilj/
    );
    expect(pushMock).not.toHaveBeenCalled();
  });
});
