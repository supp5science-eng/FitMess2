import { ShieldAlert } from "lucide-react";

import {
  LegalDocument,
  LegalList,
  LegalSection,
  LegalText,
  type LegalDocumentProps,
} from "@/components/legal/legal-document";
import { CONTROLLER, MINIMUM_AGE } from "@/lib/legal/controller";

/**
 * The terms of use, rendered identically at `/uslovi` (public) and at
 * `/profil/uslovi` (in-app).
 *
 * The medical disclaimer leads, ahead of the provider details and the price —
 * out of order for a legal document, deliberately. It is the only section that
 * changes what a reader should DO, and a calorie tracker that buries "this is
 * not medical advice" under three clauses of boilerplate has technically
 * disclosed it and practically hidden it. The settings footer
 * (`MedicalDisclaimer`) links straight here for that section.
 */
export function TermsOfUse({ locale, t }: LegalDocumentProps) {
  const party = {
    name: CONTROLLER.name,
    email: CONTROLLER.email,
  };

  const doctorItems = [
    t("legal.terms.doctor.li1"),
    t("legal.terms.doctor.li2"),
    t("legal.terms.doctor.li3"),
    t("legal.terms.doctor.li4"),
    t("legal.terms.doctor.li5"),
    t("legal.terms.doctor.li6"),
  ];

  return (
    <LegalDocument
      title={t("legal.terms.title")}
      lead={t("legal.terms.lead")}
      locale={locale}
      t={t}
    >
      {/* The one section with its own frame — see the note above. */}
      <section className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <ShieldAlert className="size-[18px] shrink-0" aria-hidden={true} />
          {t("legal.terms.medical.h")}
        </h2>
        <p className="text-[15px] leading-relaxed text-foreground/90">
          {t("legal.terms.medical.body")}
        </p>
      </section>

      <LegalSection title={t("legal.terms.doctor.h")}>
        <LegalText>{t("legal.terms.doctor.lead")}</LegalText>
        <LegalList items={doctorItems} />
        <LegalText>{t("legal.terms.doctor.note")}</LegalText>
      </LegalSection>

      <LegalSection title={t("legal.terms.provider.h")}>
        <LegalText>{t("legal.terms.provider.body", party)}</LegalText>
      </LegalSection>

      <LegalSection title={t("legal.terms.account.h")}>
        <LegalText>{t("legal.terms.account.body", { age: MINIMUM_AGE })}</LegalText>
      </LegalSection>

      <LegalSection title={t("legal.terms.price.h")}>
        <LegalText>{t("legal.terms.price.body")}</LegalText>
      </LegalSection>

      <LegalSection title={t("legal.terms.accuracy.h")}>
        <LegalText>{t("legal.terms.accuracy.body")}</LegalText>
      </LegalSection>

      <LegalSection title={t("legal.terms.responsibility.h")}>
        <LegalText>{t("legal.terms.responsibility.body")}</LegalText>
      </LegalSection>

      <LegalSection title={t("legal.terms.availability.h")}>
        <LegalText>{t("legal.terms.availability.body")}</LegalText>
      </LegalSection>

      <LegalSection title={t("legal.terms.ip.h")}>
        <LegalText>{t("legal.terms.ip.body")}</LegalText>
      </LegalSection>

      <LegalSection title={t("legal.terms.liability.h")}>
        <LegalText>{t("legal.terms.liability.body")}</LegalText>
      </LegalSection>

      <LegalSection title={t("legal.terms.changes.h")}>
        <LegalText>{t("legal.terms.changes.body")}</LegalText>
      </LegalSection>

      <LegalSection title={t("legal.terms.law.h")}>
        <LegalText>{t("legal.terms.law.body", party)}</LegalText>
      </LegalSection>
    </LegalDocument>
  );
}
