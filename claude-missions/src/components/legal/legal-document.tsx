import type { ReactNode } from "react";

import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal/controller";
import type { Citation } from "@/lib/legal/sources";
import type { Locale } from "@/lib/i18n/locale";
import type { TFunction } from "@/lib/i18n/translate";

/**
 * Shared chrome for the three legal documents.
 *
 * The documents render in two very different places from ONE source: the
 * public routes (`/privatnost`, `/uslovi`, `/brisanje-naloga`), which a store
 * reviewer opens on a desktop with no account, and the in-app settings pages,
 * which a signed-in user reaches on a phone. Only the frame differs — the text
 * is the same component in both, so the two can never drift into saying
 * different things, which for a privacy policy is not a cosmetic problem.
 *
 * The column is `max-w-2xl` rather than the app's 430px: these are documents,
 * read on whatever screen the reader happens to have.
 */

/**
 * What every document component takes.
 *
 * The locale and the bound `t` are resolved once by the page (a server
 * component that can `await getT()`) and handed down, so the documents
 * themselves stay synchronous. That is not a style preference: an async
 * component nested inside another component cannot be rendered by React's test
 * renderer, and these documents are exactly the code that must never ship
 * untested.
 */
export type LegalDocumentProps = {
  locale: Locale;
  t: TFunction;
};

export function LegalDocument({
  title,
  lead,
  locale,
  t,
  children,
}: {
  title: string;
  lead: string;
  locale: Locale;
  t: TFunction;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 py-8">
      <header className="flex flex-col gap-3">
        <h1 className="font-brand text-3xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("legal.effective", { date: formatEffectiveDate(locale) })}
        </p>
        <p className="text-base leading-relaxed text-foreground/90">{lead}</p>
      </header>
      {children}
    </article>
  );
}

/** A titled section. Every document is a flat list of these — no nesting, no
 * numbered clauses: the reader is looking for one answer, and headings they
 * can scan beat a hierarchy they have to hold in their head. */
export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Body copy. Muted, because the headings carry the structure. */
export function LegalText({ children }: { children: ReactNode }) {
  return (
    <p className="text-[15px] leading-relaxed text-muted-foreground">{children}</p>
  );
}

/** A bulleted list of short statements (processors, retention, what is
 * deleted). Each item is its own sentence, so the reader can stop reading
 * after the one that answers their question. */
export function LegalList({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed text-muted-foreground">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** A numbered list — used only where the order is the instruction (the steps
 * for deleting an account). */
export function LegalSteps({ items }: { items: readonly string[] }) {
  return (
    <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px] leading-relaxed text-muted-foreground">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ol>
  );
}

/**
 * A list of citations, each one a real link to the paper or guideline.
 *
 * Not `LegalList`: those items are plain strings, and a citation whose source
 * cannot be opened is exactly what guideline 1.4.1 rejects — "include
 * citations… such as links to those sources". The bibliographic line stays
 * visible next to the link so the reference survives the URL rotting.
 *
 * `numbered` switches to an ordered list for the full reference section at the
 * bottom of `/izvori`; the per-section lists stay unnumbered so their numbering
 * cannot imply an order the sections do not have.
 *
 * `rel="noopener noreferrer"` on every link, and `target="_blank"`: inside the
 * installed app these are the only links that deliberately leave the web view,
 * and a source opening over the app with no way back is how a reader loses
 * their place mid-plan.
 */
export function LegalReferenceList({
  items,
  numbered = false,
}: {
  items: readonly Citation[];
  numbered?: boolean;
}) {
  const List = numbered ? "ol" : "ul";
  return (
    <List
      className={`flex flex-col gap-3 pl-5 text-[15px] leading-relaxed text-muted-foreground ${
        numbered ? "list-decimal" : "list-disc"
      }`}
    >
      {items.map((citation) => (
        <li key={citation.id}>
          <span className="text-foreground/90">{citation.authors}.</span>{" "}
          {citation.title}.{" "}
          <span className="whitespace-normal">{citation.where}.</span>{" "}
          <a
            href={citation.url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-words underline underline-offset-4 hover:text-foreground"
          >
            {citation.url}
          </a>
        </li>
      ))}
    </List>
  );
}

/** A boxed statement — the one or two sentences in a document that must not be
 * skimmed past (deletion is permanent; this is not medical advice). */
export function LegalCallout({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-border bg-card px-4 py-3 text-[15px] leading-relaxed text-foreground">
      {children}
    </p>
  );
}

/**
 * The effective date, written the way each language writes dates: "9. avgust
 * 2026." in Serbian, "9 August 2026" in English. Derived from the single
 * `LEGAL_EFFECTIVE_DATE` constant so the two documents cannot claim different
 * dates.
 *
 * Formatted with `Intl` on the fly rather than stored as two translated
 * strings: a date is data, and keeping it as data means bumping one constant
 * when the wording changes instead of remembering to bump it twice.
 *
 * Fixed to UTC on both ends. The constant is a plain calendar day, and letting
 * the server's zone decide how to read it is how a document ends up dated the
 * 8th for some readers and the 9th for others.
 */
export function formatEffectiveDate(locale: Locale): string {
  const date = new Date(`${LEGAL_EFFECTIVE_DATE}T00:00:00Z`);
  return new Intl.DateTimeFormat(locale === "sr" ? "sr-Latn-RS" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
