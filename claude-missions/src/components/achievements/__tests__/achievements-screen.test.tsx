import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { AchievementsScreen } from "@/components/achievements/achievements-screen";
import {
  achievementsSummary,
  evaluateAchievements,
  groupByCategory,
  type UserStats,
} from "@/lib/achievements/achievements";

const ZERO: UserStats = {
  currentStreak: 0,
  bestStreak: 0,
  fullDays: 0,
  totalMeals: 0,
  goalDays: 0,
  waterDays: 0,
  stepDays: 0,
};

function renderScreen(stats: UserStats) {
  const list = evaluateAchievements(stats);
  const { earned, total } = achievementsSummary(list);
  render(
    <AchievementsScreen
      currentStreak={stats.currentStreak}
      bestStreak={stats.bestStreak}
      earned={earned}
      total={total}
      groups={groupByCategory(list)}
    />
  );
  return { earned, total };
}

describe("AchievementsScreen", () => {
  it("has a heading, a back link to /danas, and every category section", () => {
    renderScreen(ZERO);
    expect(
      screen.getByRole("heading", { name: "Dostignuća" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nazad" })).toHaveAttribute(
      "href",
      "/danas"
    );
    for (const label of [
      "Niz",
      "Puni dani",
      "Uneti obroci",
      "Kalorijski cilj",
      "Voda",
      "Koraci",
    ]) {
      expect(
        screen.getByRole("heading", { name: label })
      ).toBeInTheDocument();
    }
  });

  it("shows the badge summary count", () => {
    const { earned, total } = renderScreen({
      ...ZERO,
      totalMeals: 12, // obrok-1, obrok-10
      waterDays: 1, // voda-1
    });
    expect(earned).toBe(3);
    // The summary meter names its progress for assistive tech.
    expect(
      screen.getByLabelText(`${earned} od ${total} bedževa osvojeno`)
    ).toBeInTheDocument();
  });

  it("earned badges read as earned; locked badges show their progress", () => {
    renderScreen({ ...ZERO, totalMeals: 50 });

    // obrok-50 earned -> labelled "osvojeno" with its criteria.
    expect(
      screen.getByLabelText("Redovan: osvojeno, 50 obroka")
    ).toBeInTheDocument();

    // obrok-250 locked -> labelled with progress 50/250, and the tile shows it.
    const locked = screen.getByLabelText("Ozbiljan: zaključano, 50 od 250");
    expect(within(locked).getByText("50 / 250")).toBeInTheDocument();
  });

  it("shows the live streak in the summary card", () => {
    renderScreen({ ...ZERO, currentStreak: 5, bestStreak: 12 });
    expect(screen.getByText("5 dana")).toBeInTheDocument();
    expect(screen.getByText(/najduži: 12 dana/)).toBeInTheDocument();
  });
});
