import { describe, expect, it } from "vitest";

import { FREE_DAILY_AI } from "@/lib/ai/limits";
import { render, screen } from "@testing-library/react";

import { AccountDeletion } from "@/components/legal/account-deletion";
import { PrivacyPolicy } from "@/components/legal/privacy-policy";
import { TermsOfUse } from "@/components/legal/terms-of-use";
import { DELETE_CONFIRMATION_PHRASE } from "@/lib/account/constants";
import { createT } from "@/lib/i18n/translate";
import { CONTROLLER } from "@/lib/legal/controller";

/**
 * What a store reviewer and a regulator actually look for.
 *
 * These are not "does it render" tests. Each assertion is one thing whose
 * absence is a documented rejection reason or a legal defect: an unnamed
 * controller, an undisclosed processor, a missing legal basis for health data,
 * deletion instructions that do not say what is erased.
 */

const sr = createT("sr");
const en = createT("en");

describe("privacy policy", () => {
  it("names the controller and a way to reach them", () => {
    render(<PrivacyPolicy locale="sr" t={sr} />);

    // GDPR art. 13(1)(a)-(b): the reader must be able to identify and reach
    // whoever decides what happens to their data.
    expect(screen.getAllByText(new RegExp(CONTROLLER.name)).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(new RegExp(CONTROLLER.email)).length
    ).toBeGreaterThan(0);
  });

  it("discloses every processor the app actually calls", () => {
    render(<PrivacyPolicy locale="sr" t={sr} />);

    // The list has to match reality: these four are the only third parties the
    // code talks to. A processor the policy omits is an undisclosed transfer.
    for (const processor of ["Supabase", "Vercel", "Google", "Resend"]) {
      expect(
        screen.getAllByText(new RegExp(processor)).length,
        `${processor} missing from the processor list`
      ).toBeGreaterThan(0);
    }
  });

  it("treats body and food data as health data, on explicit consent", () => {
    render(<PrivacyPolicy locale="sr" t={sr} />);

    // Weight, intake and a weight-loss goal are special-category data (GDPR
    // art. 9). Consent is the only basis available to us, so the policy has to
    // say so rather than leaning on "legitimate interest".
    expect(screen.getByText(/posebnu? vrstu podataka/i)).toBeInTheDocument();
    expect(screen.getByText(/izričitog pristanka/i)).toBeInTheDocument();
  });

  it("states the retention periods the database actually enforces", () => {
    render(<PrivacyPolicy locale="sr" t={sr} />);

    // 30 days visible / 3 months stored comes from the pg_cron prune job in
    // `0010_logs_retention.sql`. If that job changes, this text is a lie.
    expect(screen.getByText(/30 dana[\s\S]*3 meseca/)).toBeInTheDocument();
  });

  it("renders in English too", () => {
    render(<PrivacyPolicy locale="en" t={en} />);

    expect(
      screen.getByRole("heading", { name: /privacy policy/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/health data/i).length).toBeGreaterThan(0);
  });
});

describe("terms of use", () => {
  it("leads with the medical disclaimer", () => {
    render(<TermsOfUse locale="sr" t={sr} />);

    const headings = screen.getAllByRole("heading");
    // Not merely present — first. See the note in `terms-of-use.tsx`.
    expect(headings[1]).toHaveTextContent(/nije medicinski savet/i);
    expect(screen.getByText(/nije medicinsko sredstvo/i)).toBeInTheDocument();
  });

  it("keeps the conditions that require a doctor", () => {
    render(<TermsOfUse locale="sr" t={sr} />);

    expect(screen.getByText(/trudna si ili dojiš/i)).toBeInTheDocument();
    expect(screen.getByText(/dijabetes/i)).toBeInTheDocument();
    expect(screen.getByText(/poremećaj ishrane/i)).toBeInTheDocument();
  });

  it("says what happens when the app starts charging", () => {
    render(<TermsOfUse locale="sr" t={sr} />);

    // This paragraph is a PROMISE, and it has already been wrong once: it
    // advertised a 7-day trial while the product had settled on a permanently
    // free tier instead. What is promised now is the allowance itself, and the
    // number is read from the same constant the code enforces -- so a change to
    // one without the other fails here rather than misleading a user.
    expect(
      screen.getByText(new RegExp(`do ${FREE_DAILY_AI} AI procena dnevno`, "i"))
    ).toBeInTheDocument();
    expect(screen.getByText(/trajno, ne kao probni period/i)).toBeInTheDocument();

    // Apple rejects apps that take payment outside their own system, so the
    // terms have to name where the money actually goes.
    expect(screen.getByText(/App Store-a odnosno Google Play-a/i)).toBeInTheDocument();
  });
});

describe("account deletion page", () => {
  it("tells the reader exactly what to type", () => {
    render(<AccountDeletion locale="sr" t={sr} />);

    // Imported from the same constant the dialog validates against, so the
    // instructions can never drift from what the dialog accepts.
    expect(
      screen.getByText(new RegExp(DELETE_CONFIRMATION_PHRASE))
    ).toBeInTheDocument();
  });

  it("lists what is erased and gives a route for someone locked out", () => {
    render(<AccountDeletion locale="sr" t={sr} />);

    // Play's account-deletion policy asks for both: the data categories
    // removed, and a way to ask when the app can no longer be opened.
    expect(screen.getByText(/email, broj telefona, lozinka/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(CONTROLLER.email))).toBeInTheDocument();
  });

  it("does not promise a recovery window it cannot honour", () => {
    render(<AccountDeletion locale="sr" t={sr} />);

    // `deleteAccount` is a single irreversible `deleteUser` call — there is no
    // soft-delete and no grace period to offer.
    expect(screen.getByText(/nepovratno/i)).toBeInTheDocument();
  });
});
