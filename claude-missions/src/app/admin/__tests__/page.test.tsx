import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

// F033: the `/admin` landing page -- reachable only past `requireAdmin()`
// (proven separately in `layout.test.tsx`/`admin.test.ts`). This file only
// proves the landing page itself renders real links to the three admin
// sub-areas, never a blank screen.

import AdminPage from "../page";

describe("AS-059: /admin landing page renders links to every admin sub-area", () => {
  it("test_AS_059_admin_landing_renders_the_admin_landing_container", async () => {
    render(await AdminPage());
    expect(screen.getByTestId("admin-landing")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Administracija" })
    ).toBeInTheDocument();
  });

  it("test_AS_059_admin_landing_links_to_hrana_korisnici_and_troskovi", async () => {
    render(await AdminPage());

    expect(screen.getByRole("link", { name: /Hrana/ })).toHaveAttribute(
      "href",
      "/admin/hrana"
    );
    expect(screen.getByRole("link", { name: /Korisnici/ })).toHaveAttribute(
      "href",
      "/admin/korisnici"
    );
    expect(screen.getByRole("link", { name: /Troškovi/ })).toHaveAttribute(
      "href",
      "/admin/troskovi"
    );
  });
});
