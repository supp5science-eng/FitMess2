import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

import { NameScreen } from "../name-screen";

// The post-registration "Kako da te zovemo?" screen: the one question the
// (now anonymous) questionnaire never asks. Purely presentational — collects
// a valid name and hands the trimmed value up via `onSubmit` after its outro.

const onSubmit = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  onSubmit.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /Nastavi/ }));
}

describe("NameScreen", () => {
  it("renders the question and a labeled name input", () => {
    render(<NameScreen onSubmit={onSubmit} />);
    expect(
      screen.getByRole("heading", { name: /Kako da te zovemo\?/ })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Ime/)).toBeInTheDocument();
  });

  it("blocks submit with a Serbian error while the name is blank", () => {
    render(<NameScreen onSubmit={onSubmit} />);
    submit();
    expect(screen.getByRole("alert")).toHaveTextContent(/ime/i);
    act(() => {
      vi.runAllTimers();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the trimmed name after the outro plays", () => {
    render(<NameScreen onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/Ime/), {
      target: { value: "  Ana  " },
    });
    submit();
    // The outro animation plays first…
    expect(onSubmit).not.toHaveBeenCalled();
    act(() => {
      vi.runAllTimers();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("Ana");
  });

  it("typing clears a previous validation error", () => {
    render(<NameScreen onSubmit={onSubmit} />);
    submit();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Ime/), {
      target: { value: "A" },
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
