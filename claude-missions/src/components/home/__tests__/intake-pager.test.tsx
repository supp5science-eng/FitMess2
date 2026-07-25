import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { IntakePager } from "@/components/home/intake-pager";

const PAGES = [
  { id: "kalorije", labelSr: "Kalorije i makroi", content: <p>Prsten</p> },
  { id: "nutrijenti", labelSr: "Vlakna i šećer", content: <p>Vlakna</p> },
];

describe("IntakePager: the swipe-right second page on the home tab", () => {
  it("renders every page, so both are reachable by swiping", () => {
    render(<IntakePager pages={PAGES} />);

    expect(screen.getByTestId("intake-page-kalorije")).toHaveTextContent(
      "Prsten"
    );
    expect(screen.getByTestId("intake-page-nutrijenti")).toHaveTextContent(
      "Vlakna"
    );
  });

  it("labels each page for assistive tech", () => {
    render(<IntakePager pages={PAGES} />);

    expect(
      screen.getByRole("region", { name: "Kalorije i makroi" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Vlakna i šećer" })
    ).toBeInTheDocument();
  });

  it("shows one dot per page, with the first one current", () => {
    render(<IntakePager pages={PAGES} />);

    const dots = screen.getAllByRole("button", { name: /^Prikaži:/ });
    expect(dots).toHaveLength(2);
    expect(dots[0]).toHaveAttribute("aria-current", "true");
    expect(dots[1]).not.toHaveAttribute("aria-current");
  });

  it("scrolls to a page when its dot is tapped, and moves the current marker", () => {
    render(<IntakePager pages={PAGES} />);

    const scroller = screen.getByTestId("intake-pager");
    // jsdom has no layout: give the scroller a width and a spy-able scrollTo.
    Object.defineProperty(scroller, "clientWidth", {
      configurable: true,
      value: 390,
    });
    const scrollTo = vi.fn();
    scroller.scrollTo = scrollTo as unknown as typeof scroller.scrollTo;

    fireEvent.click(
      screen.getByRole("button", { name: "Prikaži: Vlakna i šećer" })
    );

    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ left: 390 })
    );
    expect(
      screen.getByRole("button", { name: "Prikaži: Vlakna i šećer" })
    ).toHaveAttribute("aria-current", "true");
  });

  it("hides the dots when there is only one page", () => {
    render(<IntakePager pages={[PAGES[0]]} />);
    expect(screen.queryByTestId("intake-pager-dots")).toBeNull();
  });
});
