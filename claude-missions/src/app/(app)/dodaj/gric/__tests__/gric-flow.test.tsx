import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Gric groups what was eaten TOGETHER into one entry (2026-08-02). These tests
// lock the two things that decide whether the day reads correctly:
//   - one spoken plate ("jaja, slaninu i hleb") becomes ONE card and ONE saved
//     entry, with its parts kept as a breakdown;
//   - the user can overrule the model in a single tap, in both directions.
// The model's grouping arrives from the server action, so that is what is
// mocked here -- everything below it is the real component.

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const estimateGricAction = vi.fn();
const logGricAction = vi.fn();
vi.mock("../actions", () => ({
  estimateGricAction: (...args: unknown[]) => estimateGricAction(...args),
  logGricAction: (...args: unknown[]) => logGricAction(...args),
}));

vi.mock("@/lib/audio/record-wav", () => ({
  startWavRecording: async () => ({
    stop: async () => new Blob(["x"], { type: "audio/wav" }),
    cancel: () => {},
  }),
}));

import { GricFlow } from "../gric-flow";

const item = (naziv: string, grupa: number, kcal = 150) => ({
  naziv,
  kolicina: "1 komad",
  grami: 100,
  kcal,
  protein_g: 5,
  uh_g: 10,
  mast_g: 8,
  varijansa: "niska" as const,
  grupa,
});

/** Records a clip and lands on the review screen with the given estimate. */
async function speak(stavke: ReturnType<typeof item>[]) {
  estimateGricAction.mockResolvedValue({ ok: true, data: { stavke } });
  logGricAction.mockResolvedValue({ ok: true, saved: 1 });

  render(<GricFlow frequent={[]} />);

  fireEvent.click(screen.getByLabelText("Počni snimanje"));
  await screen.findByLabelText("Zaustavi snimanje");
  fireEvent.click(screen.getByLabelText("Zaustavi snimanje"));
  await screen.findByText("Ukupno");
}

const savedGroups = (): number[] =>
  (logGricAction.mock.calls.at(-1)?.[0] as { group?: number }[]).map(
    (row) => row.group ?? -1
  );

describe("Gric review screen: one plate is one entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows items eaten together under one joined name", async () => {
    await speak([item("Jaja", 0), item("Slanina", 0), item("Hleb", 0)]);

    // The header is the entry the day will actually show.
    expect(screen.getByText("Jaja, slanina i hleb")).toBeInTheDocument();
    expect(screen.getByText("Nije bio isti obrok — razdvoji")).toBeInTheDocument();
    // Nothing to merge: there is only one occasion.
    expect(screen.queryByText("Sve je bio jedan obrok")).not.toBeInTheDocument();
  });

  it("saves them as a single occasion", async () => {
    await speak([item("Jaja", 0), item("Slanina", 0), item("Hleb", 0)]);

    // Nothing here varies enough to ask about, so the auto-save countdown is
    // running; stopping it is what a user who wants to look first would do.
    fireEvent.click(screen.getByText("Sačekaj, hoću da doteram"));
    fireEvent.click(screen.getByRole("button", { name: "Dodaj u dan" }));

    await waitFor(() => expect(logGricAction).toHaveBeenCalled());
    expect(savedGroups()).toEqual([0, 0, 0]);
  });

  it("keeps separate sittings apart, and offers to merge them", async () => {
    await speak([item("Čokolada", 0), item("Sladoled", 1)]);

    expect(screen.queryByText("Čokolada i sladoled")).not.toBeInTheDocument();
    expect(screen.getByText("Sve je bio jedan obrok")).toBeInTheDocument();
  });
});

describe("Gric review screen: the user overrules the grouping in one tap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("'Razdvoji' turns one plate back into separate entries", async () => {
    await speak([item("Jaja", 0), item("Slanina", 0)]);

    fireEvent.click(screen.getByText("Nije bio isti obrok — razdvoji"));

    expect(screen.queryByText("Jaja i slanina")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dodaj u dan" }));

    await waitFor(() => expect(logGricAction).toHaveBeenCalled());
    const groups = savedGroups();
    expect(new Set(groups).size).toBe(2);
  });

  it("'Sve je bio jedan obrok' joins everything the clip mentioned", async () => {
    await speak([item("Čokolada", 0), item("Sladoled", 1)]);

    fireEvent.click(screen.getByText("Sve je bio jedan obrok"));

    expect(screen.getByText("Čokolada i sladoled")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dodaj u dan" }));

    await waitFor(() => expect(logGricAction).toHaveBeenCalled());
    expect(savedGroups()).toEqual([0, 0]);
  });

  it("removing the last item of an occasion leaves it restorable", async () => {
    await speak([item("Čokolada", 0), item("Sladoled", 1)]);

    fireEvent.click(screen.getByLabelText("Ukloni Sladoled"));

    // The card must not disappear -- its "vrati" affordance goes with it.
    expect(screen.getByLabelText("Vrati Sladoled")).toBeInTheDocument();
  });
});
