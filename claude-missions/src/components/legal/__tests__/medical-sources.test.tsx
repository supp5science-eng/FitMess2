import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { MedicalSources } from "@/components/legal/medical-sources";
import { createT } from "@/lib/i18n/translate";
import { CITATIONS, CITATION_LIST } from "@/lib/legal/sources";
import { isLegalPath, SOURCES_PATH, SOURCES_PATH_EN } from "@/lib/legal/paths";

/**
 * What App Review actually looked for under **guideline 1.4.1** — and what it
 * rejected FitMess for not having on 17.08.2026: *"The app provides health or
 * medical calculations without citations, such as links to sources for this
 * information… The citations to the sources should be easy for the user to
 * find."*
 *
 * So these are not "does it render" tests. Each assertion is one thing whose
 * absence puts the rejection back on the table:
 *
 *  - a calculation the app performs with nothing behind it,
 *  - a citation with no link,
 *  - a page a reviewer cannot open without an account,
 *  - a medical disclaimer buried under the science.
 */

const sr = createT("sr");
const en = createT("en");

describe("the citations cover every calculation the app performs", () => {
  it("test_1_4_1_names_the_equation_behind_the_calorie_target", () => {
    render(<MedicalSources locale="sr" t={sr} />);

    // `lib/budget/engine.ts` computes BMR with Mifflin-St Jeor and multiplies
    // by an activity factor. Both halves have to be attributable.
    expect(screen.getAllByText(/Mifflin/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/FAO/i).length).toBeGreaterThan(0);
  });

  it("test_1_4_1_states_the_safety_floors_the_engine_refuses_to_plan_below", () => {
    render(<MedicalSources locale="sr" t={sr} />);

    // KCAL_FLOOR (1400 / 1200) and MAX_DEFICIT_PCT (25%) are the two limits
    // that stop the app from prescribing a dangerous cut. A safety limit the
    // user cannot see is a safety limit they cannot check.
    expect(screen.getByText(/1400 kcal/)).toBeInTheDocument();
    expect(screen.getByText(/1200 kcal/)).toBeInTheDocument();
    expect(screen.getByText(/25%/)).toBeInTheDocument();
  });

  it("test_1_4_1_covers_the_macro_protein_and_fat_targets", () => {
    render(<MedicalSources locale="sr" t={sr} />);

    // PROTEIN_G_PER_KG 2.0 walking down to PROTEIN_G_PER_KG_MIN 1.6, and
    // FAT_G_PER_KG_MIN 0.6.
    expect(screen.getByText(/2,0 g po kilogramu/)).toBeInTheDocument();
    expect(screen.getByText(/1,6 g\/kg/)).toBeInTheDocument();
    expect(screen.getByText(/0,6 g\/kg/)).toBeInTheDocument();
  });

  it("test_1_4_1_covers_bmi_met_values_and_the_micronutrient_ceilings", () => {
    render(<MedicalSources locale="sr" t={sr} />);

    expect(screen.getAllByText(/WHO/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/MET/).length).toBeGreaterThan(0);
    // micro.ts: fibre 14 g/1000 kcal, sodium 2300 mg.
    expect(screen.getByText(/14 g na svakih 1000 kcal/)).toBeInTheDocument();
    expect(screen.getByText(/2300 mg/)).toBeInTheDocument();
  });

  it("test_1_4_1_explains_the_7700_kcal_per_kg_pacing_rule_and_its_limits", () => {
    render(<MedicalSources locale="sr" t={sr} />);

    // KCAL_PER_KG_BODY_MASS. Citing Wishnofsky without the published
    // criticism of the rule would be citing a source we know is approximate
    // as if it were exact.
    expect(screen.getByText(/7700 kcal/)).toBeInTheDocument();
    expect(screen.getAllByText(/Wishnofsky/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hall KD/).length).toBeGreaterThan(0);
  });
});

describe("every citation is one a reader can actually open", () => {
  it("test_1_4_1_each_citation_carries_a_link", () => {
    render(<MedicalSources locale="sr" t={sr} />);

    for (const citation of CITATION_LIST) {
      const links = screen.getAllByRole("link", { name: citation.url });
      expect(links.length, `no link rendered for ${citation.id}`).toBeGreaterThan(0);
      expect(links[0]).toHaveAttribute("href", citation.url);
    }
  });

  it("test_1_4_1_every_source_url_is_https_and_points_somewhere_durable", () => {
    // PubMed and the issuing organisation's own site are the two things least
    // likely to move. A citation whose link dies is back to no citation.
    const durable = [
      "pubmed.ncbi.nlm.nih.gov",
      "ncbi.nlm.nih.gov",
      "who.int",
      "fao.org",
      "dietaryguidelines.gov",
      "nature.com",
    ];

    for (const citation of CITATION_LIST) {
      expect(citation.url.startsWith("https://"), citation.id).toBe(true);
      expect(
        durable.some((host) => citation.url.includes(host)),
        `${citation.id} links to an unvetted host: ${citation.url}`
      ).toBe(true);
    }
  });

  it("test_1_4_1_each_citation_stays_usable_if_its_link_rots", () => {
    // Authors + title + journal/year is what makes it a citation; the URL is
    // the convenience. Neither may be empty.
    for (const citation of CITATION_LIST) {
      expect(citation.authors.length, citation.id).toBeGreaterThan(0);
      expect(citation.title.length, citation.id).toBeGreaterThan(0);
      expect(citation.where.length, citation.id).toBeGreaterThan(0);
    }
  });

  it("test_1_4_1_the_citation_ids_match_their_keys", () => {
    // The sections look citations up by key; a mismatch would silently render
    // the wrong reference under a claim.
    for (const [key, citation] of Object.entries(CITATIONS)) {
      expect(citation.id).toBe(key);
    }
  });
});

describe("the page is reachable by the people who need it", () => {
  it("test_1_4_1_the_sources_page_survives_both_middleware_gates", () => {
    // Same rule the privacy policy lives by: a reviewer opens this URL on a
    // desktop, with no account. The phone gate and the auth gate both read
    // `isLegalPath`, so failing here means the reviewer gets "open this on
    // your phone" instead of the citations.
    expect(isLegalPath(SOURCES_PATH)).toBe(true);
    expect(isLegalPath(SOURCES_PATH_EN)).toBe(true);
    expect(isLegalPath("/sources")).toBe(true);
  });

  it("test_1_4_1_renders_in_english_for_a_reviewer_with_no_cookie", () => {
    render(<MedicalSources locale="en" t={en} />);

    expect(
      screen.getByRole("heading", { name: /Where the numbers come from/i })
    ).toBeInTheDocument();
    // The bibliography is untranslated by design, so it must still be there.
    expect(screen.getAllByText(/Mifflin/i).length).toBeGreaterThan(0);
  });
});

describe("the medical disclaimer leads", () => {
  it("test_1_4_1_the_not_a_doctor_notice_comes_before_the_science", () => {
    render(<MedicalSources locale="sr" t={sr} />);

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);

    // A reader who stops after one section must have read this one.
    expect(headings[0]).toBe(sr("sources.disclaimer.h"));
  });

  it("test_1_4_1_says_who_should_not_follow_the_plan_without_a_doctor", () => {
    render(<MedicalSources locale="sr" t={sr} />);

    expect(screen.getByText(/trudna/i)).toBeInTheDocument();
    expect(screen.getByText(/poremećaj ishrane/i)).toBeInTheDocument();
    expect(screen.getByText(/18 godina/)).toBeInTheDocument();
  });
});
