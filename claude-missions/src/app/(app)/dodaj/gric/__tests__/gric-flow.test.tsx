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
const estimateGricTextAction = vi.fn();
const logGricAction = vi.fn();
vi.mock("../actions", () => ({
  estimateGricAction: (...args: unknown[]) => estimateGricAction(...args),
  estimateGricTextAction: (...args: unknown[]) => estimateGricTextAction(...args),
  logGricAction: (...args: unknown[]) => logGricAction(...args),
}));

vi.mock("@/lib/audio/record-wav", () => ({
  startWavRecording: async () => ({
    stop: async () => new Blob(["x"], { type: "audio/wav" }),
    cancel: () => {},
  }),
}));

import { GricFlow } from "../gric-flow";

/** The composer's one text field, by its (visually hidden) label. */
const composer = () => screen.getByLabelText("Opiši šta si gricnuo");

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

/** Types a sentence and lands on the review screen with the given estimate. */
async function type(sentence: string, stavke: ReturnType<typeof item>[]) {
  estimateGricTextAction.mockResolvedValue({ ok: true, data: { stavke } });
  logGricAction.mockResolvedValue({ ok: true, saved: 1 });

  render(<GricFlow frequent={[]} />);

  fireEvent.change(composer(), { target: { value: sentence } });
  fireEvent.click(screen.getByLabelText("Pošalji opis"));
  await screen.findByText("Ukupno");
}

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


// The composer (2026-08-24). Gric grew a second mouth: you can type what you
// ate instead of saying it. These lock the two things that make that a real
// path rather than a fallback nobody can reach -- the ONE button switches to
// send as soon as there is something to send, and a typed gric produces the
// same review screen and the same saved entry a spoken one does.

describe("Gric composer: one button, two ways in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offers the microphone until there is something typed to send", () => {
    render(<GricFlow frequent={[]} />);

    // Empty composer: speaking is what the screen is offering.
    expect(screen.getByLabelText("Počni snimanje")).toBeInTheDocument();
    expect(screen.queryByLabelText("Pošalji opis")).not.toBeInTheDocument();

    fireEvent.change(composer(), { target: { value: "krastavac" } });

    // The same seal, now the send button -- never both at once.
    expect(screen.getByLabelText("Pošalji opis")).toBeInTheDocument();
    expect(screen.queryByLabelText("Počni snimanje")).not.toBeInTheDocument();
  });

  it("sends a typed sentence to the model and reviews it like a spoken one", async () => {
    await type("jaja, slanina i hleb", [
      item("Jaja", 0),
      item("Slanina", 0),
      item("Hleb", 0),
    ]);

    expect(estimateGricTextAction).toHaveBeenCalledWith("jaja, slanina i hleb");
    // Same grouping, same joined name, same saved shape as the spoken path.
    expect(screen.getByText("Jaja, slanina i hleb")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Sačekaj, hoću da doteram"));
    fireEvent.click(screen.getByRole("button", { name: "Dodaj u dan" }));

    await waitFor(() => expect(logGricAction).toHaveBeenCalled());
    expect(savedGroups()).toEqual([0, 0, 0]);
  });

  it("never sends blank text, however much whitespace is in the field", () => {
    render(<GricFlow frequent={[]} />);

    fireEvent.change(composer(), { target: { value: "   " } });

    // Whitespace is not something to send: the seal stays the microphone.
    expect(screen.getByLabelText("Počni snimanje")).toBeInTheDocument();
    expect(estimateGricTextAction).not.toHaveBeenCalled();
  });

  it("keeps the sentence when the model found no food in it", async () => {
    estimateGricTextAction.mockResolvedValue({
      ok: true,
      data: { stavke: [] },
    });
    render(<GricFlow frequent={[]} />);

    fireEvent.change(composer(), { target: { value: "hm" } });
    fireEvent.click(screen.getByLabelText("Pošalji opis"));

    await screen.findByRole("alert");
    // Retyping a sentence the model half-understood costs more than the snack
    // is worth, so the text survives the miss and can just be edited.
    expect(composer()).toHaveValue("hm");
  });
});
