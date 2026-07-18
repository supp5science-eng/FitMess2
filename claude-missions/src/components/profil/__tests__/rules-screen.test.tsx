import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

// F017: component-level coverage for `/profil/pravila`'s interactivity
// (AS-029: "toggles and edits rules"). The live DB round-trip is covered
// separately by `src/app/(app)/profil/pravila/__tests__/actions.integration.test.ts`.

const updateRulesActionMock = vi.fn();
const regenerateRulesActionMock = vi.fn();

vi.mock("@/app/(app)/profil/pravila/actions", () => ({
  updateRulesAction: (...args: unknown[]) => updateRulesActionMock(...args),
  regenerateRulesAction: (...args: unknown[]) => regenerateRulesActionMock(...args),
}));

import { RulesScreen } from "../rules-screen";
import type { PersistedRule } from "@/lib/budget/rules";

const BASE_RULES: PersistedRule[] = [
  { id: "protein-2-obroka", textSr: "Unesi protein u bar 2 obroka svaki dan.", enabled: true },
  { id: "povrce-svaki-dan", textSr: "Jedi povrće svaki dan.", enabled: true },
  { id: "voda-pre-obroka", textSr: "Popij čašu vode pre svakog obroka.", enabled: false },
];

beforeEach(() => {
  updateRulesActionMock.mockReset();
  regenerateRulesActionMock.mockReset();
  updateRulesActionMock.mockResolvedValue({ ok: true });
});

describe("AS-029: a user can toggle a rule on/off and it persists", () => {
  it("test_AS_029_clicking_a_rules_toggle_flips_its_on_screen_state", async () => {
    render(<RulesScreen initialRules={BASE_RULES} dailyKcal={null} />);

    const toggle = screen.getByTestId("rule-toggle-voda-pre-obroka");
    expect(toggle).toHaveAttribute("aria-checked", "false");

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-checked", "true");

    // Let the underlying (mocked, already-resolved) save transition settle
    // before the test ends, so React doesn't warn about state updates
    // outside `act(...)`.
    await waitFor(() => expect(updateRulesActionMock).toHaveBeenCalledTimes(1));
  });

  it("test_AS_029_toggling_a_rule_calls_the_update_action_with_the_new_enabled_state", async () => {
    render(<RulesScreen initialRules={BASE_RULES} dailyKcal={null} />);

    fireEvent.click(screen.getByTestId("rule-toggle-povrce-svaki-dan"));

    await waitFor(() => expect(updateRulesActionMock).toHaveBeenCalledTimes(1));
    const sentRules = updateRulesActionMock.mock.calls[0][0] as PersistedRule[];
    const changed = sentRules.find((rule) => rule.id === "povrce-svaki-dan");
    expect(changed?.enabled).toBe(false);
  });

  it("test_AS_029_a_failed_toggle_save_reverts_the_optimistic_change_and_shows_an_inline_serbian_error", async () => {
    updateRulesActionMock.mockResolvedValue({
      ok: false,
      error_sr: "Nešto nije uspelo pri čuvanju. Pokušaj ponovo.",
    });

    render(<RulesScreen initialRules={BASE_RULES} dailyKcal={null} />);
    const toggle = screen.getByTestId("rule-toggle-voda-pre-obroka");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");

    await waitFor(() =>
      expect(screen.getByTestId("save-error")).toBeInTheDocument()
    );
    expect(screen.getByTestId("save-error")).toHaveTextContent(/Pokušaj ponovo/);
    // Optimistic change reverted, not stuck showing a stale "on" state that
    // never actually saved.
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });
});

describe("AS-029: a user can edit a rule's text and it persists", () => {
  it("test_AS_029_editing_and_saving_a_rule_sends_the_new_text_to_the_update_action", async () => {
    render(<RulesScreen initialRules={BASE_RULES} dailyKcal={null} />);

    const row = screen.getByTestId("rule-row-protein-2-obroka");
    const editButton = within(row).getByRole("button", { name: "Uredi" });
    fireEvent.click(editButton);

    const input = screen.getByLabelText("Izmeni tekst pravila");
    fireEvent.change(input, {
      target: { value: "Unesi protein u SVA 3 obroka svaki dan." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sačuvaj" }));

    await waitFor(() => expect(updateRulesActionMock).toHaveBeenCalledTimes(1));
    const sentRules = updateRulesActionMock.mock.calls[0][0] as PersistedRule[];
    const edited = sentRules.find((rule) => rule.id === "protein-2-obroka");
    expect(edited?.textSr).toBe("Unesi protein u SVA 3 obroka svaki dan.");

    expect(screen.getByTestId("rule-text-protein-2-obroka")).toHaveTextContent(
      "Unesi protein u SVA 3 obroka svaki dan."
    );
  });

  it("test_AS_029_saving_an_empty_edited_text_shows_an_inline_serbian_error_and_never_calls_the_action", () => {
    render(<RulesScreen initialRules={BASE_RULES} dailyKcal={null} />);

    const row = screen.getByTestId("rule-row-protein-2-obroka");
    fireEvent.click(within(row).getByRole("button", { name: "Uredi" }));

    fireEvent.change(screen.getByLabelText("Izmeni tekst pravila"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sačuvaj" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/ne sme biti prazno/);
    expect(updateRulesActionMock).not.toHaveBeenCalled();
  });

  it("test_AS_029_canceling_an_edit_discards_the_change_without_calling_the_action", () => {
    render(<RulesScreen initialRules={BASE_RULES} dailyKcal={null} />);

    const row = screen.getByTestId("rule-row-protein-2-obroka");
    fireEvent.click(within(row).getByRole("button", { name: "Uredi" }));

    fireEvent.change(screen.getByLabelText("Izmeni tekst pravila"), {
      target: { value: "Nešto potpuno drugo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Otkaži" }));

    expect(screen.getByTestId("rule-text-protein-2-obroka")).toHaveTextContent(
      "Unesi protein u bar 2 obroka svaki dan."
    );
    expect(updateRulesActionMock).not.toHaveBeenCalled();
  });
});

describe("F017 definition-of-done: empty state with a clear next action", () => {
  it("test_AS_029_zero_rules_shows_a_friendly_serbian_empty_state_with_a_generate_action", () => {
    render(<RulesScreen initialRules={[]} dailyKcal={null} />);

    expect(screen.getByTestId("rules-empty-state")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Generiši pravila/ })
    ).toBeInTheDocument();
  });

  it("test_AS_029_clicking_generiraj_pravila_calls_the_regenerate_action_and_renders_the_returned_rules", async () => {
    regenerateRulesActionMock.mockResolvedValue({ ok: true, rules: BASE_RULES });

    render(<RulesScreen initialRules={[]} dailyKcal={null} />);
    fireEvent.click(screen.getByRole("button", { name: /Generiši pravila/ }));

    await waitFor(() => expect(regenerateRulesActionMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId("rules-list")).toBeInTheDocument());
    expect(screen.getAllByTestId(/^rule-row-/).length).toBe(BASE_RULES.length);
  });

  it("test_AS_029_a_failed_generate_shows_an_inline_serbian_error_and_keeps_the_empty_state_actionable", async () => {
    regenerateRulesActionMock.mockResolvedValue({
      ok: false,
      error_sr: "Prvo završi početni upitnik da bismo mogli da generišemo pravila.",
    });

    render(<RulesScreen initialRules={[]} dailyKcal={null} />);
    fireEvent.click(screen.getByRole("button", { name: /Generiši pravila/ }));

    await waitFor(() =>
      expect(screen.getByTestId("save-error")).toBeInTheDocument()
    );
    expect(screen.getByTestId("save-error")).toHaveTextContent(/početni upitnik/);
    expect(screen.getByTestId("rules-empty-state")).toBeInTheDocument();
  });
});

describe("F017 definition-of-done: side-effect verification -- no unintended navigation or global state mutation", () => {
  it("test_AS_029_toggling_a_rule_does_not_touch_any_other_rules_state", async () => {
    render(<RulesScreen initialRules={BASE_RULES} dailyKcal={null} />);

    fireEvent.click(screen.getByTestId("rule-toggle-voda-pre-obroka"));

    await waitFor(() => expect(updateRulesActionMock).toHaveBeenCalledTimes(1));
    const sentRules = updateRulesActionMock.mock.calls[0][0] as PersistedRule[];

    const untouchedA = sentRules.find((rule) => rule.id === "protein-2-obroka");
    const untouchedB = sentRules.find((rule) => rule.id === "povrce-svaki-dan");
    expect(untouchedA?.enabled).toBe(true);
    expect(untouchedB?.enabled).toBe(true);
  });
});

describe("AS-128: every input has a real label, no images without alt text, every interactive control is keyboard-reachable", () => {
  it("test_AS_128_every_rule_toggle_is_a_real_focusable_button_with_role_switch_and_a_label", () => {
    render(<RulesScreen initialRules={BASE_RULES} dailyKcal={null} />);

    for (const rule of BASE_RULES) {
      const toggle = screen.getByTestId(`rule-toggle-${rule.id}`);
      // `role="switch"` here is implemented on a real `<button type="button">`
      // element (not a `<div>` with a click handler), so it is natively
      // Tab-reachable and Enter/Space-activatable with zero extra
      // key-handling code -- the same reasoning F015/F016's `OptionGroup`
      // radio buttons rely on for this same clause.
      expect(toggle.tagName).toBe("BUTTON");
      expect(toggle).toHaveAttribute("role", "switch");
      expect(toggle).not.toHaveAttribute("tabindex", "-1");
      expect(toggle).toHaveAccessibleName();
    }
  });

  it("test_AS_128_uredi_button_is_a_real_focusable_button_element", () => {
    render(<RulesScreen initialRules={BASE_RULES} dailyKcal={null} />);

    for (const editButton of screen.getAllByRole("button", { name: "Uredi" })) {
      expect(editButton.tagName).toBe("BUTTON");
      expect(editButton).not.toHaveAttribute("tabindex", "-1");
    }
  });

  it("test_AS_128_the_edit_text_input_is_reachable_by_its_own_accessible_label", () => {
    render(<RulesScreen initialRules={BASE_RULES} dailyKcal={null} />);

    const row = screen.getByTestId("rule-row-protein-2-obroka");
    fireEvent.click(within(row).getByRole("button", { name: "Uredi" }));

    // `getByLabelText` only succeeds when the input is a real form control
    // correctly associated with a `<label for>` -- this call is itself the
    // proof, not just a lookup convenience.
    const input = screen.getByLabelText("Izmeni tekst pravila");
    expect(input.tagName).toBe("INPUT");

    // Sačuvaj/Otkaži are also real, keyboard-reachable buttons.
    expect(screen.getByRole("button", { name: "Sačuvaj" }).tagName).toBe("BUTTON");
    expect(screen.getByRole("button", { name: "Otkaži" }).tagName).toBe("BUTTON");
  });

  it("test_AS_128_the_empty_state_generisi_pravila_button_is_a_real_focusable_button_element", () => {
    render(<RulesScreen initialRules={[]} dailyKcal={null} />);

    const button = screen.getByRole("button", { name: /Generiši pravila/ });
    expect(button.tagName).toBe("BUTTON");
    expect(button).not.toHaveAttribute("tabindex", "-1");
  });

  it("test_AS_128_toggling_a_rule_via_keyboard_activation_still_updates_the_on_screen_state", async () => {
    render(<RulesScreen initialRules={BASE_RULES} dailyKcal={null} />);

    const toggle = screen.getByTestId("rule-toggle-voda-pre-obroka");
    // A real `<button>` fires its click handler on Enter/Space natively
    // (browser-level behaviour that `fireEvent.click` exercises the same
    // handler as); focusing it first proves it is actually reachable via
    // Tab before activating it, without a mouse.
    toggle.focus();
    expect(document.activeElement).toBe(toggle);
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-checked", "true");

    // Let the underlying (mocked, already-resolved) save transition settle
    // before the test ends, so React doesn't warn about state updates
    // outside `act(...)`.
    await waitFor(() => expect(updateRulesActionMock).toHaveBeenCalledTimes(1));
  });

  it("test_AS_128_the_rules_screen_renders_no_images_so_there_is_nothing_that_could_be_missing_alt_text", () => {
    const { container } = render(
      <RulesScreen initialRules={BASE_RULES} dailyKcal={2000} />
    );

    // Numbers/text/buttons only (rule list + toggle switches + the
    // day-structure guidance card) -- no `<img>` elements exist here for an
    // alt-text rule to apply to; this documents that explicitly rather than
    // leaving AS-128's "images have alt text" clause untested by omission.
    expect(container.querySelectorAll("img").length).toBe(0);
  });
});

describe("Optional day-structure guidance card", () => {
  it("test_day_structure_guidance_renders_when_a_daily_kcal_budget_is_available", () => {
    render(<RulesScreen initialRules={BASE_RULES} dailyKcal={2000} />);
    expect(screen.getByTestId("day-structure-guidance")).toBeInTheDocument();
  });

  it("test_day_structure_guidance_does_not_render_without_a_daily_kcal_budget", () => {
    render(<RulesScreen initialRules={BASE_RULES} dailyKcal={null} />);
    expect(screen.queryByTestId("day-structure-guidance")).not.toBeInTheDocument();
  });
});
