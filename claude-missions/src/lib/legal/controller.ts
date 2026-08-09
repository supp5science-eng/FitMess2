/**
 * Who is behind FitMess, in one place.
 *
 * Both stores and both privacy laws that apply to us ask the same question and
 * refuse to accept "an app" as the answer:
 *
 *  - GDPR art. 13(1)(a) and the Serbian ZZPL art. 23 require the *controller*
 *    to be named and reachable in the privacy policy itself. A policy that
 *    says only "FitMess" identifies nobody and is not a policy.
 *  - The EU Digital Services Act makes the same details ("trader status")
 *    a condition of distributing an app in the EU at all — App Store Connect
 *    and Play Console both collect them and both publish them on the listing.
 *
 * FitMess is operated by a natural person, not a company, so these details are
 * a home address that becomes publicly visible on two store listings. That was
 * a deliberate, informed decision (2026-08-09) — the alternative is registering
 * a business, which was considered and postponed. If that ever changes, this
 * file is the only place that has to change with it: the policy, the terms,
 * the deletion page and the support link all read from here.
 *
 * Nothing here is a secret. It is published on purpose, so it belongs in the
 * repository rather than in an env var.
 */

export const CONTROLLER = {
  /** Legal name of the data controller (a natural person). */
  name: "Marko Bera",
  /**
   * The single contact address for privacy requests, support and store
   * reviewers. It has to be a mailbox that is actually read: a data-subject
   * request has a one-month legal deadline, and a store reviewer who gets no
   * answer rejects the submission.
   *
   * A personal Gmail rather than `podrska@fitmess.app`, deliberately. That
   * address only ever existed as a Resend *sending* identity — the domain is
   * verified for outbound mail and nothing was ever delivered to it. A policy
   * that publishes an address which silently drops mail is worse than one that
   * publishes a plain personal address.
   */
  email: "markobera749@gmail.com",
  /** Public site the documents live on. */
  site: "https://fitmess.app",
} as const;

/**
 * NOT PUBLISHED HERE — and that is a decision, not an omission.
 *
 * A postal address is required in two places, and only two: the App Store
 * Connect and Play Console "trader" forms, where the EU Digital Services Act
 * makes it a condition of distribution and both stores then publish it on the
 * listing. It is entered in those consoles by hand, once.
 *
 * The privacy policy itself does not need it. GDPR art. 13(1)(a) asks for "the
 * identity and the contact details" of the controller — a name and a monitored
 * email address satisfy that, and every data-subject right the policy grants is
 * exercisable through it. So the documents name the controller and give a way
 * to reach them, and the home address stays out of a page anyone can read.
 *
 * If a regulator or a store ever asks for it in the policy text, add it to
 * `CONTROLLER` and interpolate it the way `name` and `email` already are.
 */

/**
 * The date the current wording of the legal documents took effect, shown at
 * the top of each one.
 *
 * Deliberately a hand-maintained constant rather than a build timestamp: it
 * marks when the *terms changed*, which is the thing a user (and a regulator)
 * needs in order to know whether they have read the current version. Bump it
 * only when the substance changes — not when a typo is fixed.
 */
export const LEGAL_EFFECTIVE_DATE = "2026-08-09";

/** Minimum age for a FitMess account. See `docs/izlazak-u-store.md`. */
export const MINIMUM_AGE = 16;
