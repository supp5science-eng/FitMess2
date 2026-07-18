import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// F017: the actual `/profil/pravila` route -- proves it renders the real
// rules list for a signed-in user with generated rules (AS-028's result,
// AS-029's edit surface), the friendly empty state when `rules` is still
// the migration's `[]` default, and an inline Serbian retry (never a blank
// screen) when the profile read fails.

const updateRulesActionMock = vi.fn();
const regenerateRulesActionMock = vi.fn();
vi.mock("@/app/(app)/profil/pravila/actions", () => ({
  updateRulesAction: (...args: unknown[]) => updateRulesActionMock(...args),
  regenerateRulesAction: (...args: unknown[]) => regenerateRulesActionMock(...args),
}));

type MockUser = { id: string } | null;

function mockCreateClient(options: {
  user?: MockUser;
  rules?: { id: string; textSr: string; enabled: boolean }[];
  profileError?: { message: string };
  dailyKcal?: number | null;
}) {
  const user = options.user === undefined ? { id: "user-1" } : options.user;

  return {
    auth: {
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
      throw new Error(`unexpected table in test double: ${table}`);
    }),
  };
}

const createClientMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClientMock(),
}));

import PravilaPage from "../page";

describe("AS-028/AS-029: /profil/pravila renders the user's generated rules", () => {
  it("test_AS_029_renders_the_populated_rules_list_for_a_signed_in_user", async () => {
    createClientMock.mockResolvedValue(
      mockCreateClient({
        rules: [
          { id: "protein-2-obroka", textSr: "Unesi protein u bar 2 obroka svaki dan.", enabled: true },
          { id: "povrce-svaki-dan", textSr: "Jedi povrće svaki dan.", enabled: true },
          { id: "voda-pre-obroka", textSr: "Popij čašu vode pre svakog obroka.", enabled: false },
        ],
        dailyKcal: 1900,
      })
    );

    const ui = await PravilaPage();
    render(ui);

    expect(screen.getByTestId("rules-list")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^rule-row-/).length).toBe(3);
    expect(screen.getByTestId("day-structure-guidance")).toBeInTheDocument();
  });
});

describe("AS-029 empty state: a profile with no rules yet gets a friendly Serbian next action", () => {
  it("test_AS_029_zero_rules_renders_the_empty_state_with_a_generate_button", async () => {
    createClientMock.mockResolvedValue(mockCreateClient({ rules: [] }));

    const ui = await PravilaPage();
    render(ui);

    expect(screen.getByTestId("rules-empty-state")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Generiši pravila/ })
    ).toBeInTheDocument();
  });
});

describe("F017 definition-of-done: failure-state render test (forced failure shows Serbian retry)", () => {
  it("test_AS_029_a_failed_profile_read_shows_an_inline_serbian_error_with_a_retry_link_not_a_blank_screen", async () => {
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

  it("test_AS_029_no_session_shows_an_inline_serbian_error_not_a_blank_screen", async () => {
    createClientMock.mockResolvedValue(mockCreateClient({ user: null }));

    const ui = await PravilaPage();
    render(ui);

    expect(screen.getByTestId("pravila-load-error")).toBeInTheDocument();
  });
});
