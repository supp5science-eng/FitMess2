import {
  LegalCallout,
  LegalDocument,
  LegalReferenceList,
  LegalSection,
  LegalText,
  type LegalDocumentProps,
} from "@/components/legal/legal-document";
import { CITATION_LIST, citations } from "@/lib/legal/sources";

/**
 * "Odakle brojevi" — the citations behind every health calculation FitMess
 * makes. Rendered identically at `/izvori` (public, what a store reviewer
 * opens with no account) and at `/profil/izvori` (in-app, one tap from
 * Podešavanja and from every screen that shows a computed number).
 *
 * This document exists because App Review rejected FitMess under **guideline
 * 1.4.1** for showing health calculations without citations. Two things follow
 * from that, and neither is cosmetic:
 *
 *  - **The citations must be easy to FIND**, which is a routing problem, not a
 *    writing one. A sources page nobody links to is the same rejection with
 *    more words in it — hence the "Odakle ovaj broj?" links next to the
 *    numbers themselves (`components/sources/sources-link.tsx`).
 *  - **The disclaimer leads.** It is the first section, not a footer: a reader
 *    who stops after one paragraph must have read the one that says this is
 *    not medical advice.
 *
 * Every claim in here is checkable against the code — the equations against
 * `lib/budget/engine.ts`, the micronutrient ceilings against
 * `lib/nutrition/micro.ts`, the MET treatment against `lib/workout/
 * activities.ts`, the trust rules against `lib/home/day-trust.ts` and
 * `lib/weight/weekly-trend.ts`. When one of those changes, this changes too;
 * a sources page that has drifted from the code is worse than none.
 */
export function MedicalSources({ locale, t }: LegalDocumentProps) {
  return (
    <LegalDocument
      title={t("sources.title")}
      lead={t("sources.lead")}
      locale={locale}
      t={t}
    >
      {/* Leads on purpose — see the note above. */}
      <LegalSection title={t("sources.disclaimer.h")}>
        <LegalCallout>{t("sources.disclaimer.body")}</LegalCallout>
        <LegalText>{t("sources.disclaimer.age")}</LegalText>
      </LegalSection>

      <LegalSection title={t("sources.kcal.h")}>
        <LegalText>{t("sources.kcal.body")}</LegalText>
        <LegalText>{t("sources.kcal.activity")}</LegalText>
        <LegalReferenceList items={citations("mifflin", "faoEnergy")} />
      </LegalSection>

      <LegalSection title={t("sources.safety.h")}>
        <LegalText>{t("sources.safety.body")}</LegalText>
        <LegalReferenceList items={citations("nhlbiObesity")} />
      </LegalSection>

      <LegalSection title={t("sources.macros.h")}>
        <LegalText>{t("sources.macros.protein")}</LegalText>
        <LegalText>{t("sources.macros.fat")}</LegalText>
        <LegalText>{t("sources.macros.carbs")}</LegalText>
        <LegalReferenceList
          items={citations("mortonProtein", "issnProtein", "whoFats")}
        />
      </LegalSection>

      <LegalSection title={t("sources.pace.h")}>
        <LegalText>{t("sources.pace.body")}</LegalText>
        <LegalReferenceList items={citations("wishnofsky", "hallRule")} />
      </LegalSection>

      <LegalSection title={t("sources.bmi.h")}>
        <LegalText>{t("sources.bmi.body")}</LegalText>
        <LegalReferenceList items={citations("whoBmi")} />
      </LegalSection>

      <LegalSection title={t("sources.workout.h")}>
        <LegalText>{t("sources.workout.body")}</LegalText>
        <LegalReferenceList items={citations("compendium")} />
      </LegalSection>

      <LegalSection title={t("sources.micro.h")}>
        <LegalText>{t("sources.micro.body")}</LegalText>
        <LegalText>{t("sources.micro.note")}</LegalText>
        <LegalReferenceList
          items={citations("dga", "whoSugars", "whoSodium", "whoFats")}
        />
      </LegalSection>

      <LegalSection title={t("sources.trust.h")}>
        <LegalText>{t("sources.trust.body")}</LegalText>
        <LegalText>{t("sources.trust.trend")}</LegalText>
        <LegalReferenceList items={citations("livingstone", "goldberg")} />
      </LegalSection>

      {/* The full list, so a reader who wants the bibliography does not have to
          reassemble it from eight sections. */}
      <LegalSection title={t("sources.list.h")}>
        <LegalText>{t("sources.list.lead")}</LegalText>
        <LegalReferenceList items={CITATION_LIST} numbered />
      </LegalSection>

      <LegalSection title={t("sources.updated.h")}>
        <LegalText>{t("sources.updated.body")}</LegalText>
      </LegalSection>
    </LegalDocument>
  );
}
